// Escalating round rules — each round introduces one new variable (Evolution of Trust style)

export interface RoundRules {
  label: string;
  noiseChance: number;         // 0-1, probability of decision flip
  memoryEnabled: boolean;      // whether agents reference past encounters
  secretWeaponEnabled: boolean;
  turnsPerMatch: number;       // 3 or 5
  eliminationCount: number;    // how many teams eliminated after round
  payoffMultiplier: number;    // on top of season multiplier
  decisionTimerSeconds: number; // countdown for human decisions
}

/**
 * Default escalating rules per round number.
 * Round 1: Basic — no memory, no secret weapon, just personality + decisions
 * Round 2: Memory — agents now reference what happened in previous rounds
 * Round 3: Secret Weapon — unlock the secret weapon field
 * Round 4: Noise — 15% chance of random decision flip (forgiveness mechanic)
 * Round 5: Endgame — double stakes, elimination format
 */
export const DEFAULT_ROUND_RULES: Record<number, RoundRules> = {
  1: {
    label: "First Contact",
    noiseChance: 0,
    memoryEnabled: false,
    secretWeaponEnabled: false,
    turnsPerMatch: 3,
    eliminationCount: 0,
    payoffMultiplier: 1,
    decisionTimerSeconds: 20,
  },
  2: {
    label: "Memory",
    noiseChance: 0,
    memoryEnabled: true,
    secretWeaponEnabled: false,
    turnsPerMatch: 3,
    eliminationCount: 0,
    payoffMultiplier: 1,
    decisionTimerSeconds: 20,
  },
  3: {
    label: "Secret Weapon",
    noiseChance: 0,
    memoryEnabled: true,
    secretWeaponEnabled: true,
    turnsPerMatch: 3,
    eliminationCount: 0,
    payoffMultiplier: 1,
    decisionTimerSeconds: 20,
  },
  4: {
    label: "Noise",
    noiseChance: 0.15,
    memoryEnabled: true,
    secretWeaponEnabled: true,
    turnsPerMatch: 3,
    eliminationCount: 0,
    payoffMultiplier: 1,
    decisionTimerSeconds: 20,
  },
  5: {
    label: "Endgame",
    noiseChance: 0,
    memoryEnabled: true,
    secretWeaponEnabled: true,
    turnsPerMatch: 3,
    eliminationCount: 2,
    payoffMultiplier: 2,
    decisionTimerSeconds: 15,
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
    emoji: "🕊️",
    name: "The Diplomat",
    personality: "I seek mutual benefit above all. I keep my promises and expect the same. Calm, measured, trustworthy.",
    color: "#22c55e",
  },
  {
    id: "shark",
    emoji: "🦈",
    name: "The Shark",
    personality: "I exploit weakness. Trust is a tool to be used and discarded. Aggressive, calculating, ruthless.",
    color: "#ef4444",
  },
  {
    id: "mirror",
    emoji: "🪞",
    name: "The Mirror",
    personality: "I match your energy exactly. Cooperate with me and I cooperate back. Cross me and I make you pay. Fair but fierce.",
    color: "#3b82f6",
  },
  {
    id: "wildcard",
    emoji: "🃏",
    name: "The Wildcard",
    personality: "Unpredictable and proud of it. Sometimes generous, sometimes ruthless. You never know which version you'll get.",
    color: "#a855f7",
  },
  {
    id: "grudge",
    emoji: "🗡️",
    name: "The Grudge-Holder",
    personality: "I forgive nothing. Cross me once, and I will remember. Loyal to allies but devastating to enemies.",
    color: "#f97316",
  },
  {
    id: "charmer",
    emoji: "🎭",
    name: "The Charmer",
    personality: "Sweet-talking and persuasive. I make everyone feel like my best friend — right up until the moment I'm not. Disarming and dangerous.",
    color: "#ec4899",
  },
];
