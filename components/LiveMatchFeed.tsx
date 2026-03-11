"use client";

import { useRealtimeMatches } from "@/hooks/useRealtimeMatches";
import Link from "next/link";

interface Props {
  seasonId: number | null;
  teamId?: string;
}

export default function LiveMatchFeed({ seasonId, teamId }: Props) {
  const { matches } = useRealtimeMatches(seasonId);

  const filtered = teamId
    ? matches.filter(
        (m) => m.team_a_id === teamId || m.team_b_id === teamId
      )
    : matches;

  if (filtered.length === 0) {
    return (
      <div className="text-center text-[var(--muted)] py-8">
        No matches yet. Waiting for the round to start...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map((match) => {
        const isActive = match.status === "talking" || match.status === "deciding";
        const isDone = match.status === "completed";

        return (
          <Link
            key={match.id}
            href={`/match/${match.id}`}
            className={`block bg-[var(--card)] border rounded-lg px-3 py-2.5 transition-all ${
              isActive
                ? "border-[var(--accent)] shadow-[0_0_12px_rgba(99,102,241,0.15)]"
                : "border-[var(--card-border)]"
            }`}
          >
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: match.team_a?.color }}
                />
                <span className="font-medium">{match.team_a?.name}</span>
              </div>

              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                {isActive && (
                  <span className="text-[var(--accent)] animate-pulse">
                    LIVE
                  </span>
                )}
                {isDone && (
                  <span className="font-bold">
                    <span
                      className={
                        match.team_a_decision === "cooperate"
                          ? "text-[var(--cooperate)]"
                          : "text-[var(--betray)]"
                      }
                    >
                      {(match.team_a_score ?? 0)}
                    </span>
                    {" - "}
                    <span
                      className={
                        match.team_b_decision === "cooperate"
                          ? "text-[var(--cooperate)]"
                          : "text-[var(--betray)]"
                      }
                    >
                      {(match.team_b_score ?? 0)}
                    </span>
                  </span>
                )}
                {match.status === "pending" && (
                  <span>R{match.round}</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="font-medium">{match.team_b?.name}</span>
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: match.team_b?.color }}
                />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
