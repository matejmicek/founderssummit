// Circle method round-robin scheduling
// For N teams, generates N-1 rounds of N/2 matches each

export interface Matchup {
  teamAIndex: number;
  teamBIndex: number;
}

export function generateRoundRobin(teamCount: number): Matchup[][] {
  if (teamCount < 2) return [];

  // If odd number of teams, add a "bye" slot
  const n = teamCount % 2 === 0 ? teamCount : teamCount + 1;
  const rounds: Matchup[][] = [];

  // Create array of team indices
  const teams = Array.from({ length: n }, (_, i) => i);

  for (let round = 0; round < n - 1; round++) {
    const matchups: Matchup[] = [];

    for (let i = 0; i < n / 2; i++) {
      const home = teams[i];
      const away = teams[n - 1 - i];

      // Skip "bye" matches (index >= actual team count)
      if (home < teamCount && away < teamCount) {
        matchups.push({ teamAIndex: home, teamBIndex: away });
      }
    }

    rounds.push(matchups);

    // Rotate: fix position 0, rotate rest clockwise
    const last = teams.pop()!;
    teams.splice(1, 0, last);
  }

  return rounds;
}

// Get matchups for a specific round number (0-indexed)
export function getMatchupsForRound(
  teamIds: string[],
  roundIndex: number
): { teamAId: string; teamBId: string }[] {
  const allRounds = generateRoundRobin(teamIds.length);
  const round = allRounds[roundIndex % allRounds.length];

  return round.map((m) => ({
    teamAId: teamIds[m.teamAIndex],
    teamBId: teamIds[m.teamBIndex],
  }));
}
