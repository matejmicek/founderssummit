"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase";

interface Match {
  id: string;
  season_id: number;
  round: number;
  team_a_id: string;
  team_b_id: string;
  team_a_decision: string | null;
  team_b_decision: string | null;
  team_a_score: number | null;
  team_b_score: number | null;
  status: string;
  team_a: { id: string; name: string; color: string };
  team_b: { id: string; name: string; color: string };
}

export function useRealtimeMatches(seasonId: number | null) {
  const [matches, setMatches] = useState<Match[]>([]);

  const fetchMatches = useCallback(async () => {
    if (!seasonId) return;
    const supabase = createBrowserClient();
    const { data } = await supabase
      .from("matches")
      .select("*, team_a:teams!matches_team_a_id_fkey(id, name, color), team_b:teams!matches_team_b_id_fkey(id, name, color)")
      .eq("season_id", seasonId)
      .order("round", { ascending: false })
      .order("created_at", { ascending: false });
    setMatches(data || []);
  }, [seasonId]);

  useEffect(() => {
    fetchMatches();

    if (!seasonId) return;

    // Poll every 3s as a fallback in case realtime misses events
    const interval = setInterval(fetchMatches, 3000);

    const supabase = createBrowserClient();
    const channel = supabase
      .channel("match-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `season_id=eq.${seasonId}`,
        },
        () => {
          fetchMatches();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [seasonId, fetchMatches]);

  return { matches };
}
