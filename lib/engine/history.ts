import { createServerClient } from "@/lib/supabase";

export interface EncounterRecord {
  round: number;
  seasonNumber: number;
  myDecision: string;
  theirDecision: string;
  myScore: number;
  theirScore: number;
  summary: string | null;
}

export async function getEncounterHistory(
  teamId: string,
  opponentId: string
): Promise<EncounterRecord[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("encounter_history")
    .select("round, season_id, my_decision, their_decision, my_score, their_score, summary")
    .eq("team_id", teamId)
    .eq("opponent_id", opponentId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data || []).map((row) => ({
    round: row.round,
    seasonNumber: row.season_id,
    myDecision: row.my_decision,
    theirDecision: row.their_decision,
    myScore: row.my_score,
    theirScore: row.their_score,
    summary: row.summary,
  }));
}

export function formatHistoryForPrompt(
  history: EncounterRecord[],
  opponentName: string
): string {
  if (history.length === 0) {
    return `You have never faced ${opponentName} before. This is your first encounter.`;
  }

  const lines = history.map((h) => {
    const outcome =
      h.myDecision === "cooperate" && h.theirDecision === "cooperate"
        ? "mutual cooperation"
        : h.myDecision === "betray" && h.theirDecision === "betray"
        ? "mutual betrayal"
        : h.myDecision === "cooperate"
        ? "you cooperated, they betrayed you"
        : "you betrayed them, they cooperated";

    return `- Season ${h.seasonNumber}, Round ${h.round}: ${outcome} (you: ${h.myScore}pts, them: ${h.theirScore}pts)${h.summary ? ` — ${h.summary}` : ""}`;
  });

  return `Your history with ${opponentName}:\n${lines.join("\n")}`;
}
