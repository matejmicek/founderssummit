import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getDoubleSwissMatchups } from "@/lib/engine/matchup";
import { executeNegotiation, refreshLeaderboard, type TeamData } from "@/lib/engine/executor";
import { generateHighlights, generateTeamHighlights, getHighlightData, getTeamHighlightData } from "@/lib/engine/highlights";
import { generateVoiceoversForHighlights } from "@/lib/engine/voiceover";
import { getRoundRules } from "@/lib/engine/rounds";

export const maxDuration = 300; // 5 min

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: seasonId } = await params;
  const adminSecret = req.headers.get("x-admin-secret");
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured. Set it in environment variables." },
      { status: 500 }
    );
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

  // Get all teams in this tournament
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, color")
    .eq("tournament_id", season.tournament_id)
    .order("created_at");

  if (!teams || teams.length < 2) {
    return NextResponse.json({ error: "Need at least 2 teams" }, { status: 400 });
  }

  // Verify ALL teams are ready
  const { data: readyCheck } = await supabase
    .from("playbooks")
    .select("team_id, ready")
    .eq("season_id", parseInt(seasonId));

  const readyMap: Record<string, boolean> = {};
  for (const pb of readyCheck || []) readyMap[pb.team_id] = pb.ready;

  const unreadyTeams = teams.filter((t) => !readyMap[t.id]);
  if (unreadyTeams.length > 0) {
    return NextResponse.json(
      { error: `Not all teams are ready. Waiting on: ${unreadyTeams.map((t) => t.name).join(", ")}` },
      { status: 400 }
    );
  }

  // Determine round number
  const nextRound = (season.current_round || 0) + 1;

  // Guard against double-submit
  const { count: existingCount } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("season_id", parseInt(seasonId))
    .eq("round", nextRound);

  if (existingCount && existingCount > 0) {
    return NextResponse.json(
      { error: "Matches already created for this round" },
      { status: 409 }
    );
  }

  // Get round rules (escalating)
  const roundRules = getRoundRules(
    nextRound,
    season.round_rules as Partial<import("@/lib/engine/rounds").RoundRules> | undefined
  );

  // Swiss pairing: get leaderboard for rankings, find previous opponents
  const { data: leaderboard } = await supabase
    .from("leaderboard")
    .select("team_id, rank")
    .eq("season_id", parseInt(seasonId))
    .order("rank", { ascending: true });

  const rankMap: Record<string, number> = {};
  for (const row of leaderboard || []) rankMap[row.team_id] = row.rank;

  // Sort teams by rank (best first, unranked last)
  const sortedTeamIds = teams
    .sort((a, b) => (rankMap[a.id] || 999) - (rankMap[b.id] || 999))
    .map((t) => t.id);

  // Get previous opponents
  const { data: prevMatches } = await supabase
    .from("matches")
    .select("team_a_id, team_b_id")
    .eq("season_id", parseInt(seasonId))
    .eq("status", "completed");

  const previousOpponents: Record<string, Set<string>> = {};
  for (const m of prevMatches || []) {
    if (!previousOpponents[m.team_a_id]) previousOpponents[m.team_a_id] = new Set();
    if (!previousOpponents[m.team_b_id]) previousOpponents[m.team_b_id] = new Set();
    previousOpponents[m.team_a_id].add(m.team_b_id);
    previousOpponents[m.team_b_id].add(m.team_a_id);
  }

  // Generate double Swiss pairings (2 opponents per team per round)
  const matchups = getDoubleSwissMatchups(sortedTeamIds, previousOpponents);

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

  // Update season state
  await supabase
    .from("seasons")
    .update({
      current_round: nextRound,
      round_status: "running_matches",
    })
    .eq("id", seasonId);

  // Start negotiations for all matches in background
  after(async () => {
    await startNegotiations(seasonId, season, teams, matchRecords, roundRules, rankMap);
  });

  return NextResponse.json({
    started: true,
    matchesTotal: matchRecords.length,
    teamsCount: teams.length,
    round: nextRound,
    roundLabel: roundRules.label,
  });
}

async function startNegotiations(
  seasonId: string,
  season: { number: number; points_multiplier: number; tournament_id: string },
  teams: { id: string; name: string; color: string }[],
  matchRecords: { id: string; team_a_id: string; team_b_id: string }[],
  roundRules: import("@/lib/engine/rounds").RoundRules,
  rankMap: Record<string, number>
) {
  const supabase = createServerClient();

  try {
    // Get playbooks
    const { data: playbooks } = await supabase
      .from("playbooks")
      .select("team_id, personality, cooperate_strategy, betray_strategy, secret_weapon")
      .eq("season_id", parseInt(seasonId));

    const playbookMap: Record<string, { personality: string; cooperateStrategy: string; betrayStrategy: string; secretWeapon: string }> = {};
    for (const pb of playbooks || []) {
      playbookMap[pb.team_id] = {
        personality: pb.personality,
        cooperateStrategy: pb.cooperate_strategy,
        betrayStrategy: pb.betray_strategy,
        secretWeapon: pb.secret_weapon,
      };
    }

    const defaultPlaybook = {
      personality: "Calm and analytical negotiator",
      cooperateStrategy: "",
      betrayStrategy: "",
      secretWeapon: "",
    };

    const teamMap: Record<string, { id: string; name: string }> = {};
    for (const t of teams) teamMap[t.id] = t;

    // Start turn 1 negotiation for all matches concurrently
    const results = await Promise.allSettled(
      matchRecords.map((match) => {
        const teamA = teamMap[match.team_a_id];
        const teamB = teamMap[match.team_b_id];
        return executeNegotiation(
          match.id,
          1, // Turn 1
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
          season.number,
          teams.length,
          roundRules
        );
      })
    );

    // Mark failed matches
    for (let j = 0; j < results.length; j++) {
      if (results[j].status === "rejected") {
        const reason = (results[j] as PromiseRejectedResult).reason;
        await supabase
          .from("matches")
          .update({ status: "error", error_message: String(reason).slice(0, 500) })
          .eq("id", matchRecords[j].id);
      }
    }
  } catch (error) {
    console.error("Negotiation start failed:", error);
    await supabase
      .from("seasons")
      .update({ round_status: "idle" })
      .eq("id", seasonId);
  }
}
