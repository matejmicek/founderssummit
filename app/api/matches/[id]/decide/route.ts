import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { processTurnResult, executeNegotiation, refreshLeaderboard, type TeamData } from "@/lib/engine/executor";
import { generateHighlights, generateTeamHighlights, getHighlightData, getTeamHighlightData } from "@/lib/engine/highlights";
import { generateVoiceoversForHighlights } from "@/lib/engine/voiceover";
import { getRoundRules } from "@/lib/engine/rounds";
import type { Decision } from "@/lib/engine/scoring";

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: matchId } = await params;
  const body = await req.json();
  const { teamId, decision } = body as { teamId: string; decision: string };

  if (!teamId || !decision) {
    return NextResponse.json({ error: "teamId and decision required" }, { status: 400 });
  }
  if (decision !== "cooperate" && decision !== "betray") {
    return NextResponse.json({ error: "decision must be 'cooperate' or 'betray'" }, { status: 400 });
  }

  const supabase = createServerClient();

  // Get match
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("*, seasons!inner(number, points_multiplier, round_rules, tournament_id)")
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  if (match.status !== "deciding") {
    return NextResponse.json({ error: "Match is not in deciding state" }, { status: 400 });
  }

  // Verify team is in this match
  if (match.team_a_id !== teamId && match.team_b_id !== teamId) {
    return NextResponse.json({ error: "Team not in this match" }, { status: 403 });
  }

  const currentTurn = match.current_turn || 1;

  // Check if already submitted for this turn
  const { data: existing } = await supabase
    .from("team_decisions")
    .select("id")
    .eq("match_id", matchId)
    .eq("turn", currentTurn)
    .eq("team_id", teamId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Already submitted decision for this turn" }, { status: 409 });
  }

  // Store decision
  await supabase.from("team_decisions").insert({
    match_id: matchId,
    turn: currentTurn,
    team_id: teamId,
    decision,
    effective_decision: decision, // noise applied later in processTurnResult
  });

  // Check if both teams have decided
  const { data: allDecisions } = await supabase
    .from("team_decisions")
    .select("team_id, decision")
    .eq("match_id", matchId)
    .eq("turn", currentTurn);

  if (!allDecisions || allDecisions.length < 2) {
    // Waiting for other team
    return NextResponse.json({
      submitted: true,
      waiting: true,
      message: "Waiting for opponent's decision...",
    });
  }

  // Both teams have decided — process the turn
  const season = match.seasons as unknown as {
    number: number;
    points_multiplier: number;
    round_rules: Record<string, unknown>;
    tournament_id: string;
  };

  const roundRules = getRoundRules(
    match.round || 1,
    season.round_rules as Partial<import("@/lib/engine/rounds").RoundRules> | undefined
  );

  const decisionA = allDecisions.find((d) => d.team_id === match.team_a_id);
  const decisionB = allDecisions.find((d) => d.team_id === match.team_b_id);

  if (!decisionA || !decisionB) {
    return NextResponse.json({ error: "Decision data inconsistency" }, { status: 500 });
  }

  const result = await processTurnResult(
    matchId,
    currentTurn,
    match.team_a_id,
    match.team_b_id,
    decisionA.decision as Decision,
    decisionB.decision as Decision,
    season.points_multiplier * roundRules.payoffMultiplier,
    roundRules.noiseChance
  );

  if (result.complete) {
    // Match is done — check if all matches in this round are complete
    after(async () => {
      await checkRoundComplete(match.season_id, season.tournament_id);
    });

    return NextResponse.json({
      submitted: true,
      waiting: false,
      turnComplete: true,
      matchComplete: true,
      teamAScore: result.teamAScore,
      teamBScore: result.teamBScore,
    });
  }

  // Start next turn's negotiation in background
  const nextTurn = currentTurn + 1;
  after(async () => {
    try {
      // Get team data for negotiation
      const { data: teams } = await supabase
        .from("teams")
        .select("id, name")
        .in("id", [match.team_a_id, match.team_b_id]);

      const { data: playbooks } = await supabase
        .from("playbooks")
        .select("team_id, personality, cooperate_strategy, betray_strategy, secret_weapon")
        .eq("season_id", match.season_id)
        .in("team_id", [match.team_a_id, match.team_b_id]);

      const { data: leaderboard } = await supabase
        .from("leaderboard")
        .select("team_id, rank")
        .eq("season_id", match.season_id);

      const rankMap: Record<string, number> = {};
      for (const row of leaderboard || []) rankMap[row.team_id] = row.rank;

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

      const teamA = teams?.find((t) => t.id === match.team_a_id);
      const teamB = teams?.find((t) => t.id === match.team_b_id);

      if (teamA && teamB) {
        const teamCount = teams?.length || 2;
        await executeNegotiation(
          matchId,
          nextTurn,
          {
            id: teamA.id,
            name: teamA.name,
            playbook: playbookMap[teamA.id] || defaultPlaybook,
            rank: rankMap[teamA.id] || teamCount,
          },
          {
            id: teamB.id,
            name: teamB.name,
            playbook: playbookMap[teamB.id] || defaultPlaybook,
            rank: rankMap[teamB.id] || teamCount,
          },
          season.number,
          teamCount,
          roundRules
        );
      }
    } catch (err) {
      console.error("Failed to start next turn negotiation:", err);
      await supabase
        .from("matches")
        .update({ status: "error", error_message: String(err).slice(0, 500) })
        .eq("id", matchId);
    }
  });

  return NextResponse.json({
    submitted: true,
    waiting: false,
    turnComplete: true,
    matchComplete: false,
    teamAScore: result.teamAScore,
    teamBScore: result.teamBScore,
  });
}

/**
 * Check if all matches in this season's current round are complete.
 * If so, refresh leaderboard and generate highlights.
 */
async function checkRoundComplete(seasonId: number, tournamentId: string) {
  const supabase = createServerClient();

  const { data: pendingMatches } = await supabase
    .from("matches")
    .select("id")
    .eq("season_id", seasonId)
    .neq("status", "completed")
    .neq("status", "error");

  if (pendingMatches && pendingMatches.length > 0) {
    return; // Still matches in progress
  }

  // All matches complete — refresh leaderboard
  await refreshLeaderboard(seasonId);

  // Generate highlights
  await supabase
    .from("seasons")
    .update({ round_status: "generating_highlights" })
    .eq("id", seasonId);

  try {
    await generateHighlights(seasonId, 1);
  } catch (e) {
    console.error("Highlight generation failed:", e);
  }

  try {
    const highlightData = await getHighlightData(seasonId, 1);
    await generateVoiceoversForHighlights(highlightData);
  } catch (e) {
    console.error("Voiceover generation failed:", e);
  }

  try {
    await generateTeamHighlights(seasonId, 1);
  } catch (e) {
    console.error("Team highlight generation failed:", e);
  }

  try {
    const teamHighlightData = await getTeamHighlightData(seasonId, 1);
    await generateVoiceoversForHighlights(teamHighlightData);
  } catch (e) {
    console.error("Team voiceover generation failed:", e);
  }

  await supabase
    .from("seasons")
    .update({ round_status: "showing_highlights" })
    .eq("id", seasonId);

  // Reset readiness
  await supabase
    .from("playbooks")
    .update({ ready: false })
    .eq("season_id", seasonId);
}
