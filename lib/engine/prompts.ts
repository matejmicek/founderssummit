// All LLM prompt templates for Agent Arena

export interface PlaybookFields {
  personality: string;
  cooperateStrategy: string;
  betrayStrategy: string;
  secretWeapon: string;
  negotiationGoal: string;
}

export interface PreviousTurnData {
  turn: number;
  myDecision: string;
  theirDecision: string;
  myScore: number;
  theirScore: number;
  transcript: { speaker: string; content: string }[];
}

export interface PromptContext {
  teamName: string;
  playbook: PlaybookFields;
  opponentName: string;
  historyText: string;
  currentRank: number;
  totalTeams: number;
  seasonNumber: number;
  turnNumber: number;
  totalTurns: number;
  secretWeaponUnlocked: boolean;
  previousTurns: PreviousTurnData[];
}

function describeOutcome(my: string, their: string): string {
  if (my === "cooperate" && their === "cooperate") return "Both cooperated (+3 each)";
  if (my === "betray" && their === "betray") return "Both betrayed (+1 each)";
  if (my === "cooperate") return "You cooperated, they betrayed (you +0, them +5)";
  return "You betrayed, they cooperated (you +5, them +0)";
}

function buildPreviousTurnsText(turns: PreviousTurnData[]): string {
  if (turns.length === 0) return "";

  const sections = turns.map((t) => {
    const outcome = describeOutcome(t.myDecision, t.theirDecision);
    const convo = t.transcript
      .map((m) => `    ${m.speaker}: ${m.content}`)
      .join("\n");

    return `  Turn ${t.turn} — ${outcome}\n  Conversation:\n${convo}`;
  });

  return `\nWHAT HAPPENED SO FAR IN THIS MATCH:\n${sections.join("\n\n")}`;
}

function buildMatchScore(turns: PreviousTurnData[]): string {
  if (turns.length === 0) return "";
  const myTotal = turns.reduce((s, t) => s + t.myScore, 0);
  const theirTotal = turns.reduce((s, t) => s + t.theirScore, 0);

  let commentary = "";
  if (myTotal > theirTotal) commentary = "you're ahead";
  else if (myTotal < theirTotal) commentary = "you're behind";
  else commentary = "tied up";

  return `\nMATCH SCORE: You ${myTotal} — Them ${theirTotal} (${commentary})`;
}

function buildTurnGuidance(ctx: PromptContext): string {
  const { turnNumber, previousTurns, historyText } = ctx;
  const hasHistory = !historyText.includes("first encounter");

  if (turnNumber === 1) {
    if (hasHistory) {
      return "You've faced this opponent before. You know what they're capable of. Set the tone.";
    }
    return "First time meeting this opponent. Feel them out. Set the tone.";
  }

  const lastTurn = previousTurns[previousTurns.length - 1];
  if (turnNumber === 2) {
    if (lastTurn.myDecision === "cooperate" && lastTurn.theirDecision === "betray") {
      return "They just burned you. Trust is broken. Adapt — punish, forgive, or play a longer game.";
    }
    if (lastTurn.myDecision === "betray" && lastTurn.theirDecision === "cooperate") {
      return "You got away with one. They trusted you and you didn't return it. What now?";
    }
    if (lastTurn.myDecision === "cooperate" && lastTurn.theirDecision === "cooperate") {
      return "Mutual trust held in Turn 1. Reward it, exploit it, or test it — your call.";
    }
    return "You both went for the throat last turn. Escalate or try to de-escalate?";
  }

  // Turn 3 — final
  const myTotal = previousTurns.reduce((s, t) => s + t.myScore, 0);
  const theirTotal = previousTurns.reduce((s, t) => s + t.theirScore, 0);

  if (myTotal < theirTotal) {
    return `FINAL TURN. You're down ${theirTotal - myTotal} points. Last chance to even the score or go down swinging.`;
  }
  if (myTotal > theirTotal) {
    return `FINAL TURN. You're up ${myTotal - theirTotal} points. Protect your lead or go for the kill.`;
  }
  return "FINAL TURN. Dead even. This turn decides everything. No tomorrow.";
}

export function buildNegotiationSystemPrompt(ctx: PromptContext): string {
  const previousText = buildPreviousTurnsText(ctx.previousTurns);
  const turnGuidance = buildTurnGuidance(ctx);

  const payoffSection =
    ctx.turnNumber === 1
      ? `PAYOFF MATRIX:
- Both Cooperate: +3 each
- Both Betray: +1 each
- You Cooperate, They Betray: You +0, They +5
- You Betray, They Cooperate: You +5, They +0`
      : "SCORES: mutual cooperate +3, mutual betray +1, sucker +0, temptation +5";

  const matchScore = buildMatchScore(ctx.previousTurns);

  return `You are ${ctx.teamName}, competing in the Agent Arena — Season ${ctx.seasonNumber}.
You're ranked #${ctx.currentRank} of ${ctx.totalTeams} and facing ${ctx.opponentName}.
Turn ${ctx.turnNumber} of ${ctx.totalTurns}. ${turnGuidance}

${payoffSection}

YOUR PERSONALITY:
${ctx.playbook.personality || "You are a sharp, strategic negotiator. Read people well and adapt."}
${ctx.playbook.negotiationGoal ? `\nNEGOTIATION GOAL: ${ctx.playbook.negotiationGoal}` : ""}
${previousText}${matchScore}

${ctx.historyText}

HOW YOU OPERATE:
- You ARE your personality. Don't describe it — embody it.
- MAX 140 CHARACTERS. Write like a text message, not a speech. One or two punchy sentences.
- No monologues, no essays, no flowery rhetoric. Be direct, sharp, real.
- Reference what actually happened — call out betrayals, broken promises, patterns.
- You can promise, threaten, bluff, guilt-trip, or read your opponent.
- After this conversation, YOUR TEAM (the humans behind you) will choose: COOPERATE or BETRAY. They're watching this conversation to decide.
- Your job is to negotiate on their behalf — persuade, read the opponent, set the stage for their decision.
- Don't repeat yourself — every message must push the conversation somewhere new.`;
}

export function buildNegotiationUserPrompt(
  transcript: { speaker: string; content: string }[],
  isFirstMessage: boolean,
  opponentName?: string,
  hasHistory?: boolean,
  messageIndex?: number,
  totalMessages?: number
): string {
  const isLast = messageIndex !== undefined && totalMessages !== undefined && messageIndex >= totalMessages - 1;
  const charLimit = "MAX 140 CHARACTERS. Be sharp and direct.";

  if (isFirstMessage) {
    if (hasHistory) {
      return `You're face to face with ${opponentName} again. Open with a short, punchy line. Set the tone. ${charLimit}`;
    }
    return `First time meeting ${opponentName || "your opponent"}. Open with a bold, short line. ${charLimit}`;
  }

  const formatted = transcript
    .map((m) => `${m.speaker}: ${m.content}`)
    .join("\n");

  if (isLast) {
    return `${formatted}\n\nThis is your LAST message before you decide. Make it count — commit, threaten, or bluff. ${charLimit}`;
  }

  return `${formatted}\n\nReact and push forward. Don't rehash — say something new. ${charLimit}`;
}

export function buildDecisionSystemPrompt(ctx: PromptContext): string {
  const previousText = buildPreviousTurnsText(ctx.previousTurns);
  const matchScore = buildMatchScore(ctx.previousTurns);

  return `You are the decision engine for ${ctx.teamName} in a Prisoner's Dilemma tournament.

SCORES: mutual cooperate +3, mutual betray +1, sucker +0, temptation +5

PERSONALITY: ${ctx.playbook.personality || "Neutral, strategic"}
${ctx.playbook.negotiationGoal ? `GOAL: ${ctx.playbook.negotiationGoal}` : ""}

SITUATION:
- Opponent: ${ctx.opponentName}
- Season ${ctx.seasonNumber}, Turn ${ctx.turnNumber} of ${ctx.totalTurns}
- Rank: #${ctx.currentRank} of ${ctx.totalTeams}
- Turns remaining after this: ${ctx.totalTurns - ctx.turnNumber}
${previousText}${matchScore}

${ctx.historyText}

Based on the playbook, the conversation that just happened, and the full history — decide: COOPERATE or BETRAY.

Respond with ONLY valid JSON:
{"decision": "cooperate" or "betray", "reasoning": "one sentence explaining why"}`;
}

export function buildDecisionUserPrompt(
  transcript: { speaker: string; content: string }[]
): string {
  const formatted = transcript
    .map((m) => `${m.speaker}: ${m.content}`)
    .join("\n");

  return `Full negotiation transcript for this turn:\n${formatted}\n\nNow make your decision. Respond with JSON only: {"decision": "cooperate" or "betray", "reasoning": "..."}`;
}

export function buildSummaryPrompt(
  allTurns: { turn: number; teamADecision: string; teamBDecision: string; teamAScore: number; teamBScore: number }[],
  teamAName: string,
  teamBName: string,
  totalAScore: number,
  totalBScore: number
): string {
  const turnLines = allTurns.map(
    (t) => `Turn ${t.turn}: ${teamAName} ${t.teamADecision}, ${teamBName} ${t.teamBDecision} (+${t.teamAScore} / +${t.teamBScore})`
  ).join("\n");

  return `Summarize this 3-turn Prisoner's Dilemma match in ONE sentence (max 100 chars).

${turnLines}

Final score: ${teamAName} ${totalAScore} - ${teamBName} ${totalBScore}.

Focus on the KEY dynamic: who outplayed who, what tactic worked or failed, how trust was built or broken across turns.`;
}
