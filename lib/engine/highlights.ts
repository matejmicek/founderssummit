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

  const systemPrompt = `You are a live sports commentator for a Prisoner's Dilemma tournament, presenting to an audience of 70 people. You narrate matches like a real sports broadcast — calling the action across all 3 turns, noting momentum shifts, strategy pivots, and key moments.

Your commentary should flow naturally across the turns like: "In turn one, X tried to... but by turn two, things shifted when... and in the final turn..." — covering the arc of the match. Keep it punchy and entertaining but grounded in what actually happened. Don't overdo the drama — let the facts speak.

You MUST respond with valid JSON only — no other text.`;

  const userPrompt = `Here are ${summaries.length} matches from this round. Pick the ${numHighlights} most interesting ones and write commentary.

Look for: shifting strategies across turns, broken promises, surprising cooperation, funny dialogue, or dramatic reversals.

${matchDescriptions}

Respond with JSON array (${numHighlights} items):
[{
  "match_id": "the match UUID",
  "title": "catchy 3-6 word headline",
  "commentary": "3-4 sentences narrating the match like a sports commentator. Cover the flow across all 3 turns — what happened, how the strategy evolved, and the outcome. Be specific about what the agents said and did.",
  "highlight_type": "betrayal" | "alliance" | "upset" | "comedy" | "tragedy" | "mindgame"
}]`;

  try {
    const response = await chatCompletion("smart", systemPrompt, userPrompt, 1000);

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
            commentary: (h.commentary || "An interesting match.").slice(0, 500),
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
