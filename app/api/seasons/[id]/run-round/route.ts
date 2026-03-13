import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getAllMatchups } from "@/lib/engine/matchup";
import { executeMatch, refreshLeaderboard } from "@/lib/engine/executor";
import { generateHighlights, getHighlightData } from "@/lib/engine/highlights";
import { generateVoiceoversForHighlights } from "@/lib/engine/voiceover";

export const maxDuration = 300; // 5 min — 15 matches × 3 turns each

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
      { error: "OPENAI_API_KEY not configured. Set it in Vercel environment variables." },
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

  // === All validations passed. Start the matches. ===
  await supabase
    .from("seasons")
    .update({ current_round: 1, round_status: "running_matches" })
    .eq("id", seasonId);

  try {
    // Generate ALL matchups (every team vs every other team)
    const teamIds = teams.map((t) => t.id);
    const matchups = getAllMatchups(teamIds);

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
      throw new Error("Failed to create matches");
    }

    const secretWeaponUnlocked = season.number >= 2;
    const teamMap: Record<string, { id: string; name: string }> = {};
    for (const t of teams) {
      teamMap[t.id] = t;
    }

    // Execute all matches in parallel
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
          teams.length,
          season.points_multiplier,
          secretWeaponUnlocked
        );
      })
    );

    // Mark failed matches
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

    // === PHASE 2.5: generating voiceovers per highlight ===
    try {
      const highlightData = await getHighlightData(parseInt(seasonId), 1);
      await generateVoiceoversForHighlights(highlightData);
    } catch (e) {
      console.error("Voiceover generation failed:", e);
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

    return NextResponse.json({
      matchesTotal: matchRecords.length,
      matchesCompleted: completed,
      matchesFailed: failed,
      highlightsGenerated: highlightsCount,
    });
  } catch (error) {
    console.error("Round execution failed:", error);
    await supabase
      .from("seasons")
      .update({ round_status: "idle", current_round: 0 })
      .eq("id", seasonId);

    return NextResponse.json(
      { error: `Round failed: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
