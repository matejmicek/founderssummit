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
