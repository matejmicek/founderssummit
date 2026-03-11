"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase";

interface LeaderboardEntry {
  team_id: string;
  season_id: number;
  total_score: number;
  matches_played: number;
  cooperate_count: number;
  betray_count: number;
  rank: number;
  previous_rank: number | null;
  team: { id: string; name: string; color: string };
}

export function useRealtimeLeaderboard(seasonId: number | null) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    if (!seasonId) return;
    try {
      const res = await fetch(`/api/leaderboard?seasonId=${seasonId}`);
      const data = await res.json();
      setEntries(data.leaderboard || []);
    } catch (e) {
      console.error("Failed to fetch leaderboard:", e);
    } finally {
      setLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    fetchLeaderboard();

    if (!seasonId) return;

    const supabase = createBrowserClient();
    const channel = supabase
      .channel("leaderboard-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leaderboard",
          filter: `season_id=eq.${seasonId}`,
        },
        () => {
          fetchLeaderboard();
        }
      )
      .subscribe();

    // Fallback polling every 10s
    const interval = setInterval(fetchLeaderboard, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [seasonId, fetchLeaderboard]);

  return { entries, loading };
}
