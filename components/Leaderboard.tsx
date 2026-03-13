"use client";

import { useRealtimeLeaderboard } from "@/hooks/useRealtimeLeaderboard";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  seasonId: number | null;
  compact?: boolean;
}

export default function Leaderboard({ seasonId, compact = false }: Props) {
  const { entries, loading } = useRealtimeLeaderboard(seasonId);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card h-14 animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center text-[var(--muted)] py-8 font-mono text-sm">
        No scores yet. Waiting for matches...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry, idx) => {
        const rankDelta =
          entry.previous_rank != null
            ? entry.previous_rank - entry.rank
            : 0;

        const isTop3 = entry.rank <= 3;

        return (
          <div
            key={entry.team_id}
            className={`card flex items-center gap-3 transition-all duration-500 ${
              compact ? "px-3 py-2.5" : "px-5 py-4"
            } ${isTop3 && !compact ? "border-[var(--accent)]" : ""}`}
          >
            {/* Rank */}
            <span
              className={`font-extrabold tabular-nums font-mono ${
                compact ? "text-lg w-7" : "text-2xl w-10"
              } ${entry.rank === 1 ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}
            >
              {entry.rank}
            </span>

            {/* Team color dot */}
            <div
              className={`rounded-full shrink-0 ${compact ? "w-3 h-3" : "w-4 h-4"}`}
              style={{ backgroundColor: entry.team?.color || "#F58221" }}
            />

            {/* Team name */}
            <span className={`font-semibold flex-1 truncate ${compact ? "text-sm" : "text-lg"}`}>
              {entry.team?.name || "Unknown"}
            </span>

            {/* Rank change */}
            {rankDelta !== 0 && (
              <span
                className={`text-xs font-semibold font-mono flex items-center gap-0.5 ${
                  rankDelta > 0
                    ? "text-[var(--cooperate)]"
                    : "text-[var(--betray)]"
                }`}
              >
                {rankDelta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {Math.abs(rankDelta)}
              </span>
            )}

            {/* C/B counts */}
            {!compact && (
              <div className="text-right text-xs font-mono tabular-nums text-[var(--muted)]">
                <span className="text-[var(--cooperate)]">C:{entry.cooperate_count}</span>{" "}
                <span className="text-[var(--betray)]">B:{entry.betray_count}</span>
              </div>
            )}

            {/* Score */}
            <span
              className={`font-extrabold tabular-nums font-mono ${
                compact ? "text-base" : "text-xl"
              }`}
            >
              {entry.total_score}
            </span>
          </div>
        );
      })}
    </div>
  );
}
