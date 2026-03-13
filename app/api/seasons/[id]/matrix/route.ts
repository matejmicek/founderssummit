import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: seasonId } = await params;
  const supabase = createServerClient();

  // Get season to find tournament
  const { data: season } = await supabase
    .from("seasons")
    .select("tournament_id")
    .eq("id", seasonId)
    .single();

  if (!season) {
    return NextResponse.json({ error: "Season not found" }, { status: 404 });
  }

  // Get all teams in this tournament
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, color")
    .eq("tournament_id", season.tournament_id)
    .order("created_at");

  // Get all completed matches
  const { data: matches } = await supabase
    .from("matches")
    .select(
      "team_a_id, team_b_id, team_a_decision, team_b_decision, team_a_score, team_b_score"
    )
    .eq("season_id", parseInt(seasonId))
    .eq("status", "completed");

  // Build matrix: cells[teamA][teamB] = { myScore, theirScore, myDecision, theirDecision }
  const cells: Record<
    string,
    Record<
      string,
      {
        myScore: number;
        theirScore: number;
        myDecision: string;
        theirDecision: string;
        rounds: number;
      }
    >
  > = {};

  for (const m of matches || []) {
    // A's perspective
    if (!cells[m.team_a_id]) cells[m.team_a_id] = {};
    if (!cells[m.team_a_id][m.team_b_id]) {
      cells[m.team_a_id][m.team_b_id] = {
        myScore: 0,
        theirScore: 0,
        myDecision: "",
        theirDecision: "",
        rounds: 0,
      };
    }
    cells[m.team_a_id][m.team_b_id].myScore += m.team_a_score || 0;
    cells[m.team_a_id][m.team_b_id].theirScore += m.team_b_score || 0;
    cells[m.team_a_id][m.team_b_id].myDecision = m.team_a_decision || "";
    cells[m.team_a_id][m.team_b_id].theirDecision = m.team_b_decision || "";
    cells[m.team_a_id][m.team_b_id].rounds += 1;

    // B's perspective
    if (!cells[m.team_b_id]) cells[m.team_b_id] = {};
    if (!cells[m.team_b_id][m.team_a_id]) {
      cells[m.team_b_id][m.team_a_id] = {
        myScore: 0,
        theirScore: 0,
        myDecision: "",
        theirDecision: "",
        rounds: 0,
      };
    }
    cells[m.team_b_id][m.team_a_id].myScore += m.team_b_score || 0;
    cells[m.team_b_id][m.team_a_id].theirScore += m.team_a_score || 0;
    cells[m.team_b_id][m.team_a_id].myDecision = m.team_b_decision || "";
    cells[m.team_b_id][m.team_a_id].theirDecision = m.team_a_decision || "";
    cells[m.team_b_id][m.team_a_id].rounds += 1;
  }

  return NextResponse.json({ teams: teams || [], cells });
}
