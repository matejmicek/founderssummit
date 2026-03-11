"use client";

import { useState, useEffect, useCallback } from "react";

interface Season {
  id: number;
  number: number;
  status: string;
  current_round: number;
  total_rounds: number;
  points_multiplier: number;
}

interface Team {
  id: string;
  name: string;
  color: string;
  join_code: string;
}

export default function AdminControls({ adminSecret }: { adminSecret: string }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");

  const headers = {
    "Content-Type": "application/json",
    "x-admin-secret": adminSecret,
  };

  const fetchData = useCallback(async () => {
    const [teamsRes, seasonsRes] = await Promise.all([
      fetch("/api/admin/create-teams", { method: "GET" }).catch(() => null),
      fetch("/api/leaderboard").catch(() => null),
    ]);
    // We'll refetch teams from the page
  }, []);

  const createTeams = async () => {
    setLoading("teams");
    setMessage("");
    try {
      const res = await fetch("/api/admin/create-teams", {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTeams(data.teams);
      setMessage(`Created ${data.teams.length} teams`);
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
    } finally {
      setLoading("");
    }
  };

  const createSeason = async (number: number, multiplier: number = 1) => {
    setLoading("season");
    setMessage("");
    try {
      const res = await fetch("/api/admin/create-season", {
        method: "POST",
        headers,
        body: JSON.stringify({ number, pointsMultiplier: multiplier }),
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
    setMessage("Running round...");
    try {
      const res = await fetch(`/api/seasons/${seasonId}/run-round`, {
        method: "POST",
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(
        `Round complete: ${data.matchesCompleted} matches, ${data.matchesFailed} failed`
      );
      // Refresh season
      const seasonRes = await fetch(`/api/seasons/${seasonId}`);
      const seasonData = await seasonRes.json();
      setSeasons((prev) =>
        prev.map((s) => (s.id === seasonId ? seasonData.season : s))
      );
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
    } finally {
      setLoading("");
    }
  };

  const runDemo = async () => {
    setLoading("demo");
    setMessage("Running demo match...");
    try {
      const res = await fetch("/api/admin/demo-match", {
        method: "POST",
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(`Demo match: ${data.matchId}`);
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
    } finally {
      setLoading("");
    }
  };

  // Fetch existing data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch("/api/admin/state", { headers });
        const data = await res.json();
        if (data.teams) setTeams(data.teams);
        if (data.seasons) setSeasons(data.seasons);
      } catch {
        // Will be created via admin actions
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8">
      {/* Status message */}
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

      {/* Teams */}
      <section>
        <h2 className="text-lg font-bold mb-3">Teams</h2>
        {teams.length === 0 ? (
          <button
            onClick={createTeams}
            disabled={loading === "teams"}
            className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-light)] text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {loading === "teams" ? "Creating..." : "Create 10 Default Teams"}
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {teams.map((team) => (
              <div
                key={team.id}
                className="flex items-center gap-2 bg-[var(--card)] border border-[var(--card-border)] rounded-lg px-3 py-2"
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: team.color }}
                />
                <span className="text-sm font-medium flex-1">{team.name}</span>
                <code className="text-xs bg-[var(--background)] px-1.5 py-0.5 rounded font-mono">
                  {team.join_code}
                </code>
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
            <div
              key={season.id}
              className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4"
            >
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

              <div className="flex flex-wrap gap-2">
                {season.status === "pending" && (
                  <button
                    onClick={() => updateSeasonStatus(season.id, "building")}
                    disabled={!!loading}
                    className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium hover:bg-yellow-500/30"
                  >
                    Start Building Phase
                  </button>
                )}
                {season.status === "building" && (
                  <button
                    onClick={() => updateSeasonStatus(season.id, "running")}
                    disabled={!!loading}
                    className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded text-xs font-medium hover:bg-green-500/30"
                  >
                    Start Running
                  </button>
                )}
                {season.status === "running" && (
                  <>
                    <button
                      onClick={() => runRound(season.id)}
                      disabled={!!loading}
                      className="px-3 py-1.5 bg-[var(--accent)]/20 text-[var(--accent-light)] rounded text-xs font-medium hover:bg-[var(--accent)]/30"
                    >
                      {loading === `round-${season.id}`
                        ? "Running..."
                        : `Run Round ${season.current_round + 1}`}
                    </button>
                    <button
                      onClick={() => updateSeasonStatus(season.id, "tweaking")}
                      disabled={!!loading}
                      className="px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded text-xs font-medium hover:bg-orange-500/30"
                    >
                      Tweaking Phase
                    </button>
                    <button
                      onClick={() => updateSeasonStatus(season.id, "completed")}
                      disabled={!!loading}
                      className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded text-xs font-medium hover:bg-red-500/30"
                    >
                      End Season
                    </button>
                  </>
                )}
                {season.status === "tweaking" && (
                  <button
                    onClick={() => updateSeasonStatus(season.id, "running")}
                    disabled={!!loading}
                    className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded text-xs font-medium hover:bg-green-500/30"
                  >
                    Resume Running
                  </button>
                )}
              </div>
            </div>
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

      {/* Actions */}
      <section>
        <h2 className="text-lg font-bold mb-3">Actions</h2>
        <div className="flex gap-2">
          <button
            onClick={runDemo}
            disabled={!!loading}
            className="px-4 py-2 bg-[var(--card)] border border-[var(--card-border)] rounded-lg text-sm font-medium hover:border-[var(--accent)]"
          >
            {loading === "demo" ? "Running..." : "Run Demo Match"}
          </button>
        </div>
      </section>
    </div>
  );
}
