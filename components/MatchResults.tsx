"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface TurnData {
  turn: number;
  team_a_decision: string;
  team_b_decision: string;
  team_a_score: number;
  team_b_score: number;
  team_a_reasoning?: string;
  team_b_reasoning?: string;
}

interface MatchData {
  id: string;
  status: string;
  team_a_score: number | null;
  team_b_score: number | null;
  team_a: { id: string; name: string; color: string };
  team_b: { id: string; name: string; color: string };
  turns: TurnData[];
}

interface Props {
  seasonId: number;
}

export default function MatchResults({ seasonId }: Props) {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMatches = useCallback(async () => {
    try {
      const res = await fetch(`/api/seasons/${seasonId}/matches`);
      const data = await res.json();
      setMatches(data.matches || []);
    } catch {}
    setLoading(false);
  }, [seasonId]);

  useEffect(() => {
    fetchMatches();
    const interval = setInterval(fetchMatches, 3000);
    return () => clearInterval(interval);
  }, [fetchMatches]);

  if (loading) {
    return (
      <div className="text-center py-6 text-[var(--muted)] text-sm font-mono">
        Loading matches...
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-6 text-[var(--muted)] text-sm font-mono">
        No matches played yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {matches.map((match) => (
        <MatchRow key={match.id} match={match} />
      ))}
    </div>
  );
}

function MatchRow({ match }: { match: MatchData }) {
  const isComplete = match.status === "completed";

  return (
    <div className="card p-3 hover:border-[var(--accent)] transition-colors">
      {/* Teams header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: match.team_a.color }} />
          <span className="text-sm font-semibold">{match.team_a.name}</span>
        </div>

        {isComplete && (
          <div className="text-sm font-extrabold tabular-nums font-mono">
            <span className={match.team_a_score! > match.team_b_score! ? "text-[var(--foreground)]" : "text-[var(--muted)]"}>
              {match.team_a_score}
            </span>
            <span className="text-[var(--muted)] mx-1.5">&ndash;</span>
            <span className={match.team_b_score! > match.team_a_score! ? "text-[var(--foreground)]" : "text-[var(--muted)]"}>
              {match.team_b_score}
            </span>
          </div>
        )}

        {!isComplete && (
          <span className="text-xs text-[var(--accent)] font-mono font-bold animate-pulse uppercase">
            {match.status === "talking" ? "Live" : match.status === "deciding" ? "Deciding" : "Pending"}
          </span>
        )}

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{match.team_b.name}</span>
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: match.team_b.color }} />
        </div>
      </div>

      {/* Turn cards */}
      <div className="grid grid-cols-3 gap-1.5">
        {[1, 2, 3].map((turnNum) => {
          const turn = match.turns.find((t) => t.turn === turnNum);

          if (!turn) {
            return (
              <div key={turnNum} className="rounded-lg bg-[var(--background)] border border-[var(--border)] p-2 text-center">
                <div className="text-[9px] text-[var(--muted)] uppercase tracking-widest font-mono mb-1">
                  T{turnNum}
                </div>
                <div className="text-xs text-[var(--muted)]">&mdash;</div>
              </div>
            );
          }

          const aColor = turn.team_a_decision === "cooperate" ? "var(--cooperate)" : "var(--betray)";
          const bColor = turn.team_b_decision === "cooperate" ? "var(--cooperate)" : "var(--betray)";

          return (
            <Link
              key={turnNum}
              href={`/match/${match.id}`}
              className="rounded-lg bg-[var(--background)] border border-[var(--border)] p-2 text-center hover:border-[var(--accent)] transition-colors"
            >
              <div className="text-[9px] text-[var(--muted)] uppercase tracking-widest font-mono mb-1">
                T{turnNum}
              </div>
              <div className="flex items-center justify-center gap-1 text-xs font-bold font-mono">
                <span style={{ color: aColor }}>
                  {turn.team_a_decision === "cooperate" ? "C" : "B"}
                </span>
                <span className="text-[var(--muted)] text-[10px]">vs</span>
                <span style={{ color: bColor }}>
                  {turn.team_b_decision === "cooperate" ? "C" : "B"}
                </span>
              </div>
              <div className="text-[10px] text-[var(--muted)] tabular-nums font-mono mt-0.5">
                +{turn.team_a_score} / +{turn.team_b_score}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
