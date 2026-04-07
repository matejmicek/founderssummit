"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { createBrowserClient } from "@/lib/supabase";
import { ShieldCheck, Skull } from "lucide-react";

interface Props {
  matchId: string;
  teamId: string;
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamBName: string;
  teamAColor: string;
  teamBColor: string;
  currentTurn: number;
  turnsPerMatch: number;
  matchIndex?: number;      // e.g. 1
  totalMatches?: number;    // e.g. 2
  onTurnComplete?: () => void;
  onMatchComplete?: () => void;
}

type Phase = "watching" | "deciding" | "waiting" | "revealing" | "revealed";

interface TurnResult {
  team_a_decision: string;
  team_b_decision: string;
  team_a_score: number;
  team_b_score: number;
  noise_flipped_a: boolean;
  noise_flipped_b: boolean;
}

export default function DecisionPanel({
  matchId,
  teamId,
  teamAId,
  teamBId,
  teamAName,
  teamBName,
  teamAColor,
  teamBColor,
  currentTurn,
  turnsPerMatch,
  matchIndex,
  totalMatches,
  onTurnComplete,
  onMatchComplete,
}: Props) {
  const [phase, setPhase] = useState<Phase>("watching");
  const [myDecision, setMyDecision] = useState<string | null>(null);
  const [turnResult, setTurnResult] = useState<TurnResult | null>(null);
  const [revealCountdown, setRevealCountdown] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previousTurns, setPreviousTurns] = useState<TurnResult[]>([]);
  const [encounterHistory, setEncounterHistory] = useState<{
    round: number;
    myDecisions: string[];
    theirDecisions: string[];
    myScore: number;
    theirScore: number;
  }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);

  const isTeamA = teamId === teamAId;
  const myName = isTeamA ? teamAName : teamBName;
  const opponentName = isTeamA ? teamBName : teamAName;

  // Reset ALL state when matchId changes (switching to a different opponent)
  const prevMatchIdRef = useRef(matchId);
  useEffect(() => {
    if (prevMatchIdRef.current !== matchId) {
      prevMatchIdRef.current = matchId;
      setPhase("watching");
      setMyDecision(null);
      setTurnResult(null);
      setRevealCountdown(null);
      setSubmitting(false);
      setPreviousTurns([]);
      setEncounterHistory([]);
      setShowHistory(false);
    }
  }, [matchId]);

  // Load encounter history with this opponent (from previous rounds)
  useEffect(() => {
    const opponentId = isTeamA ? teamBId : teamAId;
    const supabase = createBrowserClient();
    supabase
      .from("encounter_history")
      .select("round, my_score, their_score, turn_decisions")
      .eq("team_id", teamId)
      .eq("opponent_id", opponentId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setEncounterHistory(
            data.map((h) => {
              const turns = (h.turn_decisions || []) as { my: string; their: string }[];
              return {
                round: h.round,
                myDecisions: turns.map((t) => t.my),
                theirDecisions: turns.map((t) => t.their),
                myScore: h.my_score,
                theirScore: h.their_score,
              };
            })
          );
        }
      });
  }, [matchId, teamId, teamAId, teamBId, isTeamA]);

  // Also reset decision state when currentTurn changes (next turn within same match)
  const prevTurnRef = useRef(currentTurn);
  useEffect(() => {
    if (prevTurnRef.current !== currentTurn) {
      prevTurnRef.current = currentTurn;
      setPhase("watching");
      setMyDecision(null);
      setTurnResult(null);
      setRevealCountdown(null);
      setSubmitting(false);
    }
  }, [currentTurn]);

  // Get messages for this match
  const { messages } = useRealtimeMessages(matchId);
  const turnMessages = messages.filter((m) => m.turn === currentTurn);

  // Initialize phase from match status (handles page load when already deciding)
  useEffect(() => {
    const supabase = createBrowserClient();
    supabase
      .from("matches")
      .select("status")
      .eq("id", matchId)
      .single()
      .then(({ data }) => {
        if (data?.status === "deciding") {
          // Check if we already submitted for this turn
          supabase
            .from("team_decisions")
            .select("id")
            .eq("match_id", matchId)
            .eq("turn", currentTurn)
            .eq("team_id", teamId)
            .maybeSingle()
            .then(({ data: existing }) => {
              if (existing) {
                setPhase("waiting");
              } else {
                setPhase("deciding");
              }
            });
        }
      });
  }, [matchId, currentTurn, teamId]);

  // Load previous turn results
  useEffect(() => {
    const supabase = createBrowserClient();
    supabase
      .from("match_turns")
      .select("*")
      .eq("match_id", matchId)
      .order("turn", { ascending: true })
      .then(({ data }) => {
        if (data) setPreviousTurns(data as TurnResult[]);
      });
  }, [matchId, currentTurn]);

  // Subscribe to match_turns for reveal
  useEffect(() => {
    const supabase = createBrowserClient();
    const channel = supabase
      .channel(`turn-reveal-${matchId}-${currentTurn}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "match_turns",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (Number(row.turn) === currentTurn) {
            setRevealCountdown(3);
            setTurnResult(row as unknown as TurnResult);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [matchId, currentTurn]);

  // Detect match status changes via Realtime
  useEffect(() => {
    const supabase = createBrowserClient();
    const channel = supabase
      .channel(`match-status-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row.status === "deciding" && phase === "watching") {
            setPhase("deciding");
          }
          if (row.status === "completed") {
            // Match done — give time for reveal to display
            setTimeout(() => {
              onMatchComplete?.();
            }, 6000);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [matchId, phase, onMatchComplete]);

  // Reveal countdown
  useEffect(() => {
    if (revealCountdown === null) return;

    if (revealCountdown <= 0) {
      setPhase("revealed");
      playRevealSound(turnResult);

      // After reveal, let players absorb the result before moving on
      if (currentTurn >= turnsPerMatch) {
        // Final turn — show result for 6 seconds before switching to next match
        setTimeout(() => {
          onMatchComplete?.();
        }, 6000);
      } else {
        // More turns — show result for 5 seconds before next turn
        setTimeout(() => {
          onTurnComplete?.();
        }, 5000);
      }
      return;
    }

    const timer = setTimeout(() => {
      setRevealCountdown(revealCountdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [revealCountdown, turnResult, currentTurn, turnsPerMatch, onTurnComplete, onMatchComplete]);

  // Sound effects
  const playRevealSound = useCallback((result: TurnResult | null) => {
    if (!result) return;
    try {
      if (!audioRef.current) {
        audioRef.current = new AudioContext();
      }
      const ctx = audioRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const myDec = isTeamA ? result.team_a_decision : result.team_b_decision;
      const theirDec = isTeamA ? result.team_b_decision : result.team_a_decision;

      if (myDec === "cooperate" && theirDec === "cooperate") {
        osc.frequency.setValueAtTime(523, ctx.currentTime);
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.15);
        osc.frequency.setValueAtTime(784, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.8);
      } else if (myDec === "betray" && theirDec === "betray") {
        osc.frequency.setValueAtTime(110, ctx.currentTime);
        osc.type = "sawtooth";
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      } else {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.2);
        osc.type = "square";
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {
      // Audio not available
    }
  }, [isTeamA]);

  const submitDecision = async (decision: string) => {
    if (submitting || myDecision) return;
    setSubmitting(true);
    setMyDecision(decision);

    try {
      const res = await fetch(`/api/matches/${matchId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, decision }),
      });
      const data = await res.json();

      if (data.waiting) {
        setPhase("waiting");
      }
      // If both decided, Realtime subscription triggers the reveal
    } catch (err) {
      console.error("Failed to submit decision:", err);
      setMyDecision(null);
    }
    setSubmitting(false);
  };

  // Compute running score
  const myTotalScore = previousTurns.reduce((sum, t) =>
    sum + (isTeamA ? t.team_a_score : t.team_b_score), 0
  );
  const theirTotalScore = previousTurns.reduce((sum, t) =>
    sum + (isTeamA ? t.team_b_score : t.team_a_score), 0
  );

  return (
    <div className="space-y-4">
      {/* Match progress indicator (when playing multiple opponents) */}
      {totalMatches && totalMatches > 1 && matchIndex && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalMatches }, (_, i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full transition-all ${
                i + 1 < matchIndex
                  ? "bg-[var(--cooperate)]"
                  : i + 1 === matchIndex
                  ? "bg-[var(--accent)]"
                  : "bg-[var(--border)]"
              }`}
            />
          ))}
          <span className="text-[10px] font-mono text-[var(--muted)] ml-1">
            Opponent {matchIndex}/{totalMatches}
          </span>
        </div>
      )}

      {/* Match header */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: teamAColor }} />
            <span className="font-bold text-sm">{teamAName}</span>
          </div>
          <div className="text-center">
            <span className="text-xs font-mono text-[var(--muted)]">
              Turn {currentTurn} of {turnsPerMatch}
            </span>
            <div className="font-mono text-lg font-bold tabular-nums">
              {myTotalScore} - {theirTotalScore}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">{teamBName}</span>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: teamBColor }} />
          </div>
        </div>

        {/* Previous turn results */}
        {previousTurns.length > 0 && (
          <div className="flex gap-2 justify-center mt-2">
            {previousTurns.map((t, i) => {
              const myDec = isTeamA ? t.team_a_decision : t.team_b_decision;
              const theirDec = isTeamA ? t.team_b_decision : t.team_a_decision;
              return (
                <div key={i} className="text-center">
                  <div className="text-[10px] font-mono text-[var(--muted)]">T{i + 1}</div>
                  <div className="flex gap-1">
                    <span className={`text-xs font-bold ${myDec === "cooperate" ? "text-[var(--cooperate)]" : "text-[var(--betray)]"}`}>
                      {myDec === "cooperate" ? "C" : "B"}
                    </span>
                    <span className="text-[var(--muted)] text-xs">/</span>
                    <span className={`text-xs font-bold ${theirDec === "cooperate" ? "text-[var(--cooperate)]" : "text-[var(--betray)]"}`}>
                      {theirDec === "cooperate" ? "C" : "B"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Encounter history (previous rounds with this opponent) */}
      {encounterHistory.length > 0 && (
        <div className="card p-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between text-xs font-bold text-[var(--muted)] uppercase tracking-widest font-mono"
          >
            <span>History vs {opponentName} ({encounterHistory.length} round{encounterHistory.length > 1 ? "s" : ""})</span>
            <span className="text-[var(--accent)]">{showHistory ? "Hide" : "Show"}</span>
          </button>

          {showHistory && (
            <div className="mt-3 space-y-2">
              {encounterHistory.map((h, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <span className="font-mono font-bold text-[var(--muted)] w-8 shrink-0">R{h.round}</span>
                  <div className="flex gap-1">
                    {h.myDecisions.map((d, j) => {
                      const their = h.theirDecisions[j];
                      return (
                        <div key={j} className="text-center">
                          <div className="flex gap-0.5">
                            <span className={`font-bold ${d === "cooperate" ? "text-[var(--cooperate)]" : "text-[var(--betray)]"}`}>
                              {d === "cooperate" ? "C" : "B"}
                            </span>
                            <span className="text-[var(--muted)]">/</span>
                            <span className={`font-bold ${their === "cooperate" ? "text-[var(--cooperate)]" : "text-[var(--betray)]"}`}>
                              {their === "cooperate" ? "C" : "B"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <span className="font-mono ml-auto tabular-nums">
                    <span className={h.myScore >= h.theirScore ? "text-[var(--cooperate)] font-bold" : "text-[var(--muted)]"}>{h.myScore}</span>
                    <span className="text-[var(--muted)]">-</span>
                    <span className={h.theirScore >= h.myScore ? "text-[var(--betray)] font-bold" : "text-[var(--muted)]"}>{h.theirScore}</span>
                  </span>
                </div>
              ))}
              <div className="border-t border-[var(--border)] pt-1.5 flex justify-between text-xs font-mono">
                <span className="text-[var(--muted)]">Total</span>
                <span className="font-bold">
                  {encounterHistory.reduce((s, h) => s + h.myScore, 0)}-{encounterHistory.reduce((s, h) => s + h.theirScore, 0)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Negotiation transcript */}
      <div className="card p-4">
        <h3 className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest font-mono mb-3">
          Agent Negotiation
        </h3>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {turnMessages.length === 0 ? (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-[var(--accent)] border-t-transparent" />
              <p className="text-xs text-[var(--muted)] mt-2 font-mono">Agents negotiating...</p>
            </div>
          ) : (
            turnMessages.map((msg, i) => {
              const isMine = msg.team_id === teamId;
              return (
                <div
                  key={i}
                  className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                  style={{ animation: "fade-in 0.3s ease-out" }}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                      isMine
                        ? "bg-[var(--accent)] text-white rounded-br-sm"
                        : "bg-[var(--surface)] border border-[var(--border)] rounded-bl-sm"
                    }`}
                  >
                    <div className="text-[10px] font-mono opacity-70 mb-0.5">
                      {isMine ? myName : opponentName}
                    </div>
                    {msg.content}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Decision area */}
      {phase === "watching" && (
        <div className="text-center py-4">
          <p className="text-sm text-[var(--muted)] font-mono">
            Agents are talking... decision time coming soon.
          </p>
        </div>
      )}

      {phase === "deciding" && !myDecision && (
        <div className="space-y-3" style={{ animation: "fade-in 0.4s ease-out" }}>
          <div className="text-center">
            <p className="text-sm font-bold text-[var(--foreground)]">Make your decision!</p>
          </div>

          {/* Decision buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => submitDecision("cooperate")}
              disabled={submitting}
              className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-[var(--cooperate)] bg-[var(--cooperate-bg)] hover:bg-[var(--cooperate)] hover:text-white transition-all active:scale-95 disabled:opacity-50"
            >
              <ShieldCheck size={22} className="text-[var(--cooperate)]" />
              <span className="text-base font-extrabold text-[var(--cooperate)]">COOPERATE</span>
            </button>

            <button
              onClick={() => submitDecision("betray")}
              disabled={submitting}
              className="flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-[var(--betray)] bg-[var(--betray-bg, rgba(239,68,68,0.1))] hover:bg-[var(--betray)] hover:text-white transition-all active:scale-95 disabled:opacity-50"
            >
              <Skull size={22} className="text-[var(--betray)]" />
              <span className="text-base font-extrabold text-[var(--betray)]">BETRAY</span>
            </button>
          </div>
        </div>
      )}

      {phase === "waiting" && (
        <div className="text-center py-6" style={{ animation: "fade-in 0.3s ease-out" }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface)] border border-[var(--border)]">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--accent)] border-t-transparent" />
            <span className="text-sm font-mono">
              You chose <span className={myDecision === "cooperate" ? "text-[var(--cooperate)] font-bold" : "text-[var(--betray)] font-bold"}>
                {myDecision}
              </span>. Waiting for {opponentName}...
            </span>
          </div>
        </div>
      )}

      {/* Reveal countdown */}
      {revealCountdown !== null && revealCountdown > 0 && (
        <div className="text-center py-8" style={{ animation: "fade-in 0.3s ease-out" }}>
          <div className="text-6xl font-extrabold font-mono text-[var(--accent)]"
            style={{ animation: "pulse-glow 1s ease-in-out infinite" }}
          >
            {revealCountdown}
          </div>
          <p className="text-sm text-[var(--muted)] mt-2 font-mono">Revealing decisions...</p>
        </div>
      )}

      {/* Reveal */}
      {phase === "revealed" && turnResult && (
        <div className="space-y-3" style={{ animation: "fade-in 0.5s ease-out" }}>
          <div className="grid grid-cols-2 gap-3">
            <div className={`card p-4 text-center border-2 ${
              turnResult.team_a_decision === "cooperate"
                ? "border-[var(--cooperate)] bg-[var(--cooperate-bg)]"
                : "border-[var(--betray)]"
            }`}>
              <div className="text-xs font-mono text-[var(--muted)] mb-1">{teamAName}</div>
              <div className={`text-2xl font-extrabold ${
                turnResult.team_a_decision === "cooperate" ? "text-[var(--cooperate)]" : "text-[var(--betray)]"
              }`}>
                {turnResult.team_a_decision === "cooperate" ? "COOPERATE" : "BETRAY"}
              </div>
              <div className="text-lg font-bold font-mono mt-1">+{turnResult.team_a_score}</div>
            </div>

            <div className={`card p-4 text-center border-2 ${
              turnResult.team_b_decision === "cooperate"
                ? "border-[var(--cooperate)] bg-[var(--cooperate-bg)]"
                : "border-[var(--betray)]"
            }`}>
              <div className="text-xs font-mono text-[var(--muted)] mb-1">{teamBName}</div>
              <div className={`text-2xl font-extrabold ${
                turnResult.team_b_decision === "cooperate" ? "text-[var(--cooperate)]" : "text-[var(--betray)]"
              }`}>
                {turnResult.team_b_decision === "cooperate" ? "COOPERATE" : "BETRAY"}
              </div>
              <div className="text-lg font-bold font-mono mt-1">+{turnResult.team_b_score}</div>
            </div>
          </div>

          {currentTurn < turnsPerMatch && (
            <p className="text-center text-xs text-[var(--muted)] font-mono animate-pulse">
              Next turn starting...
            </p>
          )}
          {currentTurn >= turnsPerMatch && totalMatches && matchIndex && matchIndex < totalMatches && (
            <p className="text-center text-sm font-mono text-[var(--accent)] font-bold animate-pulse">
              Switching to next opponent...
            </p>
          )}
          {currentTurn >= turnsPerMatch && (!totalMatches || !matchIndex || matchIndex >= (totalMatches || 1)) && (
            <p className="text-center text-sm font-mono text-[var(--cooperate)] font-bold">
              Match complete!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
