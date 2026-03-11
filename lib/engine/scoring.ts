// Classic Prisoner's Dilemma payoff matrix
// Both cooperate: +3, +3
// Both betray: +1, +1
// One cooperates, one betrays: cooperator +0, betrayer +5

export type Decision = "cooperate" | "betray";

export interface MatchScore {
  teamAScore: number;
  teamBScore: number;
}

export function calculateScore(
  teamADecision: Decision,
  teamBDecision: Decision,
  multiplier: number = 1
): MatchScore {
  let teamAScore: number;
  let teamBScore: number;

  if (teamADecision === "cooperate" && teamBDecision === "cooperate") {
    teamAScore = 3;
    teamBScore = 3;
  } else if (teamADecision === "betray" && teamBDecision === "betray") {
    teamAScore = 1;
    teamBScore = 1;
  } else if (teamADecision === "cooperate" && teamBDecision === "betray") {
    teamAScore = 0;
    teamBScore = 5;
  } else {
    // teamA betrays, teamB cooperates
    teamAScore = 5;
    teamBScore = 0;
  }

  return {
    teamAScore: teamAScore * multiplier,
    teamBScore: teamBScore * multiplier,
  };
}
