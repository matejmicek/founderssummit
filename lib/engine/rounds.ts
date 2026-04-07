// Escalating round rules — each round introduces one new variable (Evolution of Trust style)

export interface RoundRules {
  label: string;
  memoryEnabled: boolean;      // whether agents reference past encounters
  turnsPerMatch: number;       // 3 or 5
  eliminationCount: number;    // how many teams eliminated after round
  payoffMultiplier: number;    // on top of season multiplier
  noiseChance: number;         // always 0, kept for interface compat
}

/**
 * Default escalating rules per round number.
 * Round 1: Basic — no memory, just personality + decisions
 * Round 2: Memory — agents now reference what happened in previous rounds
 * Round 3: High Stakes — double points
 * Round 4: Endgame — double points, elimination
 * Round 5+: Finals — same as round 4
 */
export const DEFAULT_ROUND_RULES: Record<number, RoundRules> = {
  1: {
    label: "First Contact",
    noiseChance: 0,
    memoryEnabled: false,
    turnsPerMatch: 3,
    eliminationCount: 0,
    payoffMultiplier: 1,
  },
  2: {
    label: "Memory",
    noiseChance: 0,
    memoryEnabled: true,
    turnsPerMatch: 3,
    eliminationCount: 0,
    payoffMultiplier: 1,
  },
  3: {
    label: "High Stakes",
    noiseChance: 0,
    memoryEnabled: true,
    turnsPerMatch: 3,
    eliminationCount: 0,
    payoffMultiplier: 2,
  },
  4: {
    label: "Endgame",
    noiseChance: 0,
    memoryEnabled: true,
    turnsPerMatch: 3,
    eliminationCount: 2,
    payoffMultiplier: 2,
  },
  5: {
    label: "Finals",
    noiseChance: 0,
    memoryEnabled: true,
    turnsPerMatch: 3,
    eliminationCount: 2,
    payoffMultiplier: 2,
  },
};

export function getRoundRules(
  roundNumber: number,
  customRules?: Partial<RoundRules>
): RoundRules {
  const defaults = DEFAULT_ROUND_RULES[roundNumber] || DEFAULT_ROUND_RULES[5];
  if (!customRules) return defaults;
  return { ...defaults, ...customRules };
}

// Personality archetypes for quick-start (Round 1)
export const ARCHETYPES = [
  {
    id: "diplomat",
    emoji: "\u{1F54A}\u{FE0F}",
    name: "The Diplomat",
    personality: "I seek mutual benefit above all. I keep my promises and expect the same. Calm, measured, trustworthy.",
    color: "#22c55e",
  },
  {
    id: "shark",
    emoji: "\u{1F988}",
    name: "The Shark",
    personality: "I exploit weakness. Trust is a tool to be used and discarded. Aggressive, calculating, ruthless.",
    color: "#ef4444",
  },
  {
    id: "mirror",
    emoji: "\u{1FA9E}",
    name: "The Mirror",
    personality: "I match your energy exactly. Cooperate with me and I cooperate back. Cross me and I make you pay. Fair but fierce.",
    color: "#3b82f6",
  },
  {
    id: "wildcard",
    emoji: "\u{1F0CF}",
    name: "The Wildcard",
    personality: "Unpredictable and proud of it. Sometimes generous, sometimes ruthless. You never know which version you'll get.",
    color: "#a855f7",
  },
  {
    id: "grudge",
    emoji: "\u{1F5E1}\u{FE0F}",
    name: "The Grudge-Holder",
    personality: "I forgive nothing. Cross me once, and I will remember. Loyal to allies but devastating to enemies.",
    color: "#f97316",
  },
  {
    id: "charmer",
    emoji: "\u{1F3AD}",
    name: "The Charmer",
    personality: "Sweet-talking and persuasive. I make everyone feel like my best friend \u2014 right up until the moment I'm not. Disarming and dangerous.",
    color: "#ec4899",
  },
];
