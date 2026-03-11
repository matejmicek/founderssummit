"use client";

import { useRealtimeLeaderboard } from "@/hooks/useRealtimeLeaderboard";

interface Props {
  seasonId: number | null;
  compact?: boolean;
}

export default function Leaderboard({ seasonId, compact = false }: Props) {
  const { entries, loading } = useRealtimeLeaderboard(seasonId);

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-12 bg-[var(--card)] rounded-lg"
          />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center text-[var(--muted)] py-8">
        No scores yet. Waiting for matches...
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {entries.map((entry) => {
        const rankDelta =
          entry.previous_rank != null
            ? entry.previous_rank - entry.rank
            : 0;

        return (
          <div
            key={entry.team_id}
            className={`flex items-center gap-3 bg-[var(--card)] border border-[var(--card-border)] rounded-lg transition-all duration-500 ${
              compact ? "px-3 py-2" : "px-4 py-3"
            }`}
          >
            <span
              className={`font-bold tabular-nums ${
                compact ? "text-lg w-7" : "text-2xl w-10"
              }`}
            >
              {entry.rank}
            </span>

            <div
              className={`rounded-full ${compact ? "w-3 h-3" : "w-4 h-4"}`}
              style={{ backgroundColor: entry.team?.color || "#6366f1" }}
            />

            <span className={`font-medium flex-1 ${compact ? "text-sm" : "text-lg"}`}>
              {entry.team?.name || "Unknown"}
            </span>

            {rankDelta !== 0 && (
              <span
                className={`text-xs font-medium ${
                  rankDelta > 0
                    ? "text-[var(--cooperate)]"
                    : "text-[var(--betray)]"
                }`}
              >
                {rankDelta > 0 ? `+${rankDelta}` : rankDelta}
              </span>
            )}

            {!compact && (
              <div className="text-right text-xs text-[var(--muted)]">
                <span className="text-[var(--cooperate)]">
                  C:{entry.cooperate_count}
                </span>{" "}
                <span className="text-[var(--betray)]">
                  B:{entry.betray_count}
                </span>
              </div>
            )}

            <span
              className={`font-bold tabular-nums ${
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
