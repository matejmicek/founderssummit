"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Leaderboard from "@/components/Leaderboard";
import ScoreMatrix from "@/components/ScoreMatrix";
import RoundHighlights from "@/components/RoundHighlights";
import MatchResults from "@/components/MatchResults";
import {
  Play,
  Pause,
  SkipForward,
  Trophy,
  Users,
  Radio,
  Sparkles,
  ChevronDown,
  Settings,
  ArrowLeft,
} from "lucide-react";

interface Tournament {
  id: string;
  name: string;
  join_code: string;
  status: string;
}

interface Season {
  id: number;
  tournament_id: string;
  number: number;
  status: string;
  current_round: number;
  total_rounds: number;
  points_multiplier: number;
  round_status: string;
}

interface Team {
  id: string;
  name: string;
  color: string;
}

type Phase =
  | "lobby"
  | "building"
  | "ready_check"
  | "running_matches"
  | "generating_highlights"
  | "showing_highlights"
  | "results"
  | "final";

export default function AdminPage() {
  const secret = "dev-secret-123";
  const authenticated = true;
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [readiness, setReadiness] = useState<Record<string, boolean>>({});
  const [matchProgress, setMatchProgress] = useState<{
    total: number;
    completed: number;
  } | null>(null);
  const [loading, setLoading] = useState("");
  const [roundError, setRoundError] = useState("");
  const [newTournamentName, setNewTournamentName] = useState("");
  const [showControls, setShowControls] = useState(false);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-admin-secret": secret,
  };

  const phaseLockedRef = useRef<{ phase: string; until: number } | null>(null);

  const loadState = useCallback(async () => {
    if (!activeTournament) return;
    try {
      const res = await fetch(
        `/api/admin/state?tournamentId=${activeTournament.id}`,
        { headers: { "x-admin-secret": secret } }
      );
      const data = await res.json();
      if (data.tournaments) setTournaments(data.tournaments);
      if (data.teams) setTeams(data.teams);
      if (data.readiness) setReadiness(data.readiness);
      if (data.matchProgress !== undefined) setMatchProgress(data.matchProgress);

      // Respect phase lock — don't let polling skip intermediate phases
      if (data.seasons && phaseLockedRef.current) {
        const lock = phaseLockedRef.current;
        const serverSeason = data.seasons.find((s: Season) => s.status === "running");
        if (serverSeason && serverSeason.round_status !== lock.phase && Date.now() < lock.until) {
          // Server moved past our locked phase — apply new phase with its own minimum display time
          const newPhase = serverSeason.round_status;
          const phaseOrder = ["running_matches", "generating_highlights", "showing_highlights"];
          const lockIdx = phaseOrder.indexOf(lock.phase);
          const serverIdx = phaseOrder.indexOf(newPhase);
          if (serverIdx > lockIdx) {
            // Show the next phase in sequence, not the server's latest
            const nextPhase = phaseOrder[lockIdx + 1];
            phaseLockedRef.current = { phase: nextPhase, until: Date.now() + 3000 };
            setSeasons(data.seasons.map((s: Season) =>
              s.status === "running" ? { ...s, round_status: nextPhase } : s
            ));
            return;
          }
        }
        if (Date.now() >= lock.until) {
          phaseLockedRef.current = null;
        }
      }

      if (data.seasons) setSeasons(data.seasons);
    } catch {}
  }, [activeTournament, secret]);

  useEffect(() => {
    if (!activeTournament) return;
    loadState();
    const interval = setInterval(loadState, 2000);
    return () => clearInterval(interval);
  }, [activeTournament, loadState]);

  useEffect(() => {
    if (!authenticated) return;
    fetch("/api/admin/state", {
      headers: { "x-admin-secret": secret },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.tournaments) setTournaments(data.tournaments);
      })
      .catch(() => {});
  }, [authenticated, secret]);

  const activeSeason = seasons.find((s) => s.status !== "completed") || seasons[seasons.length - 1];
  const readyCount = Object.values(readiness).filter(Boolean).length;
  const allReady = readyCount === teams.length && teams.length > 1;

  const getPhase = (): Phase => {
    if (!activeSeason) return "lobby";
    if (activeSeason.status === "building" || activeSeason.status === "tweaking") return "building";
    if (activeSeason.status === "completed") return "final";
    if (activeSeason.status === "running") {
      const rs = activeSeason.round_status || "idle";
      if (rs === "running_matches") return "running_matches";
      if (rs === "generating_highlights") return "generating_highlights";
      if (rs === "showing_highlights") return "showing_highlights";
      return "ready_check";
    }
    return "lobby";
  };

  const phase = getPhase();

  // Actions
  const createTournament = async () => {
    if (!newTournamentName.trim()) return;
    setLoading("tournament");
    try {
      const res = await fetch("/api/admin/create-tournament", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: newTournamentName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setActiveTournament(data.tournament);
        setNewTournamentName("");
      }
    } catch {}
    setLoading("");
  };

  const createSeason = async (multiplier = 1) => {
    if (!activeTournament) return;
    const num = seasons.length + 1;
    try {
      await fetch("/api/admin/create-season", {
        method: "POST",
        headers,
        body: JSON.stringify({
          tournamentId: activeTournament.id,
          number: num,
          pointsMultiplier: multiplier,
          totalRounds: 1,
        }),
      });
      loadState();
    } catch {}
  };

  const updateSeasonStatus = async (status: string) => {
    if (!activeSeason) return;
    await fetch(`/api/seasons/${activeSeason.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status }),
    });
    loadState();
  };

  const runRound = async () => {
    if (!activeSeason || !allReady) return;
    setRoundError("");

    // Optimistic update + lock this phase for at least 3s
    setSeasons((prev) =>
      prev.map((s) =>
        s.id === activeSeason.id
          ? { ...s, round_status: "running_matches", current_round: s.current_round + 1 }
          : s
      )
    );
    phaseLockedRef.current = { phase: "running_matches", until: Date.now() + 3000 };

    try {
      const res = await fetch(`/api/seasons/${activeSeason.id}/run-round`, {
        method: "POST",
        headers,
      });
      if (!res.ok) {
        const data = await res.json();
        setRoundError(data.error || "Round failed");
        // Revert optimistic update on error
        loadState();
      }
    } catch {
      setRoundError("Network error");
      loadState();
    }
  };

  const dismissHighlights = async () => {
    if (!activeSeason) return;
    await fetch(`/api/seasons/${activeSeason.id}/dismiss-highlights`, {
      method: "POST",
      headers,
    });
    loadState();
  };

  // === TOURNAMENT SELECT ===
  if (!activeTournament) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full space-y-4">
          <h1 className="text-4xl font-extrabold text-center tracking-tight">
            Agent <span className="text-[var(--accent)]">Arena</span>
          </h1>
          <p className="text-center text-[var(--muted)] text-sm">Select or create a tournament</p>

          <div className="flex gap-2">
            <input
              type="text"
              value={newTournamentName}
              onChange={(e) => setNewTournamentName(e.target.value)}
              placeholder="New tournament name..."
              className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)]"
              onKeyDown={(e) => e.key === "Enter" && createTournament()}
            />
            <button
              onClick={createTournament}
              disabled={!newTournamentName.trim()}
              className="btn-accent text-sm px-4 py-2.5"
            >
              Create
            </button>
          </div>

          {tournaments.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTournament(t)}
              className="card w-full flex items-center justify-between px-4 py-3 cursor-pointer"
            >
              <span className="font-semibold">{t.name}</span>
              <code className="text-sm bg-[var(--background)] px-2.5 py-1 rounded-lg font-mono tracking-widest text-[var(--accent)] font-bold">
                {t.join_code}
              </code>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // === FULLSCREEN TOURNAMENT VIEW ===
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-extrabold tracking-tight">
            Agent <span className="text-[var(--accent)]">Arena</span>
          </h1>
          <span className="text-[var(--muted)] text-sm font-mono">
            {activeTournament.name}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Join code — always visible, big for projector */}
          <div className="card px-4 py-2 text-center">
            <div className="text-[9px] uppercase text-[var(--muted)] tracking-widest font-mono font-semibold">
              Join Code
            </div>
            <div className="font-mono text-2xl font-bold tracking-[0.2em] text-[var(--accent)]">
              {activeTournament.join_code}
            </div>
          </div>

          {activeSeason && (
            <div className="text-right text-xs text-[var(--muted)] font-mono">
              <div className="font-semibold text-[var(--foreground)]">
                Season {activeSeason.number}
                {activeSeason.points_multiplier > 1 && (
                  <span className="text-[var(--accent)] ml-1">{activeSeason.points_multiplier}x</span>
                )}
              </div>
              <div>
                {teams.length} teams · {(teams.length * (teams.length - 1)) / 2} matches
              </div>
            </div>
          )}

          {/* Admin controls toggle */}
          <button
            onClick={() => setShowControls(!showControls)}
            className="p-2 rounded-lg hover:bg-[var(--surface)] transition-colors text-[var(--muted)]"
          >
            <Settings size={18} />
          </button>

          <button
            onClick={() => setActiveTournament(null)}
            className="text-xs text-[var(--muted)] hover:text-[var(--accent)] font-mono transition-colors"
          >
            Switch
          </button>
        </div>
      </header>

      {/* Admin control strip — collapsible */}
      {showControls && (
        <div className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-2 flex items-center gap-3 text-xs">
          {phase === "lobby" && !activeSeason && (
            <button onClick={() => createSeason()} className="btn-accent text-xs py-1.5 px-3">
              Create Season 1
            </button>
          )}
          {phase === "lobby" && activeSeason?.status === "pending" && (
            <button onClick={() => updateSeasonStatus("building")} className="btn-accent text-xs py-1.5 px-3">
              Start Building
            </button>
          )}
          {phase === "building" && (
            <button
              onClick={() => updateSeasonStatus("running")}
              disabled={!allReady}
              className="btn-accent text-xs py-1.5 px-3"
            >
              {allReady ? "Lock In & Start" : `Waiting (${readyCount}/${teams.length})`}
            </button>
          )}
          {phase === "ready_check" && (
            <>
              <button
                onClick={runRound}
                disabled={!allReady}
                className="btn-accent text-xs py-1.5 px-3"
              >
                {allReady ? `Run Matches (${(teams.length * (teams.length - 1)) / 2})` : `Waiting (${readyCount}/${teams.length})`}
              </button>
              <button onClick={() => updateSeasonStatus("building")} className="btn-ghost text-xs py-1.5 px-3">
                Back to Building
              </button>
            </>
          )}
          {phase === "showing_highlights" && (
            <button
              onClick={() => { dismissHighlights(); updateSeasonStatus("completed"); }}
              className="btn-accent text-xs py-1.5 px-3"
            >
              Show Final Results
            </button>
          )}
          {phase === "final" && (
            <>
              <button onClick={() => createSeason()} className="btn-accent text-xs py-1.5 px-3">
                New Season
              </button>
              <button onClick={() => createSeason(2)} className="btn-ghost text-xs py-1.5 px-3">
                Championship (2x)
              </button>
            </>
          )}
          {roundError && (
            <span className="text-[var(--betray)] ml-2">{roundError}</span>
          )}
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 p-8 overflow-y-auto">
        {/* LOBBY */}
        {phase === "lobby" && (
          <div className="max-w-3xl mx-auto text-center" style={{ animation: "fade-in 0.4s ease-out" }}>
            <div className="mb-12">
              <h2 className="projector-heading mb-3">
                {activeTournament.name}
              </h2>
              <p className="projector-subheading">
                Join with code{" "}
                <span className="font-mono font-bold text-[var(--accent)] tracking-widest text-3xl">
                  {activeTournament.join_code}
                </span>
              </p>
            </div>

            <TeamGrid teams={teams} readiness={readiness} />
          </div>
        )}

        {/* BUILDING */}
        {phase === "building" && (
          <div className="max-w-3xl mx-auto" style={{ animation: "fade-in 0.4s ease-out" }}>
            <div className="text-center mb-10">
              <h2 className="projector-heading mb-2">
                {activeSeason?.status === "tweaking" ? "Tweak Your Strategy" : "Build Your Agent"}
              </h2>
              <p className="projector-subheading">Teams are writing their playbooks</p>
            </div>

            <TeamGrid teams={teams} readiness={readiness} />

            <div className="text-center mt-10">
              <div className="inline-flex items-center gap-2 card px-6 py-3">
                <div className={`w-2.5 h-2.5 rounded-full ${allReady ? "bg-[var(--cooperate)]" : "bg-[var(--border-strong)]"}`}
                  style={allReady ? { animation: "pulse-glow 2s ease-in-out infinite" } : undefined}
                />
                <span className="font-mono text-sm font-semibold">
                  {allReady
                    ? "All teams ready!"
                    : `${readyCount} / ${teams.length} teams ready`}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* READY CHECK */}
        {phase === "ready_check" && activeSeason && (
          <div className="max-w-6xl mx-auto" style={{ animation: "fade-in 0.4s ease-out" }}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                {activeSeason.current_round > 0 ? (
                  <Leaderboard seasonId={activeSeason.id} />
                ) : (
                  <div className="text-center py-16">
                    <h2 className="projector-heading mb-3">Ready to begin?</h2>
                    <p className="projector-subheading">
                      All teams must mark themselves ready
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest font-mono mb-3">
                    Team Readiness
                  </h3>
                  <TeamGrid teams={teams} readiness={readiness} compact />
                </div>
              </div>
            </div>

            {activeSeason.current_round > 0 && (
              <div className="mt-10">
                <h3 className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest font-mono mb-3">
                  Head-to-Head
                </h3>
                <ScoreMatrix seasonId={activeSeason.id} />
              </div>
            )}
          </div>
        )}

        {/* RUNNING MATCHES */}
        {phase === "running_matches" && activeSeason && (
          <div className="max-w-2xl mx-auto text-center" style={{ animation: "fade-in 0.4s ease-out" }}>
            <h2 className="projector-heading mb-2">
              Agents Negotiating
            </h2>
            <p className="projector-subheading mb-10 font-mono">
              {(teams.length * (teams.length - 1)) / 2} matches · 3 turns each
            </p>

            {/* Progress ring */}
            <div className="relative w-48 h-48 mx-auto mb-8">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="4" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="var(--accent)" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - (matchProgress ? matchProgress.completed / matchProgress.total : 0))}`}
                  style={{ transition: "stroke-dashoffset 0.7s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-extrabold font-mono tabular-nums">
                  {matchProgress ? matchProgress.completed : 0}
                </span>
                <span className="text-xs text-[var(--muted)] font-mono">
                  / {matchProgress?.total || "?"} done
                </span>
              </div>
            </div>

            {/* Animated dots */}
            <div className="flex justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]"
                  style={{
                    animation: `pulse-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>

            <style jsx>{`
              @keyframes pulse-dot {
                0%, 100% { opacity: 0.3; transform: scale(0.8); }
                50% { opacity: 1; transform: scale(1.2); }
              }
            `}</style>
          </div>
        )}

        {/* GENERATING HIGHLIGHTS */}
        {phase === "generating_highlights" && (
          <div className="max-w-2xl mx-auto text-center" style={{ animation: "fade-in 0.4s ease-out" }}>
            <h2 className="projector-heading mb-2">Matches Complete!</h2>
            <p className="projector-subheading mb-10">
              AI is picking the most dramatic moments...
            </p>

            <div className="inline-block">
              <Sparkles size={48} className="text-[var(--accent)] animate-pulse" />
            </div>
          </div>
        )}

        {/* SHOWING HIGHLIGHTS */}
        {phase === "showing_highlights" && activeSeason && (
          <div className="max-w-6xl mx-auto" style={{ animation: "fade-in 0.4s ease-out" }}>
            <div className="text-center mb-8">
              <h2 className="projector-heading">
                Season {activeSeason.number} <span className="text-[var(--accent)]">Highlights</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <div className="lg:col-span-3">
                <RoundHighlights seasonId={activeSeason.id} round={1} />
              </div>
              <div className="lg:col-span-2">
                <h3 className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest font-mono mb-3">
                  Standings
                </h3>
                <Leaderboard seasonId={activeSeason.id} compact />
              </div>
            </div>

            <div className="mt-10">
              <h3 className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest font-mono mb-3">
                All Matches
              </h3>
              <MatchResults seasonId={activeSeason.id} />
            </div>
          </div>
        )}

        {/* FINAL RESULTS */}
        {phase === "final" && activeSeason && (
          <div className="max-w-6xl mx-auto" style={{ animation: "fade-in 0.4s ease-out" }}>
            <div className="text-center mb-10">
              <h2 className="projector-heading mb-2">
                Final <span className="text-[var(--accent)]">Results</span>
              </h2>
              <p className="projector-subheading font-mono">
                Season {activeSeason.number} Complete
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
              <div>
                <h3 className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest font-mono mb-3">
                  Final Leaderboard
                </h3>
                <Leaderboard seasonId={activeSeason.id} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest font-mono mb-3">
                  Head-to-Head
                </h3>
                <ScoreMatrix seasonId={activeSeason.id} />
              </div>
            </div>

            <div className="mb-10">
              <h3 className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest font-mono mb-3">
                All Matches
              </h3>
              <MatchResults seasonId={activeSeason.id} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// === Team Grid Component ===
function TeamGrid({
  teams,
  readiness,
  compact = false,
}: {
  teams: Team[];
  readiness: Record<string, boolean>;
  compact?: boolean;
}) {
  if (teams.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--muted)] font-mono text-sm">
        Waiting for teams to join...
      </div>
    );
  }

  return (
    <div
      className={`grid gap-2 ${
        compact ? "grid-cols-1" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      }`}
    >
      {teams.map((team) => (
        <div
          key={team.id}
          className={`card flex items-center gap-2.5 transition-all ${
            readiness[team.id]
              ? "border-[var(--cooperate)] bg-[var(--cooperate-bg)]"
              : ""
          } ${compact ? "px-3 py-2" : "px-4 py-3"}`}
          style={{ animation: "fade-in 0.3s ease-out" }}
        >
          <div
            className={`rounded-full shrink-0 ${compact ? "w-3 h-3" : "w-4 h-4"}`}
            style={{ backgroundColor: team.color }}
          />
          <span className={`font-semibold flex-1 truncate ${compact ? "text-xs" : "text-sm"}`}>
            {team.name}
          </span>
          {readiness[team.id] ? (
            <span className="text-[var(--cooperate)] text-sm font-bold shrink-0">&#10003;</span>
          ) : (
            <span className="text-[var(--border-strong)] text-sm shrink-0">&#9675;</span>
          )}
        </div>
      ))}
    </div>
  );
}
