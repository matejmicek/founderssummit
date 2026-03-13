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

const TURNS_PER_MATCH = 3;
const MESSAGES_PER_TURN = 6; // 3 messages per team per turn

interface TeamData {
  id: string;
  name: string;
  playbook: PlaybookFields;
  rank: number;
}

interface TurnResult {
  turn: number;
  teamADecision: Decision;
  teamBDecision: Decision;
  teamAScore: number;
  teamBScore: number;
  teamAReasoning: string;
  teamBReasoning: string;
  transcript: { speaker: string; teamId: string; content: string }[];
}

interface MatchResult {
  matchId: string;
  turns: TurnResult[];
  totalAScore: number;
  totalBScore: number;
}

export async function executeMatch(
  matchId: string,
  teamA: TeamData,
  teamB: TeamData,
  seasonId: number,
  seasonNumber: number,
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

  // Load encounter history from PREVIOUS matches (not this one)
  const [historyA, historyB] = await Promise.all([
    getEncounterHistory(teamA.id, teamB.id),
    getEncounterHistory(teamB.id, teamA.id),
  ]);

  const turns: TurnResult[] = [];
  let messageSequence = 0;

  // Execute 3 turns
  for (let turn = 1; turn <= TURNS_PER_MATCH; turn++) {
    // Build previous turns context for this match (including transcripts)
    const previousTurnsA = turns.map((t) => ({
      turn: t.turn,
      myDecision: t.teamADecision,
      theirDecision: t.teamBDecision,
      myScore: t.teamAScore,
      theirScore: t.teamBScore,
      transcript: t.transcript.map((m) => ({
        speaker: m.teamId === teamA.id ? "You" : "Opponent",
        content: m.content,
      })),
    }));

    const previousTurnsB = turns.map((t) => ({
      turn: t.turn,
      myDecision: t.teamBDecision,
      theirDecision: t.teamADecision,
      myScore: t.teamBScore,
      theirScore: t.teamAScore,
      transcript: t.transcript.map((m) => ({
        speaker: m.teamId === teamB.id ? "You" : "Opponent",
        content: m.content,
      })),
    }));

    const contextA: PromptContext = {
      playbook: teamA.playbook,
      opponentName: teamB.name,
      historyText: formatHistoryForPrompt(historyA, teamB.name),
      currentRank: teamA.rank,
      totalTeams,
      seasonNumber,
      turnNumber: turn,
      totalTurns: TURNS_PER_MATCH,
      secretWeaponUnlocked,
      previousTurns: previousTurnsA,
    };

    const contextB: PromptContext = {
      playbook: teamB.playbook,
      opponentName: teamA.name,
      historyText: formatHistoryForPrompt(historyB, teamA.name),
      currentRank: teamB.rank,
      totalTeams,
      seasonNumber,
      turnNumber: turn,
      totalTurns: TURNS_PER_MATCH,
      secretWeaponUnlocked,
      previousTurns: previousTurnsB,
    };

    // Negotiate: 1 message per team (2 total per turn)
    const turnTranscript: { speaker: string; teamId: string; content: string }[] = [];

    for (let i = 0; i < MESSAGES_PER_TURN; i++) {
      const isTeamA = i % 2 === 0;
      const ctx = isTeamA ? contextA : contextB;
      const team = isTeamA ? teamA : teamB;

      const systemPrompt = buildNegotiationSystemPrompt(ctx);
      const userPrompt = buildNegotiationUserPrompt(
        turnTranscript.map((t) => ({
          speaker: t.teamId === team.id ? "You" : "Opponent",
          content: t.content,
        })),
        i === 0
      );

      let message = await chatCompletion("fast", systemPrompt, userPrompt, 200);
      if (message.length > 280) message = message.slice(0, 277) + "...";

      // Insert message into DB (triggers Realtime)
      await supabase.from("messages").insert({
        match_id: matchId,
        team_id: team.id,
        content: message,
        sequence: messageSequence++,
        turn,
      });

      turnTranscript.push({
        speaker: team.name,
        teamId: team.id,
        content: message,
      });
    }

    // Decide: parallel calls
    await supabase
      .from("matches")
      .update({ status: "deciding" })
      .eq("id", matchId);

    const [decisionA, decisionB] = await Promise.all([
      extractDecision(contextA, turnTranscript, teamA.id),
      extractDecision(contextB, turnTranscript, teamB.id),
    ]);

    const { teamAScore, teamBScore } = calculateScore(
      decisionA.decision,
      decisionB.decision,
      pointsMultiplier
    );

    // Store turn result
    await supabase.from("match_turns").insert({
      match_id: matchId,
      turn,
      team_a_decision: decisionA.decision,
      team_b_decision: decisionB.decision,
      team_a_score: teamAScore,
      team_b_score: teamBScore,
      team_a_reasoning: decisionA.reasoning,
      team_b_reasoning: decisionB.reasoning,
    });

    turns.push({
      turn,
      teamADecision: decisionA.decision,
      teamBDecision: decisionB.decision,
      teamAScore,
      teamBScore,
      teamAReasoning: decisionA.reasoning,
      teamBReasoning: decisionB.reasoning,
      transcript: turnTranscript,
    });

    // Back to talking for next turn (unless last)
    if (turn < TURNS_PER_MATCH) {
      await supabase
        .from("matches")
        .update({ status: "talking" })
        .eq("id", matchId);
    }
  }

  // Calculate totals
  const totalAScore = turns.reduce((sum, t) => sum + t.teamAScore, 0);
  const totalBScore = turns.reduce((sum, t) => sum + t.teamBScore, 0);

  // Store final combined result on match
  // Use last turn's decision for the match-level fields (check constraint allows only cooperate/betray)
  const lastTurn = turns[turns.length - 1];
  await supabase
    .from("matches")
    .update({
      team_a_decision: lastTurn.teamADecision,
      team_b_decision: lastTurn.teamBDecision,
      team_a_score: totalAScore,
      team_b_score: totalBScore,
      team_a_reasoning: turns.map((t) => `T${t.turn}: ${t.teamAReasoning}`).join(" | "),
      team_b_reasoning: turns.map((t) => `T${t.turn}: ${t.teamBReasoning}`).join(" | "),
      status: "completed",
    })
    .eq("id", matchId);

  // Generate summary (fire and forget)
  generateAndStoreSummary(
    matchId,
    turns,
    teamA,
    teamB,
    seasonId,
    totalAScore,
    totalBScore
  ).catch(console.error);

  return { matchId, turns, totalAScore, totalBScore };
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
    const response = await chatCompletion("smart", systemPrompt, userPrompt, 150);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.decision === "cooperate" || parsed.decision === "betray") {
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

    return { decision: "cooperate", reasoning: "Default (failed to extract)" };
  } catch (error) {
    console.error("Decision extraction failed:", error);
    return { decision: "cooperate", reasoning: "Default (error)" };
  }
}

async function generateAndStoreSummary(
  matchId: string,
  turns: TurnResult[],
  teamA: TeamData,
  teamB: TeamData,
  seasonId: number,
  totalAScore: number,
  totalBScore: number
) {
  const supabase = createServerClient();

  const summaryPrompt = buildSummaryPrompt(
    turns.map((t) => ({
      turn: t.turn,
      teamADecision: t.teamADecision,
      teamBDecision: t.teamBDecision,
      teamAScore: t.teamAScore,
      teamBScore: t.teamBScore,
    })),
    teamA.name,
    teamB.name,
    totalAScore,
    totalBScore
  );

  let summary: string;
  try {
    summary = await chatCompletion(
      "fast",
      "You are a sports commentator. Write a one-sentence summary (max 100 chars).",
      summaryPrompt,
      60
    );
    if (summary.length > 100) summary = summary.slice(0, 97) + "...";
  } catch {
    summary = `${totalAScore}-${totalBScore}`;
  }

  // Store encounter history for both teams (one record per match, not per turn)
  const finalTurn = turns[turns.length - 1];
  await supabase.from("encounter_history").insert([
    {
      team_id: teamA.id,
      opponent_id: teamB.id,
      match_id: matchId,
      season_id: seasonId,
      round: 1,
      my_decision: finalTurn.teamADecision,
      their_decision: finalTurn.teamBDecision,
      my_score: totalAScore,
      their_score: totalBScore,
      summary,
    },
    {
      team_id: teamB.id,
      opponent_id: teamA.id,
      match_id: matchId,
      season_id: seasonId,
      round: 1,
      my_decision: finalTurn.teamBDecision,
      their_decision: finalTurn.teamADecision,
      my_score: totalBScore,
      their_score: totalAScore,
      summary,
    },
  ]);
}

export async function refreshLeaderboard(seasonId: number) {
  const supabase = createServerClient();

  const { data: matches } = await supabase
    .from("matches")
    .select("team_a_id, team_b_id, team_a_score, team_b_score")
    .eq("season_id", seasonId)
    .eq("status", "completed");

  if (!matches) return;

  // Get turn-level data for cooperate/betray counts
  const matchIds = matches.map((m) => m.team_a_id + m.team_b_id); // not useful, get match ids
  const { data: allMatches } = await supabase
    .from("matches")
    .select("id, team_a_id, team_b_id")
    .eq("season_id", seasonId)
    .eq("status", "completed");

  const mIds = (allMatches || []).map((m) => m.id);
  const { data: allTurns } = await supabase
    .from("match_turns")
    .select("match_id, team_a_decision, team_b_decision")
    .in("match_id", mIds);

  // Build team-to-match mapping
  const matchTeamMap: Record<string, { team_a_id: string; team_b_id: string }> = {};
  for (const m of allMatches || []) {
    matchTeamMap[m.id] = { team_a_id: m.team_a_id, team_b_id: m.team_b_id };
  }

  const stats: Record<
    string,
    { score: number; played: number; cooperated: number; betrayed: number }
  > = {};

  // Accumulate scores from matches
  for (const m of matches) {
    if (!stats[m.team_a_id])
      stats[m.team_a_id] = { score: 0, played: 0, cooperated: 0, betrayed: 0 };
    if (!stats[m.team_b_id])
      stats[m.team_b_id] = { score: 0, played: 0, cooperated: 0, betrayed: 0 };

    stats[m.team_a_id].score += m.team_a_score || 0;
    stats[m.team_a_id].played += 1;
    stats[m.team_b_id].score += m.team_b_score || 0;
    stats[m.team_b_id].played += 1;
  }

  // Count cooperate/betray from individual turns
  for (const turn of allTurns || []) {
    const mapping = matchTeamMap[turn.match_id];
    if (!mapping) continue;

    if (stats[mapping.team_a_id]) {
      stats[mapping.team_a_id].cooperated += turn.team_a_decision === "cooperate" ? 1 : 0;
      stats[mapping.team_a_id].betrayed += turn.team_a_decision === "betray" ? 1 : 0;
    }
    if (stats[mapping.team_b_id]) {
      stats[mapping.team_b_id].cooperated += turn.team_b_decision === "cooperate" ? 1 : 0;
      stats[mapping.team_b_id].betrayed += turn.team_b_decision === "betray" ? 1 : 0;
    }
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

  const sorted = Object.entries(stats).sort(
    ([, a], [, b]) => b.score - a.score
  );

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

  await supabase.from("leaderboard").delete().eq("season_id", seasonId);
  if (rows.length > 0) {
    await supabase.from("leaderboard").insert(rows);
  }
}
