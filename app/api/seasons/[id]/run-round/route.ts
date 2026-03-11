import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getMatchupsForRound } from "@/lib/engine/matchup";
import { executeMatch, refreshLeaderboard } from "@/lib/engine/executor";

export const maxDuration = 60; // Vercel Pro timeout

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: seasonId } = await params;
  const adminSecret = req.headers.get("x-admin-secret");
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();

  // Get season
  const { data: season, error: seasonError } = await supabase
    .from("seasons")
    .select("*")
    .eq("id", seasonId)
    .single();

  if (seasonError || !season) {
    return NextResponse.json({ error: "Season not found" }, { status: 404 });
  }

  if (season.status !== "running") {
    return NextResponse.json(
      { error: "Season is not in running state" },
      { status: 400 }
    );
  }

  const nextRound = season.current_round + 1;
  if (nextRound > season.total_rounds) {
    return NextResponse.json(
      { error: "All rounds completed" },
      { status: 400 }
    );
  }

  // Get all teams
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, color")
    .order("created_at");

  if (!teams || teams.length < 2) {
    return NextResponse.json({ error: "Need at least 2 teams" }, { status: 400 });
  }

  const teamIds = teams.map((t) => t.id);

  // Get matchups for this round
  const matchups = getMatchupsForRound(teamIds, nextRound - 1);

  // Get current leaderboard for ranks
  const { data: leaderboard } = await supabase
    .from("leaderboard")
    .select("team_id, rank")
    .eq("season_id", parseInt(seasonId));

  const rankMap: Record<string, number> = {};
  for (const row of leaderboard || []) {
    rankMap[row.team_id] = row.rank;
  }

  // Get playbooks for all teams
  const { data: playbooks } = await supabase
    .from("playbooks")
    .select("team_id, personality, strategy, secret_weapon")
    .eq("season_id", parseInt(seasonId));

  const playbookMap: Record<string, { personality: string; strategy: string; secretWeapon: string }> = {};
  for (const pb of playbooks || []) {
    playbookMap[pb.team_id] = {
      personality: pb.personality,
      strategy: pb.strategy,
      secretWeapon: pb.secret_weapon,
    };
  }

  // Default playbook for teams that didn't submit
  const defaultPlaybook = {
    personality: "Calm and analytical negotiator",
    strategy: "Tit-for-Tat: cooperate first, then mirror what the opponent did last time",
    secretWeapon: "",
  };

  // Create match records
  const matchInserts = matchups.map((m) => ({
    season_id: parseInt(seasonId),
    round: nextRound,
    team_a_id: m.teamAId,
    team_b_id: m.teamBId,
    status: "pending" as const,
  }));

  const { data: matchRecords, error: matchError } = await supabase
    .from("matches")
    .insert(matchInserts)
    .select();

  if (matchError || !matchRecords) {
    return NextResponse.json({ error: "Failed to create matches" }, { status: 500 });
  }

  // Update season round counter
  await supabase
    .from("seasons")
    .update({ current_round: nextRound })
    .eq("id", seasonId);

  const secretWeaponUnlocked = season.number >= 2;

  // Execute all matches in parallel
  const teamMap: Record<string, { id: string; name: string }> = {};
  for (const t of teams) {
    teamMap[t.id] = t;
  }

  const results = await Promise.allSettled(
    matchRecords.map((match) => {
      const teamA = teamMap[match.team_a_id];
      const teamB = teamMap[match.team_b_id];
      return executeMatch(
        match.id,
        {
          id: teamA.id,
          name: teamA.name,
          playbook: playbookMap[teamA.id] || defaultPlaybook,
          rank: rankMap[teamA.id] || teams.length,
        },
        {
          id: teamB.id,
          name: teamB.name,
          playbook: playbookMap[teamB.id] || defaultPlaybook,
          rank: rankMap[teamB.id] || teams.length,
        },
        parseInt(seasonId),
        season.number,
        nextRound,
        season.total_rounds,
        teams.length,
        season.points_multiplier,
        secretWeaponUnlocked
      );
    })
  );

  // Mark any failed matches
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === "rejected") {
      const reason = (results[i] as PromiseRejectedResult).reason;
      await supabase
        .from("matches")
        .update({
          status: "error",
          error_message: String(reason).slice(0, 500),
        })
        .eq("id", matchRecords[i].id);
    }
  }

  // Refresh leaderboard
  await refreshLeaderboard(parseInt(seasonId));

  const completed = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({
    round: nextRound,
    matchesCompleted: completed,
    matchesFailed: failed,
  });
}
