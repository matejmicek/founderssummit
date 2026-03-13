import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { executeMatch } from "@/lib/engine/executor";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const adminSecret = req.headers.get("x-admin-secret");
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();

  // Get first two teams
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, color")
    .order("created_at")
    .limit(2);

  if (!teams || teams.length < 2) {
    return NextResponse.json({ error: "Need at least 2 teams" }, { status: 400 });
  }

  // Get or create a demo season (season 0)
  let { data: season } = await supabase
    .from("seasons")
    .select("*")
    .eq("number", 0)
    .single();

  if (!season) {
    const { data: newSeason } = await supabase
      .from("seasons")
      .insert({ number: 0, status: "running", total_rounds: 1 })
      .select()
      .single();
    season = newSeason;
  }

  if (!season) {
    return NextResponse.json({ error: "Failed to create demo season" }, { status: 500 });
  }

  // Create match record
  const { data: match, error } = await supabase
    .from("matches")
    .insert({
      season_id: season.id,
      round: 1,
      team_a_id: teams[0].id,
      team_b_id: teams[1].id,
    })
    .select()
    .single();

  if (error || !match) {
    return NextResponse.json({ error: "Failed to create match" }, { status: 500 });
  }

  const result = await executeMatch(
    match.id,
    {
      id: teams[0].id,
      name: teams[0].name,
      playbook: {
        personality: "Friendly but cautious diplomat",
        cooperateStrategy: "Start with cooperation, forgive after one round of punishment",
        betrayStrategy: "Punish betrayal immediately, but only for one turn",
        secretWeapon: "",
      },
      rank: 1,
    },
    {
      id: teams[1].id,
      name: teams[1].name,
      playbook: {
        personality: "Cunning strategist who talks big",
        cooperateStrategy: "Build trust in the early turns to set up a big play",
        betrayStrategy: "Betray at the critical moment for maximum points",
        secretWeapon: "",
      },
      rank: 2,
    },
    season.id,
    0, // seasonNumber
    2, // totalTeams
    1, // pointsMultiplier
    false // secretWeaponUnlocked
  );

  return NextResponse.json({ matchId: match.id, result });
}
