"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Volume2, Pause, ChevronDown, ChevronUp, Star } from "lucide-react";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";

interface TurnData {
  turn: number;
  team_a_decision: string;
  team_b_decision: string;
  team_a_score: number;
  team_b_score: number;
  team_a_reasoning?: string;
  team_b_reasoning?: string;
}

interface Highlight {
  id: string;
  match_id: string;
  title: string;
  commentary: string;
  highlight_type: string;
  ranking: number;
  voiceover_script?: string;
  voiceover_audio_base64?: string;
  turns: TurnData[];
  match?: {
    id: string;
    team_a: { id: string; name: string; color: string };
    team_b: { id: string; name: string; color: string };
    team_a_decision: string;
    team_b_decision: string;
    team_a_score: number;
    team_b_score: number;
  };
}

interface TeamMatch {
  id: string;
  round: number;
  status: string;
  team_a_id: string;
  team_b_id: string;
  team_a_score: number;
  team_b_score: number;
  team_a: { id: string; name: string; color: string };
  team_b: { id: string; name: string; color: string };
  turns: TurnData[];
}

interface Props {
  seasonId: number;
  round: number;
  teamId: string;
}

const TYPE_LABELS: Record<string, string> = {
  betrayal: "Betrayal",
  alliance: "Alliance",
  upset: "Upset",
  comedy: "Comedy",
  tragedy: "Tragedy",
  mindgame: "Mind Game",
  drama: "Drama",
};

export default function TeamPostRound({ seasonId, round, teamId }: Props) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [matches, setMatches] = useState<TeamMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [hlRes, matchRes] = await Promise.all([
        fetch(`/api/seasons/${seasonId}/highlights?round=${round}&team_id=${teamId}`),
        fetch(`/api/team/matches?seasonId=${seasonId}&round=${round}`),
      ]);
      const hlData = await hlRes.json();
      const matchData = await matchRes.json();
      setHighlights(hlData.highlights || []);
      setMatches(matchData.matches || []);
    } catch {}
    setLoading(false);
  }, [seasonId, round, teamId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playAudio = (highlightId: string, base64: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playingId === highlightId) {
      setPlayingId(null);
      return;
    }
    const audio = new Audio(`data:audio/mpeg;base64,${base64}`);
    audioRef.current = audio;
    setPlayingId(highlightId);
    audio.onended = () => { setPlayingId(null); audioRef.current = null; };
    audio.onerror = () => { setPlayingId(null); audioRef.current = null; };
    audio.play().catch(() => { setPlayingId(null); audioRef.current = null; });
  };

  // Highlight match IDs so we can mark them in the "all matches" list
  const highlightMatchIds = new Set(highlights.map((h) => h.match_id));

  // Matches NOT already covered by highlights
  const otherMatches = matches.filter((m) => !highlightMatchIds.has(m.id));

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
        <p className="text-[var(--muted)] text-sm mt-3 font-mono">Loading your round review...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Your Highlights */}
      {highlights.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Star size={16} className="text-[var(--accent)]" />
            <h2 className="text-lg font-extrabold tracking-tight">Your Highlights</h2>
          </div>

          {highlights.map((h) => {
            const match = h.match;
            const isPlaying = playingId === h.id;
            const hasAudio = !!h.voiceover_audio_base64;
            const turns = h.turns || [];
            const totalA = turns.reduce((s, t) => s + t.team_a_score, 0);
            const totalB = turns.reduce((s, t) => s + t.team_b_score, 0);

            return (
              <div key={h.id} className="card p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-extrabold text-base tracking-tight leading-tight mb-1">
                      {h.title}
                    </h4>
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-[var(--accent-light)] text-[var(--accent)] uppercase tracking-widest">
                      {TYPE_LABELS[h.highlight_type] || h.highlight_type}
                    </span>
                  </div>
                  {match && (
                    <div className="text-right text-xs space-y-0.5">
                      <div className="flex items-center gap-1.5 justify-end">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: match.team_a?.color }} />
                        <span className="font-medium">{match.team_a?.name}</span>
                        <span className="font-extrabold tabular-nums font-mono ml-1">{totalA}</span>
                      </div>
                      <div className="flex items-center gap-1.5 justify-end">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: match.team_b?.color }} />
                        <span className="font-medium">{match.team_b?.name}</span>
                        <span className="font-extrabold tabular-nums font-mono ml-1">{totalB}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Turn pills */}
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {[1, 2, 3].map((turnNum) => {
                    const turn = turns.find((t) => t.turn === turnNum);
                    if (!turn) return (
                      <div key={turnNum} className="rounded bg-[var(--background)] border border-[var(--border)] p-2 text-center">
                        <div className="text-[9px] text-[var(--muted)] uppercase tracking-widest font-mono font-bold">T{turnNum}</div>
                        <div className="text-xs text-[var(--muted)]">&mdash;</div>
                      </div>
                    );
                    const aColor = turn.team_a_decision === "cooperate" ? "var(--cooperate)" : "var(--betray)";
                    const bColor = turn.team_b_decision === "cooperate" ? "var(--cooperate)" : "var(--betray)";
                    return (
                      <div key={turnNum} className="rounded bg-[var(--background)] border border-[var(--border)] p-2 text-center">
                        <div className="text-[9px] text-[var(--muted)] uppercase tracking-widest font-mono font-bold">T{turnNum}</div>
                        <div className="flex items-center justify-center gap-1.5 text-xs font-bold font-mono">
                          <span style={{ color: aColor }}>{turn.team_a_decision === "cooperate" ? "C" : "B"}</span>
                          <span className="text-[var(--muted)] text-[10px]">v</span>
                          <span style={{ color: bColor }}>{turn.team_b_decision === "cooperate" ? "C" : "B"}</span>
                        </div>
                        <div className="text-[10px] text-[var(--muted)] tabular-nums font-mono">
                          +{turn.team_a_score} / +{turn.team_b_score}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Commentary */}
                <p className="text-sm text-[var(--foreground-secondary)] leading-relaxed mb-3">
                  {h.commentary}
                </p>

                {/* Audio + expand */}
                <div className="flex items-center gap-2">
                  {hasAudio && (
                    <button
                      onClick={() => playAudio(h.id, h.voiceover_audio_base64!)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-all ${
                        isPlaying ? "btn-accent" : "btn-ghost"
                      }`}
                    >
                      {isPlaying ? <><Pause size={12} /> Playing...</> : <><Volume2 size={12} /> Play</>}
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedMatch(expandedMatch === h.match_id ? null : h.match_id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium btn-ghost rounded"
                  >
                    {expandedMatch === h.match_id ? <><ChevronUp size={12} /> Hide Transcript</> : <><ChevronDown size={12} /> Full Transcript</>}
                  </button>
                </div>

                {/* Expandable transcript */}
                {expandedMatch === h.match_id && match && (
                  <div className="mt-3 pt-3 border-t border-[var(--border)]">
                    <MatchMessages
                      matchId={h.match_id}
                      teamA={match.team_a}
                      teamB={match.team_b}
                      turns={turns}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* All Other Matches */}
      {otherMatches.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-[var(--muted)] uppercase tracking-widest font-mono">
            All Matches ({matches.length} total)
          </h3>

          {otherMatches.map((m) => {
            const isTeamA = m.team_a_id === teamId;
            const myScore = isTeamA ? m.team_a_score : m.team_b_score;
            const oppScore = isTeamA ? m.team_b_score : m.team_a_score;
            const opponent = isTeamA ? m.team_b : m.team_a;
            const isExpanded = expandedMatch === m.id;
            const won = myScore > oppScore;
            const tied = myScore === oppScore;

            return (
              <div key={m.id} className="card overflow-hidden">
                <button
                  onClick={() => setExpandedMatch(isExpanded ? null : m.id)}
                  className="w-full p-3 flex items-center justify-between text-left hover:bg-[var(--surface)] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: opponent.color }} />
                    <span className="text-sm font-semibold">vs {opponent.name}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className={`text-sm font-extrabold font-mono tabular-nums ${
                      won ? "text-[var(--cooperate)]" : tied ? "text-[var(--muted)]" : "text-[var(--betray)]"
                    }`}>
                      {myScore} - {oppScore}
                    </span>
                    {/* Turn decision pills */}
                    <div className="flex gap-0.5">
                      {(m.turns || []).map((t) => {
                        const myDecision = isTeamA ? t.team_a_decision : t.team_b_decision;
                        return (
                          <div
                            key={t.turn}
                            className="w-4 h-4 rounded-sm flex items-center justify-center text-[8px] font-bold text-white"
                            style={{
                              backgroundColor: myDecision === "cooperate"
                                ? "var(--cooperate)"
                                : "var(--betray)",
                            }}
                          >
                            {myDecision === "cooperate" ? "C" : "B"}
                          </div>
                        );
                      })}
                    </div>
                    {isExpanded ? <ChevronUp size={14} className="text-[var(--muted)]" /> : <ChevronDown size={14} className="text-[var(--muted)]" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-[var(--border)]">
                    <div className="pt-3">
                      <MatchMessages
                        matchId={m.id}
                        teamA={m.team_a}
                        teamB={m.team_b}
                        turns={m.turns}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {highlights.length === 0 && matches.length === 0 && (
        <div className="text-center py-8 text-[var(--muted)] text-sm font-mono">
          No matches played yet this round.
        </div>
      )}
    </div>
  );
}

// Sub-component: loads and displays messages for a match
function MatchMessages({
  matchId,
  teamA,
  teamB,
  turns,
}: {
  matchId: string;
  teamA: { id: string; name: string; color: string };
  teamB: { id: string; name: string; color: string };
  turns: TurnData[];
}) {
  const { messages } = useRealtimeMessages(matchId);

  const messagesByTurn: Record<number, typeof messages> = {};
  for (const msg of messages) {
    const turn = (msg as { turn?: number }).turn || 1;
    if (!messagesByTurn[turn]) messagesByTurn[turn] = [];
    messagesByTurn[turn].push(msg);
  }

  const turnNumbers = Object.keys(messagesByTurn).map(Number).sort((a, b) => a - b);

  if (messages.length === 0) {
    return (
      <div className="text-center py-4 text-xs text-[var(--muted)] font-mono">
        Loading transcript...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {turnNumbers.map((turnNum) => {
        const turnMsgs = messagesByTurn[turnNum] || [];
        const turnResult = turns.find((t) => t.turn === turnNum);

        return (
          <div key={turnNum}>
            <div className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-widest font-mono mb-1.5">
              Turn {turnNum}
            </div>
            <div className="space-y-1.5">
              {turnMsgs.map((msg) => {
                const isTeamA = msg.team_id === teamA.id;
                const team = isTeamA ? teamA : teamB;
                return (
                  <div key={msg.id} className={`flex ${isTeamA ? "justify-start" : "justify-end"}`}>
                    <div
                      className="max-w-[85%] rounded px-3 py-1.5 text-xs"
                      style={{
                        backgroundColor: team.color + "12",
                        borderLeft: isTeamA ? `2px solid ${team.color}` : "none",
                        borderRight: !isTeamA ? `2px solid ${team.color}` : "none",
                      }}
                    >
                      <div className="text-[9px] font-semibold mb-0.5 font-mono" style={{ color: team.color }}>
                        {team.name}
                      </div>
                      {msg.content}
                    </div>
                  </div>
                );
              })}
            </div>
            {turnResult && (
              <div className="flex items-center justify-center gap-3 py-1.5 px-2 mt-1.5 rounded bg-[var(--background)] border border-[var(--border)] text-[10px] font-mono">
                <span className={`font-bold ${turnResult.team_a_decision === "cooperate" ? "text-[var(--cooperate)]" : "text-[var(--betray)]"}`}>
                  {turnResult.team_a_decision.toUpperCase()} +{turnResult.team_a_score}
                </span>
                <span className="text-[var(--muted)]">|</span>
                <span className={`font-bold ${turnResult.team_b_decision === "cooperate" ? "text-[var(--cooperate)]" : "text-[var(--betray)]"}`}>
                  +{turnResult.team_b_score} {turnResult.team_b_decision.toUpperCase()}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
