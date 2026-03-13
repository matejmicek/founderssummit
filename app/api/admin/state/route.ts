import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const adminSecret = req.headers.get("x-admin-secret");
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tournamentId = req.nextUrl.searchParams.get("tournamentId");

  const supabase = createServerClient();

  const [tournamentsResult, teamsResult, seasonsResult] = await Promise.all([
    supabase
      .from("tournaments")
      .select("*")
      .order("created_at", { ascending: false }),
    tournamentId
      ? supabase
          .from("teams")
          .select("*")
          .eq("tournament_id", tournamentId)
          .order("created_at")
      : Promise.resolve({ data: [] }),
    tournamentId
      ? supabase
          .from("seasons")
          .select("*")
          .eq("tournament_id", tournamentId)
          .order("number")
      : Promise.resolve({ data: [] }),
  ]);

  // Get readiness status if there's an active season
  let readiness: Record<string, boolean> = {};
  const activeSeason = (seasonsResult.data || []).find(
    (s) => s.status !== "completed"
  );
  if (activeSeason && tournamentId) {
    const { data: playbooks } = await supabase
      .from("playbooks")
      .select("team_id, ready, submitted_at")
      .eq("season_id", activeSeason.id);

    for (const pb of playbooks || []) {
      readiness[pb.team_id] = pb.ready;
    }
  }

  // Get match progress for current round if running
  let matchProgress: { total: number; completed: number } | null = null;
  if (activeSeason && activeSeason.round_status === "running_matches") {
    const { count: total } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("season_id", activeSeason.id)
      .eq("round", activeSeason.current_round);

    const { count: completed } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("season_id", activeSeason.id)
      .eq("round", activeSeason.current_round)
      .eq("status", "completed");

    matchProgress = { total: total || 0, completed: completed || 0 };
  }

  return NextResponse.json({
    tournaments: tournamentsResult.data || [],
    teams: teamsResult.data || [],
    seasons: seasonsResult.data || [],
    readiness,
    matchProgress,
  });
}
