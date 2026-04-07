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
 * Round matchups: each team plays the same number of matches per round.
 * Pairs by rank proximity, avoids rematches from this season where possible.
 *
 * With even teams: N/2 matches per pass, 2 passes = N matches (each team plays 2).
 * With odd teams: uses round-robin rotation so every team gets equal matches.
 *
 * Guarantees: every team plays exactly the same number of matches.
 */
export function getRoundMatchups(
  teamIds: string[],
  previousOpponents: Record<string, Set<string>> = {}
): { teamAId: string; teamBId: string }[] {
  const n = teamIds.length;
  if (n < 2) return [];
  if (n === 2) return [{ teamAId: teamIds[0], teamBId: teamIds[1] }];
  if (n === 3) {
    // 3 teams: full round-robin (each plays 2) = 3 matches
    return getAllMatchups(teamIds);
  }

  // For odd team counts: use round-robin subset to guarantee equality.
  // For even: two pairing passes give exactly 2 matches each.
  if (n % 2 === 1) {
    // Odd teams: generate all possible matchups, then pick a subset where
    // every team plays exactly 2 matches. This is a "2-regular" subgraph.
    const all = getAllMatchups(teamIds);

    // Shuffle based on rank proximity (prefer close-ranked opponents)
    // Already sorted by rank, so getAllMatchups naturally pairs close ranks first.

    // Pick matches so every team plays exactly 2.
    // Use backtracking to guarantee a valid assignment exists.
    const target = 2;
    const used: Record<string, number> = {};
    for (const id of teamIds) used[id] = 0;

    // Sort: prefer unfaced opponents
    const prev = previousOpponents;
    const sorted = [...all].sort((a, b) => {
      const aFaced = prev[a.teamAId]?.has(a.teamBId) ? 1 : 0;
      const bFaced = prev[b.teamAId]?.has(b.teamBId) ? 1 : 0;
      return aFaced - bFaced;
    });

    const result: { teamAId: string; teamBId: string }[] = [];

    function backtrack(idx: number): boolean {
      // Check if all teams have exactly target matches
      if (Object.values(used).every((c) => c === target)) return true;
      if (idx >= sorted.length) return false;

      for (let i = idx; i < sorted.length; i++) {
        const m = sorted[i];
        if (used[m.teamAId] < target && used[m.teamBId] < target) {
          result.push(m);
          used[m.teamAId]++;
          used[m.teamBId]++;
          if (backtrack(i + 1)) return true;
          result.pop();
          used[m.teamAId]--;
          used[m.teamBId]--;
        }
      }
      return false;
    }

    backtrack(0);
    return result;
  }

  // Even teams: two pairing passes
  const avoid: Record<string, Set<string>> = {};
  for (const id of teamIds) {
    avoid[id] = new Set(previousOpponents[id] || []);
  }

  const firstPass = pairByRank(teamIds, avoid);
  for (const m of firstPass) {
    avoid[m.teamAId].add(m.teamBId);
    avoid[m.teamBId].add(m.teamAId);
  }

  const secondPass = pairByRank(teamIds, avoid);

  return [...firstPass, ...secondPass];
}

/**
 * Pair teams by rank proximity. Even count → N/2 pairs.
 * Odd count → (N-1)/2 pairs + 1 team left out.
 */
function pairByRank(
  teamIds: string[],
  avoid: Record<string, Set<string>>
): { teamAId: string; teamBId: string }[] {
  const matchups: { teamAId: string; teamBId: string }[] = [];
  const paired = new Set<string>();

  for (const teamId of teamIds) {
    if (paired.has(teamId)) continue;

    const prev = avoid[teamId] || new Set();
    let bestUnfaced: string | null = null;
    let bestAny: string | null = null;

    for (const candidateId of teamIds) {
      if (candidateId === teamId || paired.has(candidateId)) continue;
      if (!prev.has(candidateId) && !bestUnfaced) bestUnfaced = candidateId;
      if (!bestAny) bestAny = candidateId;
    }

    const opponent = bestUnfaced || bestAny;
    if (opponent) {
      matchups.push({ teamAId: teamId, teamBId: opponent });
      paired.add(teamId);
      paired.add(opponent);
    }
  }

  return matchups;
}
