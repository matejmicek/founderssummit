"use client";

import { useRealtimeMatches } from "@/hooks/useRealtimeMatches";
import Link from "next/link";
import { Radio } from "lucide-react";

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
      <div className="text-center text-[var(--muted)] py-8 font-mono text-sm">
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
            className={`card block px-3 py-2.5 transition-all ${
              isActive
                ? "border-[var(--accent)] shadow-md"
                : ""
            }`}
          >
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: match.team_a?.color }} />
                <span className="font-semibold">{match.team_a?.name}</span>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                {isActive && (
                  <span className="text-[var(--accent)] font-bold flex items-center gap-1">
                    <Radio size={10} className="animate-pulse" />
                    LIVE
                  </span>
                )}
                {isDone && (
                  <span className="font-bold tabular-nums">
                    <span className={match.team_a_decision === "cooperate" ? "text-[var(--cooperate)]" : "text-[var(--betray)]"}>
                      {match.team_a_score ?? 0}
                    </span>
                    <span className="text-[var(--muted)] mx-1">&ndash;</span>
                    <span className={match.team_b_decision === "cooperate" ? "text-[var(--cooperate)]" : "text-[var(--betray)]"}>
                      {match.team_b_score ?? 0}
                    </span>
                  </span>
                )}
                {match.status === "pending" && (
                  <span className="text-[var(--muted)]">R{match.round}</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold">{match.team_b?.name}</span>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: match.team_b?.color }} />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
