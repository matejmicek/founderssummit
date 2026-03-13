// All LLM prompt templates for Agent Arena

export interface PlaybookFields {
  personality: string;
  cooperateStrategy: string;
  betrayStrategy: string;
  secretWeapon: string;
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

function buildPreviousTurnsText(turns: PreviousTurnData[]): string {
  if (turns.length === 0) return "";

  const sections = turns.map((t) => {
    const outcome =
      t.myDecision === "cooperate" && t.theirDecision === "cooperate"
        ? "Both cooperated (+3 each)"
        : t.myDecision === "betray" && t.theirDecision === "betray"
        ? "Both betrayed (+1 each)"
        : t.myDecision === "cooperate"
        ? `You cooperated, they betrayed (you +0, them +5)`
        : `You betrayed, they cooperated (you +5, them +0)`;

    const convo = t.transcript
      .map((m) => `    ${m.speaker}: ${m.content}`)
      .join("\n");

    return `  Turn ${t.turn} — ${outcome}\n  Conversation:\n${convo}`;
  });

  return `\nWHAT HAPPENED SO FAR IN THIS MATCH:\n${sections.join("\n\n")}`;
}

export function buildNegotiationSystemPrompt(ctx: PromptContext): string {
  const previousText = buildPreviousTurnsText(ctx.previousTurns);

  const turnGuidance =
    ctx.turnNumber === 1
      ? "This is the opening turn. Feel out your opponent, set the tone."
      : ctx.turnNumber === 2
      ? "This is the middle turn. You know what happened last time. Adapt — escalate, punish, reward, or pivot."
      : "This is the FINAL turn. Last chance to cooperate or betray. Make it count. There's no tomorrow.";

  return `You are an AI negotiation agent in a Prisoner's Dilemma tournament. You represent a team and must negotiate with your opponent before each of you independently decides to COOPERATE or BETRAY.

PAYOFF MATRIX:
- Both Cooperate: +3 each
- Both Betray: +1 each
- You Cooperate, They Betray: You +0, They +5
- You Betray, They Cooperate: You +5, They +0

YOUR TEAM'S PLAYBOOK:
Personality & Style: ${ctx.playbook.personality || "No personality defined — be neutral and strategic."}
When to Cooperate: ${ctx.playbook.cooperateStrategy || "Cooperate by default, mirror opponent's behavior."}
When to Betray: ${ctx.playbook.betrayStrategy || "Betray if opponent betrayed you last turn."}${
    ctx.secretWeaponUnlocked && ctx.playbook.secretWeapon
      ? `\nSecret Weapon: ${ctx.playbook.secretWeapon}`
      : ""
  }

SITUATION:
- You are facing: ${ctx.opponentName}
- Season ${ctx.seasonNumber}, Turn ${ctx.turnNumber} of ${ctx.totalTurns}
- Your current rank: #${ctx.currentRank} of ${ctx.totalTeams}
- ${turnGuidance}
${previousText}

${ctx.historyText}

RULES:
- Keep messages under 280 characters
- Stay DEEPLY in character — your personality drives HOW you talk
- Reference what happened in previous turns if relevant — call out betrayals, broken promises, patterns
- You can make promises, threats, bluff, guilt-trip, or try to read your opponent
- After this conversation, you will INDEPENDENTLY choose to cooperate or betray
- Your opponent cannot see your decision until both are locked in
- DO NOT repeat yourself across turns — evolve your approach based on what's happened`;
}

export function buildNegotiationUserPrompt(
  transcript: { speaker: string; content: string }[],
  isFirstMessage: boolean
): string {
  if (isFirstMessage) {
    return "The negotiation begins. Send your opening message to your opponent. Remember: keep it under 280 characters.";
  }

  const formatted = transcript
    .map((m) => `${m.speaker}: ${m.content}`)
    .join("\n");

  return `Conversation so far this turn:\n${formatted}\n\nYour turn to respond. Keep it under 280 characters. Don't repeat what you've already said — push the conversation forward.`;
}

export function buildDecisionSystemPrompt(ctx: PromptContext): string {
  const previousText = buildPreviousTurnsText(ctx.previousTurns);

  return `You are a decision engine for an AI agent in a Prisoner's Dilemma tournament.

PAYOFF MATRIX:
- Both Cooperate: +3 each
- Both Betray: +1 each
- You Cooperate, They Betray: You +0, They +5
- You Betray, They Cooperate: You +5, They +0

THE TEAM'S PLAYBOOK:
Personality & Style: ${ctx.playbook.personality || "Neutral"}
When to Cooperate: ${ctx.playbook.cooperateStrategy || "Cooperate by default"}
When to Betray: ${ctx.playbook.betrayStrategy || "Betray if opponent betrayed last turn"}${
    ctx.secretWeaponUnlocked && ctx.playbook.secretWeapon
      ? `\nSecret Weapon: ${ctx.playbook.secretWeapon}`
      : ""
  }

SITUATION:
- Opponent: ${ctx.opponentName}
- Season ${ctx.seasonNumber}, Turn ${ctx.turnNumber} of ${ctx.totalTurns}
- Current rank: #${ctx.currentRank} of ${ctx.totalTeams}
- Turns remaining after this: ${ctx.totalTurns - ctx.turnNumber}
${previousText}

${ctx.historyText}

Based on the playbook's strategy, the conversation that just happened, and the full history of this match so far, decide: COOPERATE or BETRAY.

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

Write a brief, colorful summary capturing the drama of the match.`;
}
