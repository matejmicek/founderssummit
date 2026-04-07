import { createServerClient } from "@/lib/supabase";
import { chatCompletion } from "@/lib/anthropic";
import { calculateScore, applyNoise, type Decision } from "./scoring";
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
import type { RoundRules } from "./rounds";

const TURNS_PER_MATCH = 3;
const MESSAGES_PER_TURN = 4; // 2 messages per team per turn
const MAX_MESSAGE_CHARS = 140;

export interface TeamData {
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

// ======================================================================
// HUMAN-DECISION MODE: Negotiate only, then wait for human decisions
// ======================================================================

/**
 * Run AI negotiation for a single turn of a match.
 * After this completes, match status changes to "deciding" and waits for human input.
 */
export async function executeNegotiation(
  matchId: string,
  turn: number,
  teamA: TeamData,
  teamB: TeamData,
  seasonNumber: number,
  totalTeams: number,
  roundRules: RoundRules
): Promise<void> {
  const supabase = createServerClient();
  const turnsPerMatch = roundRules.turnsPerMatch || TURNS_PER_MATCH;

  // Update match status to talking
  await supabase
    .from("matches")
    .update({ status: "talking", current_turn: turn })
    .eq("id", matchId);

  // Load encounter history (only if memory is enabled for this round)
  let historyA: Awaited<ReturnType<typeof getEncounterHistory>> = [];
  let historyB: Awaited<ReturnType<typeof getEncounterHistory>> = [];
  if (roundRules.memoryEnabled) {
    [historyA, historyB] = await Promise.all([
      getEncounterHistory(teamA.id, teamB.id),
      getEncounterHistory(teamB.id, teamA.id),
    ]);
  }

  // Load previous turns in this match
  const { data: prevTurns } = await supabase
    .from("match_turns")
    .select("*")
    .eq("match_id", matchId)
    .order("turn", { ascending: true });

  const previousTurnsA = (prevTurns || []).map((t) => ({
    turn: t.turn,
    myDecision: t.team_a_decision,
    theirDecision: t.team_b_decision,
    myScore: t.team_a_score,
    theirScore: t.team_b_score,
    transcript: [] as { speaker: string; content: string }[],
  }));

  const previousTurnsB = (prevTurns || []).map((t) => ({
    turn: t.turn,
    myDecision: t.team_b_decision,
    theirDecision: t.team_a_decision,
    myScore: t.team_b_score,
    theirScore: t.team_a_score,
    transcript: [] as { speaker: string; content: string }[],
  }));

  // Load previous messages for transcript context
  const { data: prevMessages } = await supabase
    .from("messages")
    .select("team_id, content, turn")
    .eq("match_id", matchId)
    .order("sequence", { ascending: true });

  // Attach transcripts to previous turns
  for (const msg of prevMessages || []) {
    const turnIdx = msg.turn - 1;
    if (previousTurnsA[turnIdx]) {
      previousTurnsA[turnIdx].transcript.push({
        speaker: msg.team_id === teamA.id ? "You" : "Opponent",
        content: msg.content,
      });
    }
    if (previousTurnsB[turnIdx]) {
      previousTurnsB[turnIdx].transcript.push({
        speaker: msg.team_id === teamB.id ? "You" : "Opponent",
        content: msg.content,
      });
    }
  }

  const contextA: PromptContext = {
    teamName: teamA.name,
    playbook: teamA.playbook,
    opponentName: teamB.name,
    historyText: formatHistoryForPrompt(historyA, teamB.name),
    currentRank: teamA.rank,
    totalTeams,
    seasonNumber,
    turnNumber: turn,
    totalTurns: turnsPerMatch,
    secretWeaponUnlocked: false,
    previousTurns: previousTurnsA,
  };

  const contextB: PromptContext = {
    teamName: teamB.name,
    playbook: teamB.playbook,
    opponentName: teamA.name,
    historyText: formatHistoryForPrompt(historyB, teamA.name),
    currentRank: teamB.rank,
    totalTeams,
    seasonNumber,
    turnNumber: turn,
    totalTurns: turnsPerMatch,
    secretWeaponUnlocked: false,
    previousTurns: previousTurnsB,
  };

  // Get current message sequence number
  const { count: existingMsgCount } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("match_id", matchId);
  let messageSequence = existingMsgCount || 0;

  // Negotiate: generate messages
  const turnTranscript: { speaker: string; teamId: string; content: string }[] = [];

  for (let i = 0; i < MESSAGES_PER_TURN; i++) {
    const isTeamA = i % 2 === 0;
    const ctx = isTeamA ? contextA : contextB;
    const team = isTeamA ? teamA : teamB;

    const systemPrompt = buildNegotiationSystemPrompt(ctx);
    const opponent = isTeamA ? teamB : teamA;
    const hasHistory = isTeamA ? historyA.length > 0 : historyB.length > 0;
    const userPrompt = buildNegotiationUserPrompt(
      turnTranscript.map((t) => ({
        speaker: t.teamId === team.id ? "You" : "Opponent",
        content: t.content,
      })),
      i === 0,
      opponent.name,
      hasHistory,
      i,
      MESSAGES_PER_TURN
    );

    let message = await chatCompletion("fast", systemPrompt, userPrompt, 80);
    message = message.replace(/^["']|["']$/g, "").trim();
    if (message.length > MAX_MESSAGE_CHARS) message = message.slice(0, MAX_MESSAGE_CHARS - 3) + "...";

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

  // Set match to "deciding" — waiting for human input
  await supabase
    .from("matches")
    .update({
      status: "deciding",
      current_turn: turn,
    })
    .eq("id", matchId);
}

/**
 * Process a turn after both teams have submitted their decisions.
 * Applies noise, calculates scores, stores results.
 * Returns whether the match is complete.
 */
export async function processTurnResult(
  matchId: string,
  turn: number,
  teamAId: string,
  teamBId: string,
  rawDecisionA: Decision,
  rawDecisionB: Decision,
  pointsMultiplier: number,
  noiseChance: number
): Promise<{ complete: boolean; teamAScore: number; teamBScore: number }> {
  const supabase = createServerClient();

  // Apply noise
  const noiseA = applyNoise(rawDecisionA, noiseChance);
  const noiseB = applyNoise(rawDecisionB, noiseChance);

  // Update team_decisions with effective decision if noise flipped
  if (noiseA.flipped) {
    await supabase
      .from("team_decisions")
      .update({ noise_flipped: true, effective_decision: noiseA.effective })
      .eq("match_id", matchId)
      .eq("turn", turn)
      .eq("team_id", teamAId);
  }
  if (noiseB.flipped) {
    await supabase
      .from("team_decisions")
      .update({ noise_flipped: true, effective_decision: noiseB.effective })
      .eq("match_id", matchId)
      .eq("turn", turn)
      .eq("team_id", teamBId);
  }

  const { teamAScore, teamBScore } = calculateScore(
    noiseA.effective,
    noiseB.effective,
    pointsMultiplier
  );

  // Store turn result
  await supabase.from("match_turns").insert({
    match_id: matchId,
    turn,
    team_a_decision: noiseA.effective,
    team_b_decision: noiseB.effective,
    team_a_score: teamAScore,
    team_b_score: teamBScore,
    team_a_reasoning: noiseA.flipped ? "NOISE: Decision was randomly flipped!" : "Human decision",
    team_b_reasoning: noiseB.flipped ? "NOISE: Decision was randomly flipped!" : "Human decision",
    noise_flipped_a: noiseA.flipped,
    noise_flipped_b: noiseB.flipped,
  });

  // Check if match is complete
  const { data: allTurns } = await supabase
    .from("match_turns")
    .select("turn")
    .eq("match_id", matchId);

  // Get turns per match from the match's season round rules
  const { data: match } = await supabase
    .from("matches")
    .select("season_id")
    .eq("id", matchId)
    .single();

  const { data: season } = await supabase
    .from("seasons")
    .select("round_rules, points_multiplier")
    .eq("id", match?.season_id)
    .single();

  const roundRules = (season?.round_rules || {}) as Partial<import("./rounds").RoundRules>;
  const turnsPerMatch = roundRules.turnsPerMatch || TURNS_PER_MATCH;
  const complete = (allTurns?.length || 0) >= turnsPerMatch;

  if (complete) {
    await completeMatch(matchId);
  }

  return { complete, teamAScore, teamBScore };
}

/**
 * Complete a match: calculate totals, update match record, generate summary.
 */
async function completeMatch(matchId: string): Promise<void> {
  const supabase = createServerClient();

  const { data: turns } = await supabase
    .from("match_turns")
    .select("*")
    .eq("match_id", matchId)
    .order("turn", { ascending: true });

  if (!turns || turns.length === 0) return;

  const totalAScore = turns.reduce((sum, t) => sum + (t.team_a_score || 0), 0);
  const totalBScore = turns.reduce((sum, t) => sum + (t.team_b_score || 0), 0);
  const lastTurn = turns[turns.length - 1];

  await supabase
    .from("matches")
    .update({
      team_a_decision: lastTurn.team_a_decision,
      team_b_decision: lastTurn.team_b_decision,
      team_a_score: totalAScore,
      team_b_score: totalBScore,
      team_a_reasoning: turns.map((t) => `T${t.turn}: ${t.team_a_reasoning}`).join(" | "),
      team_b_reasoning: turns.map((t) => `T${t.turn}: ${t.team_b_reasoning}`).join(" | "),
      status: "completed",
    })
    .eq("id", matchId);

  // Generate summary in background
  const { data: match } = await supabase
    .from("matches")
    .select("team_a_id, team_b_id, season_id")
    .eq("id", matchId)
    .single();

  if (match) {
    generateSummary(matchId, turns, match.team_a_id, match.team_b_id, match.season_id, totalAScore, totalBScore).catch(console.error);
  }
}

async function generateSummary(
  matchId: string,
  turns: { turn: number; team_a_decision: string; team_b_decision: string; team_a_score: number; team_b_score: number }[],
  teamAId: string,
  teamBId: string,
  seasonId: number,
  totalAScore: number,
  totalBScore: number
) {
  const supabase = createServerClient();

  // Get team names
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", [teamAId, teamBId]);

  const teamA = teams?.find((t) => t.id === teamAId);
  const teamB = teams?.find((t) => t.id === teamBId);
  if (!teamA || !teamB) return;

  const summaryPrompt = buildSummaryPrompt(
    turns.map((t) => ({
      turn: t.turn,
      teamADecision: t.team_a_decision,
      teamBDecision: t.team_b_decision,
      teamAScore: t.team_a_score,
      teamBScore: t.team_b_score,
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

  const turnDecisionsA = turns.map((t) => ({
    turn: t.turn,
    my: t.team_a_decision,
    their: t.team_b_decision,
    myScore: t.team_a_score,
    theirScore: t.team_b_score,
  }));
  const turnDecisionsB = turns.map((t) => ({
    turn: t.turn,
    my: t.team_b_decision,
    their: t.team_a_decision,
    myScore: t.team_b_score,
    theirScore: t.team_a_score,
  }));

  const lastTurn = turns[turns.length - 1];
  await supabase.from("encounter_history").insert([
    {
      team_id: teamAId,
      opponent_id: teamBId,
      match_id: matchId,
      season_id: seasonId,
      round: 1,
      my_decision: lastTurn.team_a_decision,
      their_decision: lastTurn.team_b_decision,
      my_score: totalAScore,
      their_score: totalBScore,
      summary,
      turn_decisions: turnDecisionsA,
    },
    {
      team_id: teamBId,
      opponent_id: teamAId,
      match_id: matchId,
      season_id: seasonId,
      round: 1,
      my_decision: lastTurn.team_b_decision,
      their_decision: lastTurn.team_a_decision,
      my_score: totalBScore,
      their_score: totalAScore,
      summary,
      turn_decisions: turnDecisionsB,
    },
  ]);
}

// ======================================================================
// ORIGINAL AI-DECISION MODE (kept for backward compatibility / AI-only games)
// ======================================================================

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

  await supabase
    .from("matches")
    .update({ status: "talking" })
    .eq("id", matchId);

  const [historyA, historyB] = await Promise.all([
    getEncounterHistory(teamA.id, teamB.id),
    getEncounterHistory(teamB.id, teamA.id),
  ]);

  const turns: TurnResult[] = [];
  let messageSequence = 0;

  for (let turn = 1; turn <= TURNS_PER_MATCH; turn++) {
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
      teamName: teamA.name,
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
      teamName: teamB.name,
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

    const turnTranscript: { speaker: string; teamId: string; content: string }[] = [];

    for (let i = 0; i < MESSAGES_PER_TURN; i++) {
      const isTeamA = i % 2 === 0;
      const ctx = isTeamA ? contextA : contextB;
      const team = isTeamA ? teamA : teamB;

      const systemPrompt = buildNegotiationSystemPrompt(ctx);
      const opponent = isTeamA ? teamB : teamA;
      const hasHistory = isTeamA ? historyA.length > 0 : historyB.length > 0;
      const userPrompt = buildNegotiationUserPrompt(
        turnTranscript.map((t) => ({
          speaker: t.teamId === team.id ? "You" : "Opponent",
          content: t.content,
        })),
        i === 0,
        opponent.name,
        hasHistory,
        i,
        MESSAGES_PER_TURN
      );

      let message = await chatCompletion("fast", systemPrompt, userPrompt, 80);
      message = message.replace(/^["']|["']$/g, "").trim();
      if (message.length > MAX_MESSAGE_CHARS) message = message.slice(0, MAX_MESSAGE_CHARS - 3) + "...";

      await supabase.from("messages").insert({
        match_id: matchId,
        team_id: team.id,
        content: message,
        sequence: messageSequence++,
        turn,
      });

      turnTranscript.push({ speaker: team.name, teamId: team.id, content: message });
    }

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

    if (turn < TURNS_PER_MATCH) {
      await supabase
        .from("matches")
        .update({ status: "talking" })
        .eq("id", matchId);
    }
  }

  const totalAScore = turns.reduce((sum, t) => sum + t.teamAScore, 0);
  const totalBScore = turns.reduce((sum, t) => sum + t.teamBScore, 0);

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

  generateSummary(
    matchId,
    turns.map((t) => ({
      turn: t.turn,
      team_a_decision: t.teamADecision,
      team_b_decision: t.teamBDecision,
      team_a_score: t.teamAScore,
      team_b_score: t.teamBScore,
    })),
    teamA.id,
    teamB.id,
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
        return { decision: parsed.decision, reasoning: parsed.reasoning || "No reasoning provided" };
      }
    }

    const lower = response.toLowerCase();
    if (lower.includes("betray")) return { decision: "betray", reasoning: "Extracted via fallback" };
    if (lower.includes("cooperate")) return { decision: "cooperate", reasoning: "Extracted via fallback" };

    return { decision: "cooperate", reasoning: "Default (failed to extract)" };
  } catch (error) {
    console.error("Decision extraction failed:", error);
    return { decision: "cooperate", reasoning: "Default (error)" };
  }
}

export async function refreshLeaderboard(seasonId: number) {
  const supabase = createServerClient();

  const { data: matches } = await supabase
    .from("matches")
    .select("team_a_id, team_b_id, team_a_score, team_b_score")
    .eq("season_id", seasonId)
    .eq("status", "completed");

  if (!matches) return;

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

  const matchTeamMap: Record<string, { team_a_id: string; team_b_id: string }> = {};
  for (const m of allMatches || []) {
    matchTeamMap[m.id] = { team_a_id: m.team_a_id, team_b_id: m.team_b_id };
  }

  const stats: Record<string, { score: number; played: number; cooperated: number; betrayed: number }> = {};

  for (const m of matches) {
    if (!stats[m.team_a_id]) stats[m.team_a_id] = { score: 0, played: 0, cooperated: 0, betrayed: 0 };
    if (!stats[m.team_b_id]) stats[m.team_b_id] = { score: 0, played: 0, cooperated: 0, betrayed: 0 };

    stats[m.team_a_id].score += m.team_a_score || 0;
    stats[m.team_a_id].played += 1;
    stats[m.team_b_id].score += m.team_b_score || 0;
    stats[m.team_b_id].played += 1;
  }

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

  const { data: currentLeaderboard } = await supabase
    .from("leaderboard")
    .select("team_id, rank")
    .eq("season_id", seasonId);

  const previousRanks: Record<string, number> = {};
  for (const row of currentLeaderboard || []) {
    previousRanks[row.team_id] = row.rank;
  }

  const sorted = Object.entries(stats).sort(([, a], [, b]) => b.score - a.score);

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
