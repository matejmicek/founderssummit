import { createServerClient } from "@/lib/supabase";
import { chatCompletion } from "@/lib/anthropic";
import { calculateScore, type Decision } from "./scoring";
import { getEncounterHistory, formatHistoryForPrompt } from "./history";
import {
  buildNegotiationSystemPrompt,
  buildNegotiationUserPrompt,
  buildDecisionSystemPrompt,
  buildDecisionUserPrompt,
  buildSummaryPrompt,
  type PromptContext,
  type PlaybookFields,
} from "./prompts";

const MESSAGES_PER_AGENT = 3; // 6 total messages (3 each, alternating)
const HAIKU = "claude-haiku-4-5-20251001" as const;
const SONNET = "claude-sonnet-4-6-20250514" as const;

interface TeamData {
  id: string;
  name: string;
  playbook: PlaybookFields;
  rank: number;
}

interface MatchResult {
  matchId: string;
  teamADecision: Decision;
  teamBDecision: Decision;
  teamAScore: number;
  teamBScore: number;
  teamAReasoning: string;
  teamBReasoning: string;
}

export async function executeMatch(
  matchId: string,
  teamA: TeamData,
  teamB: TeamData,
  seasonId: number,
  seasonNumber: number,
  roundNumber: number,
  totalRounds: number,
  totalTeams: number,
  pointsMultiplier: number,
  secretWeaponUnlocked: boolean
): Promise<MatchResult> {
  const supabase = createServerClient();

  // Update match status to talking
  await supabase
    .from("matches")
    .update({ status: "talking" })
    .eq("id", matchId);

  // Load encounter history for both teams
  const [historyA, historyB] = await Promise.all([
    getEncounterHistory(teamA.id, teamB.id),
    getEncounterHistory(teamB.id, teamA.id),
  ]);

  const contextA: PromptContext = {
    playbook: teamA.playbook,
    opponentName: teamB.name,
    historyText: formatHistoryForPrompt(historyA, teamB.name),
    currentRank: teamA.rank,
    totalTeams,
    seasonNumber,
    roundNumber,
    totalRounds,
    secretWeaponUnlocked,
  };

  const contextB: PromptContext = {
    playbook: teamB.playbook,
    opponentName: teamA.name,
    historyText: formatHistoryForPrompt(historyB, teamA.name),
    currentRank: teamB.rank,
    totalTeams,
    seasonNumber,
    roundNumber,
    totalRounds,
    secretWeaponUnlocked,
  };

  // Execute negotiation (3 messages each, alternating, A starts)
  const transcript: { speaker: string; teamId: string; content: string }[] = [];
  let sequence = 0;

  for (let i = 0; i < MESSAGES_PER_AGENT * 2; i++) {
    const isTeamA = i % 2 === 0;
    const ctx = isTeamA ? contextA : contextB;
    const team = isTeamA ? teamA : teamB;

    const systemPrompt = buildNegotiationSystemPrompt(ctx);
    const userPrompt = buildNegotiationUserPrompt(
      transcript.map((t) => ({
        speaker: t.teamId === team.id ? "You" : "Opponent",
        content: t.content,
      })),
      i === 0
    );

    let message = await chatCompletion(HAIKU, systemPrompt, userPrompt, 200);

    // Truncate to 280 chars
    if (message.length > 280) {
      message = message.slice(0, 277) + "...";
    }

    // Insert message into DB (triggers Realtime)
    await supabase.from("messages").insert({
      match_id: matchId,
      team_id: team.id,
      content: message,
      sequence: sequence++,
    });

    transcript.push({
      speaker: team.name,
      teamId: team.id,
      content: message,
    });
  }

  // Update match status to deciding
  await supabase
    .from("matches")
    .update({ status: "deciding" })
    .eq("id", matchId);

  // Extract decisions (parallel calls to Sonnet)
  const [decisionA, decisionB] = await Promise.all([
    extractDecision(contextA, transcript, teamA.id),
    extractDecision(contextB, transcript, teamB.id),
  ]);

  // Calculate scores
  const { teamAScore, teamBScore } = calculateScore(
    decisionA.decision,
    decisionB.decision,
    pointsMultiplier
  );

  // Update match with results
  await supabase
    .from("matches")
    .update({
      team_a_decision: decisionA.decision,
      team_b_decision: decisionB.decision,
      team_a_score: teamAScore,
      team_b_score: teamBScore,
      team_a_reasoning: decisionA.reasoning,
      team_b_reasoning: decisionB.reasoning,
      status: "completed",
    })
    .eq("id", matchId);

  // Generate summary (non-blocking, fire and forget)
  generateAndStoreSummary(
    matchId,
    transcript,
    decisionA.decision,
    decisionB.decision,
    teamA,
    teamB,
    seasonId,
    roundNumber,
    teamAScore,
    teamBScore
  ).catch(console.error);

  return {
    matchId,
    teamADecision: decisionA.decision,
    teamBDecision: decisionB.decision,
    teamAScore,
    teamBScore,
    teamAReasoning: decisionA.reasoning,
    teamBReasoning: decisionB.reasoning,
  };
}

async function extractDecision(
  ctx: PromptContext,
  transcript: { speaker: string; teamId: string; content: string }[],
  teamId: string
): Promise<{ decision: Decision; reasoning: string }> {
  const systemPrompt = buildDecisionSystemPrompt(ctx);
  const userPrompt = buildDecisionUserPrompt(
    transcript.map((t) => ({
      speaker: t.teamId === teamId ? "You" : "Opponent",
      content: t.content,
    }))
  );

  try {
    const response = await chatCompletion(SONNET, systemPrompt, userPrompt, 150);

    // Try JSON parse
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (
        parsed.decision === "cooperate" ||
        parsed.decision === "betray"
      ) {
        return {
          decision: parsed.decision,
          reasoning: parsed.reasoning || "No reasoning provided",
        };
      }
    }

    // Regex fallback
    const lower = response.toLowerCase();
    if (lower.includes("betray")) {
      return { decision: "betray", reasoning: "Extracted via fallback" };
    }
    if (lower.includes("cooperate")) {
      return { decision: "cooperate", reasoning: "Extracted via fallback" };
    }

    // Default to cooperate
    return { decision: "cooperate", reasoning: "Default (failed to extract)" };
  } catch (error) {
    console.error("Decision extraction failed:", error);
    return { decision: "cooperate", reasoning: "Default (error)" };
  }
}

async function generateAndStoreSummary(
  matchId: string,
  transcript: { speaker: string; teamId: string; content: string }[],
  teamADecision: string,
  teamBDecision: string,
  teamA: TeamData,
  teamB: TeamData,
  seasonId: number,
  roundNumber: number,
  teamAScore: number,
  teamBScore: number
) {
  const supabase = createServerClient();

  const summaryPrompt = buildSummaryPrompt(
    transcript.map((t) => ({ speaker: t.speaker, content: t.content })),
    teamADecision,
    teamBDecision,
    teamA.name,
    teamB.name
  );

  let summary: string;
  try {
    summary = await chatCompletion(
      HAIKU,
      "You are a sports commentator. Write a one-sentence summary (max 100 chars).",
      summaryPrompt,
      60
    );
    if (summary.length > 100) summary = summary.slice(0, 97) + "...";
  } catch {
    summary = `${teamADecision} vs ${teamBDecision}`;
  }

  // Store encounter history for both teams
  await supabase.from("encounter_history").insert([
    {
      team_id: teamA.id,
      opponent_id: teamB.id,
      match_id: matchId,
      season_id: seasonId,
      round: roundNumber,
      my_decision: teamADecision,
      their_decision: teamBDecision,
      my_score: teamAScore,
      their_score: teamBScore,
      summary,
    },
    {
      team_id: teamB.id,
      opponent_id: teamA.id,
      match_id: matchId,
      season_id: seasonId,
      round: roundNumber,
      my_decision: teamBDecision,
      their_decision: teamADecision,
      my_score: teamBScore,
      their_score: teamAScore,
      summary,
    },
  ]);
}

export async function refreshLeaderboard(seasonId: number) {
  const supabase = createServerClient();

  // Get all completed matches for this season
  const { data: matches } = await supabase
    .from("matches")
    .select("team_a_id, team_b_id, team_a_decision, team_b_decision, team_a_score, team_b_score")
    .eq("season_id", seasonId)
    .eq("status", "completed");

  if (!matches) return;

  // Aggregate scores per team
  const stats: Record<
    string,
    { score: number; played: number; cooperated: number; betrayed: number }
  > = {};

  for (const m of matches) {
    if (!stats[m.team_a_id])
      stats[m.team_a_id] = { score: 0, played: 0, cooperated: 0, betrayed: 0 };
    if (!stats[m.team_b_id])
      stats[m.team_b_id] = { score: 0, played: 0, cooperated: 0, betrayed: 0 };

    stats[m.team_a_id].score += m.team_a_score || 0;
    stats[m.team_a_id].played += 1;
    stats[m.team_a_id].cooperated += m.team_a_decision === "cooperate" ? 1 : 0;
    stats[m.team_a_id].betrayed += m.team_a_decision === "betray" ? 1 : 0;

    stats[m.team_b_id].score += m.team_b_score || 0;
    stats[m.team_b_id].played += 1;
    stats[m.team_b_id].cooperated += m.team_b_decision === "cooperate" ? 1 : 0;
    stats[m.team_b_id].betrayed += m.team_b_decision === "betray" ? 1 : 0;
  }

  // Get current leaderboard for previous ranks
  const { data: currentLeaderboard } = await supabase
    .from("leaderboard")
    .select("team_id, rank")
    .eq("season_id", seasonId);

  const previousRanks: Record<string, number> = {};
  for (const row of currentLeaderboard || []) {
    previousRanks[row.team_id] = row.rank;
  }

  // Sort by score descending
  const sorted = Object.entries(stats).sort(
    ([, a], [, b]) => b.score - a.score
  );

  // Upsert leaderboard rows
  const rows = sorted.map(([teamId, s], idx) => ({
    team_id: teamId,
    season_id: seasonId,
    total_score: s.score,
    matches_played: s.played,
    cooperate_count: s.cooperated,
    betray_count: s.betrayed,
    rank: idx + 1,
    previous_rank: previousRanks[teamId] || null,
    updated_at: new Date().toISOString(),
  }));

  // Delete existing and insert new (simpler than upsert with composite key)
  await supabase.from("leaderboard").delete().eq("season_id", seasonId);
  if (rows.length > 0) {
    await supabase.from("leaderboard").insert(rows);
  }
}
