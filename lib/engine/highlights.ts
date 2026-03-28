import { createServerClient } from "@/lib/supabase";
import { chatCompletion } from "@/lib/anthropic";

interface MatchSummary {
  matchId: string;
  teamAName: string;
  teamBName: string;
  teamADecision: string;
  teamBDecision: string;
  teamAScore: number;
  teamBScore: number;
  transcript: string;
  teamAReasoning: string;
  teamBReasoning: string;
}

export async function generateHighlights(
  seasonId: number,
  round: number
): Promise<number> {
  const supabase = createServerClient();

  // Get all completed matches for this round with teams
  const { data: matches } = await supabase
    .from("matches")
    .select(
      "id, team_a_id, team_b_id, team_a_decision, team_b_decision, team_a_score, team_b_score, team_a_reasoning, team_b_reasoning, team_a:teams!matches_team_a_id_fkey(name), team_b:teams!matches_team_b_id_fkey(name)"
    )
    .eq("season_id", seasonId)
    .eq("round", round)
    .eq("status", "completed");

  if (!matches || matches.length === 0) return 0;

  // Get transcripts and turns for all matches
  const matchIds = matches.map((m) => m.id);

  const [{ data: allMessages }, { data: allTurns }] = await Promise.all([
    supabase
      .from("messages")
      .select("match_id, team_id, content, sequence, turn")
      .in("match_id", matchIds)
      .order("sequence"),
    supabase
      .from("match_turns")
      .select("match_id, turn, team_a_decision, team_b_decision, team_a_score, team_b_score")
      .in("match_id", matchIds)
      .order("turn"),
  ]);

  // Build match summaries
  const summaries: MatchSummary[] = matches.map((m) => {
    const msgs = (allMessages || [])
      .filter((msg) => msg.match_id === m.id)
      .sort((a, b) => a.sequence - b.sequence);

    const turns = (allTurns || [])
      .filter((t) => t.match_id === m.id)
      .sort((a, b) => a.turn - b.turn);

    // Build per-turn transcript
    const transcript = [1, 2, 3]
      .map((turnNum) => {
        const turnMsgs = msgs.filter((msg) => msg.turn === turnNum);
        const turnResult = turns.find((t) => t.turn === turnNum);
        const convo = turnMsgs
          .map((msg) => {
            const speaker =
              msg.team_id === m.team_a_id
                ? (m.team_a as unknown as { name: string }).name
                : (m.team_b as unknown as { name: string }).name;
            return `  ${speaker}: ${msg.content}`;
          })
          .join("\n");
        const outcome = turnResult
          ? `  Result: ${(m.team_a as unknown as { name: string }).name} ${turnResult.team_a_decision} (+${turnResult.team_a_score}), ${(m.team_b as unknown as { name: string }).name} ${turnResult.team_b_decision} (+${turnResult.team_b_score})`
          : "";
        return `--- Turn ${turnNum} ---\n${convo}\n${outcome}`;
      })
      .join("\n");

    const totalA = turns.reduce((s, t) => s + t.team_a_score, 0);
    const totalB = turns.reduce((s, t) => s + t.team_b_score, 0);

    return {
      matchId: m.id,
      teamAName: (m.team_a as unknown as { name: string }).name,
      teamBName: (m.team_b as unknown as { name: string }).name,
      teamADecision: m.team_a_decision || "unknown",
      teamBDecision: m.team_b_decision || "unknown",
      teamAScore: totalA || m.team_a_score || 0,
      teamBScore: totalB || m.team_b_score || 0,
      transcript,
      teamAReasoning: m.team_a_reasoning || "",
      teamBReasoning: m.team_b_reasoning || "",
    };
  });

  // Build the prompt
  const matchDescriptions = summaries
    .map(
      (s, i) =>
        `=== MATCH ${i + 1} (ID: ${s.matchId}) ===
${s.teamAName} vs ${s.teamBName}
Final score: ${s.teamAName} +${s.teamAScore}, ${s.teamBName} +${s.teamBScore}

${s.transcript}`
    )
    .join("\n\n");

  const numHighlights = Math.min(3, summaries.length);

  const systemPrompt = `You are a tactical analyst for a Prisoner's Dilemma tournament, presenting match breakdowns to the competing teams (audience of ~70 people). Your job is to narrate each match turn-by-turn so teams understand EXACTLY what happened and can improve their agent's prompt for next time.

Think of this like a post-game film review — break down the negotiation moves, the psychological tactics, and the pivotal moments where one agent outplayed the other.

Your commentary MUST:
- Go turn by turn: "Turn 1: [team] opened with [tactic]... [other team] responded by... Result: [outcome]"
- Quote or paraphrase what the agents actually said — the specific promises, threats, guilt trips, or bluffs
- Explain HOW deception worked or failed: "They promised cooperation but the betrayal was already baked into their framing"
- Highlight the game dynamics: Did trust build? When did it break? Who adapted and who got stuck?
- Call out what was smart and what was dumb — what should a team change in their prompt to handle this better?
- End with a one-line tactical takeaway: what's the lesson from this match?

Keep it punchy and specific. No generic filler. Every sentence should teach the audience something about what happened.

You MUST respond with valid JSON only — no other text.`;

  const userPrompt = `Here are ${summaries.length} matches from this round. Pick the ${numHighlights} most interesting ones and write tactical breakdowns.

Prioritize matches with: broken promises that actually worked, clever manipulation across turns, surprising strategy pivots, agents that got completely outplayed, or funny/dramatic negotiation dynamics.

${matchDescriptions}

Respond with JSON array (${numHighlights} items):
[{
  "match_id": "the match UUID",
  "title": "catchy 3-6 word headline",
  "commentary": "Turn-by-turn tactical breakdown (5-8 sentences). Cover each turn: what was said, what tactics were used, how trust/deception played out, and what the outcome was. Quote the agents. End with a tactical takeaway for the teams.",
  "highlight_type": "betrayal" | "alliance" | "upset" | "comedy" | "tragedy" | "mindgame"
}]`;

  try {
    const response = await chatCompletion("smart", systemPrompt, userPrompt, 2000);

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array in response");

    const highlights = JSON.parse(jsonMatch[0]);

    // Validate and insert
    const rows = highlights
      .slice(0, numHighlights)
      .map(
        (
          h: {
            match_id: string;
            title: string;
            commentary: string;
            highlight_type: string;
          },
          idx: number
        ) => {
          // Verify match_id exists
          const validMatchId = summaries.find(
            (s) => s.matchId === h.match_id
          );
          return {
            season_id: seasonId,
            round,
            match_id: validMatchId ? h.match_id : summaries[idx]?.matchId,
            title: (h.title || "Notable Match").slice(0, 100),
            commentary: (h.commentary || "An interesting match.").slice(0, 1500),
            highlight_type: h.highlight_type || "drama",
            ranking: idx + 1,
          };
        }
      )
      .filter(
        (r: { match_id: string | undefined }) => r.match_id !== undefined
      );

    if (rows.length > 0) {
      await supabase.from("highlights").insert(rows);
    }

    return rows.length;
  } catch (error) {
    console.error("Highlight generation failed:", error);
    // Fallback: pick random matches
    const fallback = summaries.slice(0, numHighlights).map((s, idx) => ({
      season_id: seasonId,
      round,
      match_id: s.matchId,
      title:
        s.teamADecision !== s.teamBDecision
          ? "A Betrayal Unfolds"
          : s.teamADecision === "cooperate"
          ? "Trust Prevails"
          : "Mutual Destruction",
      commentary: `${s.teamAName} chose to ${s.teamADecision} while ${s.teamBName} chose to ${s.teamBDecision}. The scores: ${s.teamAScore}-${s.teamBScore}.`,
      highlight_type: "drama",
      ranking: idx + 1,
    }));

    if (fallback.length > 0) {
      await supabase.from("highlights").insert(fallback);
    }
    return fallback.length;
  }
}

export async function generateTeamHighlights(
  seasonId: number,
  round: number
): Promise<number> {
  const supabase = createServerClient();

  // Get all teams from this season's matches
  const { data: matches } = await supabase
    .from("matches")
    .select(
      "id, team_a_id, team_b_id, team_a_decision, team_b_decision, team_a_score, team_b_score, team_a_reasoning, team_b_reasoning, team_a:teams!matches_team_a_id_fkey(name), team_b:teams!matches_team_b_id_fkey(name)"
    )
    .eq("season_id", seasonId)
    .eq("round", round)
    .eq("status", "completed");

  if (!matches || matches.length === 0) return 0;

  const matchIds = matches.map((m) => m.id);

  const [{ data: allMessages }, { data: allTurns }] = await Promise.all([
    supabase
      .from("messages")
      .select("match_id, team_id, content, sequence, turn")
      .in("match_id", matchIds)
      .order("sequence"),
    supabase
      .from("match_turns")
      .select("match_id, turn, team_a_decision, team_b_decision, team_a_score, team_b_score")
      .in("match_id", matchIds)
      .order("turn"),
  ]);

  // Collect all unique team IDs
  const teamIdSet = new Set<string>();
  for (const m of matches) {
    teamIdSet.add(m.team_a_id);
    teamIdSet.add(m.team_b_id);
  }

  let totalGenerated = 0;

  // For each team, pick their 2 best matches
  const teamResults = await Promise.allSettled(
    Array.from(teamIdSet).map(async (teamId) => {
      const teamMatches = matches.filter(
        (m) => m.team_a_id === teamId || m.team_b_id === teamId
      );

      if (teamMatches.length === 0) return 0;

      // Build summaries from this team's perspective
      const summaries = teamMatches.map((m) => {
        const isTeamA = m.team_a_id === teamId;
        const myName = isTeamA
          ? (m.team_a as unknown as { name: string }).name
          : (m.team_b as unknown as { name: string }).name;
        const oppName = isTeamA
          ? (m.team_b as unknown as { name: string }).name
          : (m.team_a as unknown as { name: string }).name;

        const msgs = (allMessages || [])
          .filter((msg) => msg.match_id === m.id)
          .sort((a, b) => a.sequence - b.sequence);

        const turns = (allTurns || [])
          .filter((t) => t.match_id === m.id)
          .sort((a, b) => a.turn - b.turn);

        const transcript = [1, 2, 3]
          .map((turnNum) => {
            const turnMsgs = msgs.filter((msg) => msg.turn === turnNum);
            const turnResult = turns.find((t) => t.turn === turnNum);
            const convo = turnMsgs
              .map((msg) => {
                const speaker =
                  msg.team_id === m.team_a_id
                    ? (m.team_a as unknown as { name: string }).name
                    : (m.team_b as unknown as { name: string }).name;
                return `  ${speaker}: ${msg.content}`;
              })
              .join("\n");
            const myDecision = isTeamA
              ? turnResult?.team_a_decision
              : turnResult?.team_b_decision;
            const oppDecision = isTeamA
              ? turnResult?.team_b_decision
              : turnResult?.team_a_decision;
            const myScore = isTeamA
              ? turnResult?.team_a_score
              : turnResult?.team_b_score;
            const oppScore = isTeamA
              ? turnResult?.team_b_score
              : turnResult?.team_a_score;
            const outcome = turnResult
              ? `  Result: You ${myDecision} (+${myScore}), ${oppName} ${oppDecision} (+${oppScore})`
              : "";
            return `--- Turn ${turnNum} ---\n${convo}\n${outcome}`;
          })
          .join("\n");

        const myTotal = turns.reduce(
          (s, t) => s + (isTeamA ? t.team_a_score : t.team_b_score),
          0
        );
        const oppTotal = turns.reduce(
          (s, t) => s + (isTeamA ? t.team_b_score : t.team_a_score),
          0
        );

        return {
          matchId: m.id,
          myName,
          oppName,
          myTotal,
          oppTotal,
          transcript,
        };
      });

      const numHighlights = Math.min(2, summaries.length);

      const matchDescriptions = summaries
        .map(
          (s, i) =>
            `=== MATCH ${i + 1} (ID: ${s.matchId}) ===
Your team (${s.myName}) vs ${s.oppName}
Final score: You +${s.myTotal}, ${s.oppName} +${s.oppTotal}

${s.transcript}`
        )
        .join("\n\n");

      const teamName = summaries[0].myName;

      const systemPrompt = `You are a personal match analyst for team "${teamName}" in a Prisoner's Dilemma tournament. Your job is to pick the ${numHighlights} most interesting or important matches for THIS team and give them a personalized breakdown they can learn from.

Focus on:
- Matches where something surprising, funny, or dramatic happened
- Matches where the team got outplayed and needs to learn
- Matches where their strategy worked brilliantly
- Interesting negotiation dynamics or psychological moments

Your commentary should be written TO the team — use "you" and "your agent". Help them understand what happened and what to change.

You MUST respond with valid JSON only — no other text.`;

      const userPrompt = `Here are all ${summaries.length} matches your team played this round. Pick the ${numHighlights} most interesting ones and write personalized breakdowns.

${matchDescriptions}

Respond with JSON array (${numHighlights} items):
[{
  "match_id": "the match UUID",
  "title": "catchy 3-6 word headline",
  "commentary": "Personalized turn-by-turn breakdown (4-6 sentences). Address the team directly. Quote interesting agent dialogue. Point out what worked, what didn't, and what to change.",
  "highlight_type": "betrayal" | "alliance" | "upset" | "comedy" | "tragedy" | "mindgame"
}]`;

      try {
        const response = await chatCompletion("smart", systemPrompt, userPrompt, 1500);
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error("No JSON array in response");

        const highlights = JSON.parse(jsonMatch[0]);

        const rows = highlights
          .slice(0, numHighlights)
          .map(
            (
              h: {
                match_id: string;
                title: string;
                commentary: string;
                highlight_type: string;
              },
              idx: number
            ) => {
              const validMatchId = summaries.find(
                (s) => s.matchId === h.match_id
              );
              return {
                season_id: seasonId,
                round,
                match_id: validMatchId ? h.match_id : summaries[idx]?.matchId,
                team_id: teamId,
                title: (h.title || "Your Highlight").slice(0, 100),
                commentary: (h.commentary || "An interesting match for your team.").slice(0, 1500),
                highlight_type: h.highlight_type || "drama",
                ranking: idx + 1,
              };
            }
          )
          .filter(
            (r: { match_id: string | undefined }) => r.match_id !== undefined
          );

        if (rows.length > 0) {
          await supabase.from("highlights").insert(rows);
        }
        return rows.length;
      } catch (error) {
        console.error(`Team highlight generation failed for ${teamId}:`, error);
        // Fallback: pick first 2 matches
        const fallback = summaries.slice(0, numHighlights).map((s, idx) => ({
          season_id: seasonId,
          round,
          match_id: s.matchId,
          team_id: teamId,
          title: s.myTotal > s.oppTotal ? "A Strong Performance" : "Lessons Learned",
          commentary: `Your agent scored ${s.myTotal} against ${s.oppName}'s ${s.oppTotal}. Review the transcript to see what happened.`,
          highlight_type: "drama",
          ranking: idx + 1,
        }));
        if (fallback.length > 0) {
          await supabase.from("highlights").insert(fallback);
        }
        return fallback.length;
      }
    })
  );

  for (const r of teamResults) {
    if (r.status === "fulfilled") totalGenerated += r.value;
  }

  return totalGenerated;
}

export async function getHighlightData(
  seasonId: number,
  round: number
): Promise<
  {
    id: string;
    title: string;
    commentary: string;
    highlight_type: string;
    teamAName: string;
    teamBName: string;
    teamADecision: string;
    teamBDecision: string;
    teamAScore: number;
    teamBScore: number;
  }[]
> {
  const supabase = createServerClient();

  const { data: highlights } = await supabase
    .from("highlights")
    .select(
      "id, title, commentary, highlight_type, match:matches(team_a:teams!matches_team_a_id_fkey(name), team_b:teams!matches_team_b_id_fkey(name), team_a_decision, team_b_decision, team_a_score, team_b_score)"
    )
    .eq("season_id", seasonId)
    .eq("round", round)
    .is("team_id", null)
    .order("ranking");

  if (!highlights) return [];

  return highlights.map((h) => {
    const match = h.match as unknown as {
      team_a: { name: string };
      team_b: { name: string };
      team_a_decision: string;
      team_b_decision: string;
      team_a_score: number;
      team_b_score: number;
    };
    return {
      id: h.id,
      title: h.title,
      commentary: h.commentary,
      highlight_type: h.highlight_type || "drama",
      teamAName: match?.team_a?.name || "Team A",
      teamBName: match?.team_b?.name || "Team B",
      teamADecision: match?.team_a_decision || "unknown",
      teamBDecision: match?.team_b_decision || "unknown",
      teamAScore: match?.team_a_score || 0,
      teamBScore: match?.team_b_score || 0,
    };
  });
}

export async function getTeamHighlightData(
  seasonId: number,
  round: number
): Promise<
  {
    id: string;
    title: string;
    commentary: string;
    highlight_type: string;
    teamAName: string;
    teamBName: string;
    teamADecision: string;
    teamBDecision: string;
    teamAScore: number;
    teamBScore: number;
  }[]
> {
  const supabase = createServerClient();

  const { data: highlights } = await supabase
    .from("highlights")
    .select(
      "id, title, commentary, highlight_type, match:matches(team_a:teams!matches_team_a_id_fkey(name), team_b:teams!matches_team_b_id_fkey(name), team_a_decision, team_b_decision, team_a_score, team_b_score)"
    )
    .eq("season_id", seasonId)
    .eq("round", round)
    .not("team_id", "is", null)
    .order("ranking");

  if (!highlights) return [];

  return highlights.map((h) => {
    const match = h.match as unknown as {
      team_a: { name: string };
      team_b: { name: string };
      team_a_decision: string;
      team_b_decision: string;
      team_a_score: number;
      team_b_score: number;
    };
    return {
      id: h.id,
      title: h.title,
      commentary: h.commentary,
      highlight_type: h.highlight_type || "drama",
      teamAName: match?.team_a?.name || "Team A",
      teamBName: match?.team_b?.name || "Team B",
      teamADecision: match?.team_a_decision || "unknown",
      teamBDecision: match?.team_b_decision || "unknown",
      teamAScore: match?.team_a_score || 0,
      teamBScore: match?.team_b_score || 0,
    };
  });
}
