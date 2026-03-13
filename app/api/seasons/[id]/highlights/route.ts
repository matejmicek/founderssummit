import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: seasonId } = await params;
  const round = req.nextUrl.searchParams.get("round");

  const supabase = createServerClient();

  let query = supabase
    .from("highlights")
    .select(
      "*, voiceover_script, voiceover_audio_base64, match:matches(id, team_a:teams!matches_team_a_id_fkey(id, name, color), team_b:teams!matches_team_b_id_fkey(id, name, color), team_a_decision, team_b_decision, team_a_score, team_b_score)"
    )
    .eq("season_id", parseInt(seasonId))
    .order("ranking");

  if (round) {
    query = query.eq("round", parseInt(round));
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch turns for each highlight's match
  const matchIds = (data || [])
    .map((h) => h.match_id)
    .filter(Boolean);

  let turnsMap: Record<string, { turn: number; team_a_decision: string; team_b_decision: string; team_a_score: number; team_b_score: number }[]> = {};

  if (matchIds.length > 0) {
    const { data: turns } = await supabase
      .from("match_turns")
      .select("match_id, turn, team_a_decision, team_b_decision, team_a_score, team_b_score, team_a_reasoning, team_b_reasoning")
      .in("match_id", matchIds)
      .order("turn");

    for (const t of turns || []) {
      if (!turnsMap[t.match_id]) turnsMap[t.match_id] = [];
      turnsMap[t.match_id].push(t);
    }
  }

  // Attach turns to each highlight
  const highlights = (data || []).map((h) => ({
    ...h,
    turns: turnsMap[h.match_id] || [],
  }));

  return NextResponse.json({ highlights });
}
