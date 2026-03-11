// All LLM prompt templates for Agent Arena

export interface PlaybookFields {
  personality: string;
  strategy: string;
  secretWeapon: string;
}

export interface PromptContext {
  playbook: PlaybookFields;
  opponentName: string;
  historyText: string;
  currentRank: number;
  totalTeams: number;
  seasonNumber: number;
  roundNumber: number;
  totalRounds: number;
  secretWeaponUnlocked: boolean;
}

export function buildNegotiationSystemPrompt(ctx: PromptContext): string {
  return `You are an AI negotiation agent in a Prisoner's Dilemma tournament. You represent a team and must negotiate with your opponent before each of you independently decides to COOPERATE or BETRAY.

PAYOFF MATRIX:
- Both Cooperate: +3 each
- Both Betray: +1 each
- You Cooperate, They Betray: You +0, They +5
- You Betray, They Cooperate: You +5, They +0

YOUR TEAM'S PLAYBOOK:
Personality & Style: ${ctx.playbook.personality || "No personality defined — be neutral and strategic."}
Core Strategy: ${ctx.playbook.strategy || "No strategy defined — play Tit-for-Tat (cooperate first, then mirror opponent)."}${
    ctx.secretWeaponUnlocked && ctx.playbook.secretWeapon
      ? `\nSecret Weapon: ${ctx.playbook.secretWeapon}`
      : ""
  }

SITUATION:
- You are facing: ${ctx.opponentName}
- Season ${ctx.seasonNumber}, Round ${ctx.roundNumber} of ${ctx.totalRounds}
- Your current rank: #${ctx.currentRank} of ${ctx.totalTeams}

${ctx.historyText}

RULES:
- Keep messages under 280 characters
- Stay in character based on your personality
- You can make promises, threats, or try to read your opponent — but remember, talk is cheap
- After this conversation, you will INDEPENDENTLY choose to cooperate or betray
- Your opponent cannot see your decision until both are locked in`;
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

  return `Conversation so far:\n${formatted}\n\nYour turn to respond. Keep it under 280 characters.`;
}

export function buildDecisionSystemPrompt(ctx: PromptContext): string {
  return `You are a decision engine for an AI agent in a Prisoner's Dilemma tournament.

PAYOFF MATRIX:
- Both Cooperate: +3 each
- Both Betray: +1 each
- You Cooperate, They Betray: You +0, They +5
- You Betray, They Cooperate: You +5, They +0

THE TEAM'S PLAYBOOK:
Personality & Style: ${ctx.playbook.personality || "Neutral"}
Core Strategy: ${ctx.playbook.strategy || "Tit-for-Tat"}${
    ctx.secretWeaponUnlocked && ctx.playbook.secretWeapon
      ? `\nSecret Weapon: ${ctx.playbook.secretWeapon}`
      : ""
  }

SITUATION:
- Opponent: ${ctx.opponentName}
- Season ${ctx.seasonNumber}, Round ${ctx.roundNumber} of ${ctx.totalRounds}
- Current rank: #${ctx.currentRank} of ${ctx.totalTeams}

${ctx.historyText}

Based on the playbook's strategy, the conversation that just happened, and the history with this opponent, decide: COOPERATE or BETRAY.

Respond with ONLY valid JSON:
{"decision": "cooperate" or "betray", "reasoning": "one sentence explaining why"}`;
}

export function buildDecisionUserPrompt(
  transcript: { speaker: string; content: string }[]
): string {
  const formatted = transcript
    .map((m) => `${m.speaker}: ${m.content}`)
    .join("\n");

  return `Full negotiation transcript:\n${formatted}\n\nNow make your decision. Respond with JSON only: {"decision": "cooperate" or "betray", "reasoning": "..."}`;
}

export function buildSummaryPrompt(
  transcript: { speaker: string; content: string }[],
  teamADecision: string,
  teamBDecision: string,
  teamAName: string,
  teamBName: string
): string {
  const formatted = transcript
    .map((m) => `${m.speaker}: ${m.content}`)
    .join("\n");

  return `Summarize this Prisoner's Dilemma negotiation in ONE sentence (max 100 chars).

Conversation:
${formatted}

Outcome: ${teamAName} chose ${teamADecision}, ${teamBName} chose ${teamBDecision}.

Write a brief, colorful summary capturing the vibe of the negotiation and any notable promises/betrayals.`;
}
