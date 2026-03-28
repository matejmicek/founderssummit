import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const teamId = cookieStore.get("team_id")?.value;
  if (!teamId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const seasonId = req.nextUrl.searchParams.get("seasonId");
  const round = req.nextUrl.searchParams.get("round");

  if (!seasonId) {
    return NextResponse.json({ error: "seasonId required" }, { status: 400 });
  }

  const supabase = createServerClient();

  // Get all matches where this team participated
  let query = supabase
    .from("matches")
    .select(
      "id, round, status, team_a_id, team_b_id, team_a_score, team_b_score, team_a:teams!matches_team_a_id_fkey(id, name, color), team_b:teams!matches_team_b_id_fkey(id, name, color)"
    )
    .eq("season_id", parseInt(seasonId))
    .eq("status", "completed")
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
    .order("created_at");

  if (round) {
    query = query.eq("round", parseInt(round));
  }

  const { data: matches, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!matches || matches.length === 0) {
    return NextResponse.json({ matches: [] });
  }

  // Get turns for all matches
  const matchIds = matches.map((m) => m.id);
  const { data: allTurns } = await supabase
    .from("match_turns")
    .select(
      "match_id, turn, team_a_decision, team_b_decision, team_a_score, team_b_score, team_a_reasoning, team_b_reasoning"
    )
    .in("match_id", matchIds)
    .order("turn");

  const turnsByMatch: Record<string, typeof allTurns> = {};
  for (const turn of allTurns || []) {
    if (!turnsByMatch[turn.match_id]) turnsByMatch[turn.match_id] = [];
    turnsByMatch[turn.match_id]!.push(turn);
  }

  const result = matches.map((m) => ({
    ...m,
    turns: turnsByMatch[m.id] || [],
  }));

  return NextResponse.json({ matches: result, teamId });
}
