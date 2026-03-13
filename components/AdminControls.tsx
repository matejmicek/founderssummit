"use client";

import { useState, useEffect, useCallback } from "react";
import RoundHighlights from "@/components/RoundHighlights";

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

export default function AdminControls({
  adminSecret,
}: {
  adminSecret: string;
}) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(
    null
  );
  const [teams, setTeams] = useState<Team[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [readiness, setReadiness] = useState<Record<string, boolean>>({});
  const [matchProgress, setMatchProgress] = useState<{
    total: number;
    completed: number;
  } | null>(null);
  const [newTournamentName, setNewTournamentName] = useState("");
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-admin-secret": adminSecret,
  };

  const loadState = useCallback(
    async (tournamentId?: string) => {
      try {
        const url = tournamentId
          ? `/api/admin/state?tournamentId=${tournamentId}`
          : "/api/admin/state";
        const res = await fetch(url, {
          headers: { "x-admin-secret": adminSecret },
        });
        const data = await res.json();
        if (data.tournaments) setTournaments(data.tournaments);
        if (data.teams) setTeams(data.teams);
        if (data.seasons) setSeasons(data.seasons);
        if (data.readiness) setReadiness(data.readiness);
        if (data.matchProgress !== undefined)
          setMatchProgress(data.matchProgress);
      } catch {}
    },
    [adminSecret]
  );

  useEffect(() => {
    loadState();
  }, [loadState]);

  useEffect(() => {
    if (activeTournament) {
      loadState(activeTournament.id);
      const interval = setInterval(
        () => loadState(activeTournament.id),
        2000
      );
      return () => clearInterval(interval);
    }
  }, [activeTournament, loadState]);

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
      if (!res.ok) throw new Error(data.error);
      setTournaments((prev) => [data.tournament, ...prev]);
      setActiveTournament(data.tournament);
      setNewTournamentName("");
      setMessage(`Tournament created! Code: ${data.tournament.join_code}`);
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
    } finally {
      setLoading("");
    }
  };

  const createSeason = async (number: number, multiplier: number = 1) => {
    if (!activeTournament) return;
    setLoading("season");
    try {
      const res = await fetch("/api/admin/create-season", {
        method: "POST",
        headers,
        body: JSON.stringify({
          tournamentId: activeTournament.id,
          number,
          pointsMultiplier: multiplier,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSeasons((prev) => [...prev, data.season]);
      setMessage(`Created Season ${number}`);
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
    } finally {
      setLoading("");
    }
  };

  const updateSeasonStatus = async (seasonId: number, status: string) => {
    setLoading(`status-${seasonId}`);
    try {
      const res = await fetch(`/api/seasons/${seasonId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSeasons((prev) =>
        prev.map((s) => (s.id === seasonId ? data.season : s))
      );
      setMessage(`Season status → ${status}`);
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
    } finally {
      setLoading("");
    }
  };

  const runRound = async (seasonId: number) => {
    setLoading(`round-${seasonId}`);
    setMessage("");
    try {
      const res = await fetch(`/api/seasons/${seasonId}/run-round`, {
        method: "POST",
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(
        `Round ${data.round}: ${data.matchesCompleted} matches, ${data.highlightsGenerated} highlights`
      );
      if (activeTournament) loadState(activeTournament.id);
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
    } finally {
      setLoading("");
    }
  };

  const dismissHighlights = async (seasonId: number) => {
    try {
      await fetch(`/api/seasons/${seasonId}/dismiss-highlights`, {
        method: "POST",
        headers,
      });
      if (activeTournament) loadState(activeTournament.id);
    } catch {}
  };

  const readyCount = Object.values(readiness).filter(Boolean).length;
  const totalTeams = teams.length;

  return (
    <div className="space-y-8">
      {message && (
        <div
          className={`px-4 py-2 rounded-lg text-sm ${
            message.startsWith("Error")
              ? "bg-red-500/10 text-[var(--betray)]"
              : "bg-green-500/10 text-[var(--cooperate)]"
          }`}
        >
          {message}
        </div>
      )}

      {/* Tournaments */}
      <section>
        <h2 className="text-lg font-bold mb-3">Tournaments</h2>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newTournamentName}
            onChange={(e) => setNewTournamentName(e.target.value)}
            placeholder="Tournament name..."
            className="flex-1 bg-[var(--card)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
          />
          <button
            onClick={createTournament}
            disabled={!!loading || !newTournamentName.trim()}
            className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-light)] text-white font-medium rounded-lg text-sm disabled:opacity-50"
          >
            {loading === "tournament" ? "..." : "Create"}
          </button>
        </div>
        {tournaments.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTournament(t)}
            className={`w-full text-left flex items-center justify-between bg-[var(--card)] border rounded-lg px-3 py-2.5 mb-1.5 transition-colors ${
              activeTournament?.id === t.id
                ? "border-[var(--accent)]"
                : "border-[var(--card-border)]"
            }`}
          >
            <span className="font-medium text-sm">{t.name}</span>
            <code className="text-xs bg-[var(--background)] px-2 py-0.5 rounded font-mono tracking-wider">
              {t.join_code}
            </code>
          </button>
        ))}
      </section>

      {activeTournament && (
        <>
          {/* Teams with readiness */}
          <section>
            <h2 className="text-lg font-bold mb-3">
              Teams ({totalTeams})
              {totalTeams > 0 && (
                <span className="text-sm font-normal text-[var(--muted)] ml-2">
                  {readyCount}/{totalTeams} ready
                </span>
              )}
            </h2>
            {teams.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Share code:{" "}
                <code className="text-[var(--accent)] font-mono text-lg">
                  {activeTournament.join_code}
                </code>
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center gap-2 bg-[var(--card)] border border-[var(--card-border)] rounded-lg px-3 py-2"
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: team.color }}
                    />
                    <span className="text-sm font-medium flex-1 truncate">
                      {team.name}
                    </span>
                    {readiness[team.id] ? (
                      <span className="text-[var(--cooperate)] text-sm">
                        ✓
                      </span>
                    ) : (
                      <span className="text-[var(--card-border)] text-sm">
                        ○
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Seasons */}
          <section>
            <h2 className="text-lg font-bold mb-3">Seasons</h2>
            <div className="space-y-4">
              {seasons.map((season) => (
                <SeasonCard
                  key={season.id}
                  season={season}
                  loading={loading}
                  readyCount={readyCount}
                  totalTeams={totalTeams}
                  matchProgress={matchProgress}
                  onUpdateStatus={updateSeasonStatus}
                  onRunRound={runRound}
                  onDismissHighlights={dismissHighlights}
                />
              ))}

              <div className="flex gap-2">
                <button
                  onClick={() => createSeason(seasons.length + 1)}
                  disabled={!!loading}
                  className="px-3 py-1.5 bg-[var(--card)] border border-[var(--card-border)] rounded text-xs font-medium hover:border-[var(--accent)]"
                >
                  + New Season
                </button>
                <button
                  onClick={() => createSeason(seasons.length + 1, 2)}
                  disabled={!!loading}
                  className="px-3 py-1.5 bg-[var(--card)] border border-[var(--card-border)] rounded text-xs font-medium hover:border-[var(--accent)]"
                >
                  + Championship (2x)
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SeasonCard({
  season,
  loading,
  readyCount,
  totalTeams,
  matchProgress,
  onUpdateStatus,
  onRunRound,
  onDismissHighlights,
}: {
  season: Season;
  loading: string;
  readyCount: number;
  totalTeams: number;
  matchProgress: { total: number; completed: number } | null;
  onUpdateStatus: (id: number, status: string) => void;
  onRunRound: (id: number) => void;
  onDismissHighlights: (id: number) => void;
}) {
  const isRunningRound = loading === `round-${season.id}`;
  const roundStatus = season.round_status || "idle";

  return (
    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold">
          Season {season.number}
          {season.points_multiplier > 1 && (
            <span className="text-[var(--accent)] ml-2">
              {season.points_multiplier}x
            </span>
          )}
        </h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)]">
          {season.status}
        </span>
      </div>

      <div className="text-sm text-[var(--muted)] mb-3">
        Round {season.current_round} / {season.total_rounds}
      </div>

      {/* Running state: show progress or highlights */}
      {season.status === "running" && (
        <div className="mb-3">
          {/* Match progress bar */}
          {(roundStatus === "running_matches" || isRunningRound) &&
            !matchProgress && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-[var(--accent)]">
                  <div className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-[var(--accent)] border-t-transparent" />
                  Running matches...
                </div>
                <div className="w-full h-2 bg-[var(--background)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--accent)] rounded-full animate-pulse w-1/2" />
                </div>
              </div>
            )}

          {roundStatus === "running_matches" && matchProgress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--accent)]">Running matches</span>
                <span className="text-[var(--muted)] tabular-nums">
                  {matchProgress.completed}/{matchProgress.total}
                </span>
              </div>
              <div className="w-full h-2 bg-[var(--background)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      matchProgress.total > 0
                        ? (matchProgress.completed / matchProgress.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}

          {roundStatus === "generating_highlights" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-[var(--accent-light)]">
                <div className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-[var(--accent-light)] border-t-transparent" />
                AI is picking the best moments...
              </div>
              <div className="w-full h-2 bg-[var(--background)] rounded-full overflow-hidden">
                <div className="h-full bg-[var(--accent-light)] rounded-full animate-pulse w-3/4" />
              </div>
            </div>
          )}

          {roundStatus === "showing_highlights" && (
            <div className="space-y-3">
              <RoundHighlights
                seasonId={season.id}
                round={season.current_round}
              />
              <button
                onClick={() => onDismissHighlights(season.id)}
                className="px-3 py-1.5 bg-[var(--accent)]/20 text-[var(--accent-light)] rounded text-xs font-medium hover:bg-[var(--accent)]/30"
              >
                Dismiss Highlights
              </button>
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-2">
        {season.status === "pending" && (
          <button
            onClick={() => onUpdateStatus(season.id, "building")}
            disabled={!!loading}
            className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium hover:bg-yellow-500/30"
          >
            Start Building Phase
          </button>
        )}
        {season.status === "building" && (
          <button
            onClick={() => onUpdateStatus(season.id, "running")}
            disabled={!!loading}
            className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded text-xs font-medium hover:bg-green-500/30"
          >
            Start Running
          </button>
        )}
        {season.status === "running" && roundStatus === "idle" && (
          <>
            <button
              onClick={() => onRunRound(season.id)}
              disabled={!!loading}
              className={`px-4 py-2 rounded text-sm font-bold transition-all ${
                readyCount === totalTeams && totalTeams > 0
                  ? "bg-[var(--cooperate)] text-white shadow-[0_0_16px_rgba(34,197,94,0.3)]"
                  : "bg-[var(--accent)]/20 text-[var(--accent-light)] hover:bg-[var(--accent)]/30"
              }`}
            >
              {isRunningRound
                ? "Running..."
                : `Run Round ${season.current_round + 1}`}
              {readyCount > 0 && totalTeams > 0 && (
                <span className="ml-1.5 text-xs opacity-80">
                  ({readyCount}/{totalTeams})
                </span>
              )}
            </button>
            <button
              onClick={() => onUpdateStatus(season.id, "tweaking")}
              disabled={!!loading}
              className="px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded text-xs font-medium hover:bg-orange-500/30"
            >
              Tweaking Phase
            </button>
            <button
              onClick={() => onUpdateStatus(season.id, "completed")}
              disabled={!!loading}
              className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded text-xs font-medium hover:bg-red-500/30"
            >
              End Season
            </button>
          </>
        )}
        {season.status === "tweaking" && (
          <button
            onClick={() => onUpdateStatus(season.id, "running")}
            disabled={!!loading}
            className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded text-xs font-medium hover:bg-green-500/30"
          >
            Resume Running
          </button>
        )}
      </div>
    </div>
  );
}
