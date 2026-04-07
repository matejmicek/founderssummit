// Generate all unique pairings for a full round-robin
// N teams → N*(N-1)/2 matches

export function getAllMatchups(
  teamIds: string[]
): { teamAId: string; teamBId: string }[] {
  const matchups: { teamAId: string; teamBId: string }[] = [];

  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      matchups.push({ teamAId: teamIds[i], teamBId: teamIds[j] });
    }
  }

  return matchups;
}

/**
 * Swiss-style pairing: each team plays exactly one match per round.
 * Pairs teams by similar rank (1v2, 3v4, etc). Shuffles within tiers for variety.
 * For odd number of teams, last team gets a bye.
 *
 * @param teamIds - ordered by current rank (best first)
 * @param previousOpponents - map of teamId -> set of opponent IDs already faced
 */
export function getSwissMatchups(
  teamIds: string[],
  previousOpponents: Record<string, Set<string>> = {}
): { teamAId: string; teamBId: string }[] {
  const matchups: { teamAId: string; teamBId: string }[] = [];
  const paired = new Set<string>();

  // Try to pair each team with the closest-ranked unpaired opponent they haven't faced
  for (const teamId of teamIds) {
    if (paired.has(teamId)) continue;

    const prev = previousOpponents[teamId] || new Set();

    // Find best available opponent (closest in rank, not yet faced if possible)
    let bestOpponent: string | null = null;
    let bestUnfaced: string | null = null;

    for (const candidateId of teamIds) {
      if (candidateId === teamId || paired.has(candidateId)) continue;

      if (!prev.has(candidateId) && !bestUnfaced) {
        bestUnfaced = candidateId;
      }
      if (!bestOpponent) {
        bestOpponent = candidateId;
      }
    }

    const opponent = bestUnfaced || bestOpponent;
    if (opponent) {
      matchups.push({ teamAId: teamId, teamBId: opponent });
      paired.add(teamId);
      paired.add(opponent);
    }
  }

  return matchups;
}
