import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getAllMatchups } from "@/lib/engine/matchup";
import { executeMatch, refreshLeaderboard } from "@/lib/engine/executor";
import { generateHighlights, generateTeamHighlights, getHighlightData, getTeamHighlightData } from "@/lib/engine/highlights";
import { generateVoiceoversForHighlights } from "@/lib/engine/voiceover";

export const maxDuration = 300; // 5 min

const MATCH_BATCH_SIZE = 10; // Process 10 matches concurrently

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: seasonId } = await params;
  const adminSecret = req.headers.get("x-admin-secret");
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured. Set it in environment variables." },
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
    return NextResponse.json(
      { error: "Need at least 2 teams" },
      { status: 400 }
    );
  }

  // Verify ALL teams are ready BEFORE changing any state
  const { data: readyCheck } = await supabase
    .from("playbooks")
    .select("team_id, ready")
    .eq("season_id", parseInt(seasonId));

  const readyMap: Record<string, boolean> = {};
  for (const pb of readyCheck || []) {
    readyMap[pb.team_id] = pb.ready;
  }

  const unreadyTeams = teams.filter((t) => !readyMap[t.id]);
  if (unreadyTeams.length > 0) {
    return NextResponse.json(
      {
        error: `Not all teams are ready. Waiting on: ${unreadyTeams.map((t) => t.name).join(", ")}`,
      },
      { status: 400 }
    );
  }

  // === All validations passed. Create matches and return immediately. ===

  // Guard against double-submit: if matches already exist for this season's round, reject
  const { count: existingCount } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("season_id", parseInt(seasonId))
    .eq("round", 1);

  if (existingCount && existingCount > 0) {
    return NextResponse.json(
      { error: "Matches already created for this round" },
      { status: 409 }
    );
  }

  // Generate ALL matchups (every team vs every other team)
  const teamIds = teams.map((t) => t.id);
  const matchups = getAllMatchups(teamIds);

  // Create all match records at once
  const matchInserts = matchups.map((m) => ({
    season_id: parseInt(seasonId),
    round: 1,
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

  await supabase
    .from("seasons")
    .update({ current_round: 1, round_status: "running_matches" })
    .eq("id", seasonId);

  // Return immediately — process matches in the background
  after(async () => {
    await processRound(seasonId, season, teams, matchRecords);
  });

  return NextResponse.json({
    started: true,
    matchesTotal: matchRecords.length,
    teamsCount: teams.length,
  });
}

async function processRound(
  seasonId: string,
  season: { number: number; points_multiplier: number; tournament_id: string },
  teams: { id: string; name: string; color: string }[],
  matchRecords: { id: string; team_a_id: string; team_b_id: string }[]
) {
  const supabase = createServerClient();

  try {
    // Get current leaderboard for ranks
    const { data: leaderboard } = await supabase
      .from("leaderboard")
      .select("team_id, rank")
      .eq("season_id", parseInt(seasonId));

    const rankMap: Record<string, number> = {};
    for (const row of leaderboard || []) {
      rankMap[row.team_id] = row.rank;
    }

    // Get playbooks
    const { data: playbooks } = await supabase
      .from("playbooks")
      .select("team_id, personality, cooperate_strategy, betray_strategy, secret_weapon")
      .eq("season_id", parseInt(seasonId));

    const playbookMap: Record<
      string,
      { personality: string; cooperateStrategy: string; betrayStrategy: string; secretWeapon: string }
    > = {};
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
      cooperateStrategy: "Cooperate first, then mirror what the opponent did last time",
      betrayStrategy: "Betray if the opponent betrayed you last turn",
      secretWeapon: "",
    };

    const secretWeaponUnlocked = season.number >= 2;
    const teamMap: Record<string, { id: string; name: string }> = {};
    for (const t of teams) {
      teamMap[t.id] = t;
    }

    // Process matches in batches
    for (let i = 0; i < matchRecords.length; i += MATCH_BATCH_SIZE) {
      const batch = matchRecords.slice(i, i + MATCH_BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map((match) => {
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
            teams.length,
            season.points_multiplier,
            secretWeaponUnlocked
          );
        })
      );

      // Mark failed matches
      for (let j = 0; j < results.length; j++) {
        if (results[j].status === "rejected") {
          const reason = (results[j] as PromiseRejectedResult).reason;
          await supabase
            .from("matches")
            .update({
              status: "error",
              error_message: String(reason).slice(0, 500),
            })
            .eq("id", batch[j].id);
        }
      }
    }

    // Refresh leaderboard
    await refreshLeaderboard(parseInt(seasonId));

    // === PHASE 2: generating_highlights ===
    await supabase
      .from("seasons")
      .update({ round_status: "generating_highlights" })
      .eq("id", seasonId);

    let highlightsCount = 0;
    try {
      highlightsCount = await generateHighlights(parseInt(seasonId), 1);
    } catch (e) {
      console.error("Highlight generation failed:", e);
    }

    // Generate voiceovers per highlight
    try {
      const highlightData = await getHighlightData(parseInt(seasonId), 1);
      await generateVoiceoversForHighlights(highlightData);
    } catch (e) {
      console.error("Voiceover generation failed:", e);
    }

    // Generate team-specific highlights
    try {
      await generateTeamHighlights(parseInt(seasonId), 1);
    } catch (e) {
      console.error("Team highlight generation failed:", e);
    }

    // Generate voiceovers for team highlights
    try {
      const teamHighlightData = await getTeamHighlightData(parseInt(seasonId), 1);
      await generateVoiceoversForHighlights(teamHighlightData);
    } catch (e) {
      console.error("Team voiceover generation failed:", e);
    }

    // === PHASE 3: showing_highlights ===
    await supabase
      .from("seasons")
      .update({ round_status: "showing_highlights" })
      .eq("id", seasonId);

    // Reset all team readiness
    await supabase
      .from("playbooks")
      .update({ ready: false })
      .eq("season_id", parseInt(seasonId));

  } catch (error) {
    console.error("Round execution failed:", error);
    await supabase
      .from("seasons")
      .update({ round_status: "idle", current_round: 0 })
      .eq("id", seasonId);
  }
}
