import { createServerClient } from "@/lib/supabase";

const MAX_HISTORY_ENTRIES = 5;

export interface TurnDecision {
  turn: number;
  my: string;
  their: string;
  myScore: number;
  theirScore: number;
}

export interface EncounterRecord {
  round: number;
  seasonNumber: number;
  myDecision: string;
  theirDecision: string;
  myScore: number;
  theirScore: number;
  summary: string | null;
  turnDecisions: TurnDecision[] | null;
}

export async function getEncounterHistory(
  teamId: string,
  opponentId: string
): Promise<EncounterRecord[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("encounter_history")
    .select("round, season_id, my_decision, their_decision, my_score, their_score, summary, turn_decisions, seasons!inner(number)")
    .eq("team_id", teamId)
    .eq("opponent_id", opponentId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const records = (data || []).map((row) => ({
    round: row.round,
    seasonNumber: (row.seasons as unknown as { number: number }).number,
    myDecision: row.my_decision,
    theirDecision: row.their_decision,
    myScore: row.my_score,
    theirScore: row.their_score,
    summary: row.summary,
    turnDecisions: row.turn_decisions as TurnDecision[] | null,
  }));

  return records.slice(-MAX_HISTORY_ENTRIES);
}

function describeOutcome(my: string, their: string): string {
  if (my === "cooperate" && their === "cooperate") return "mutual cooperation";
  if (my === "betray" && their === "betray") return "mutual betrayal";
  if (my === "cooperate") return "you cooperated, they betrayed you";
  return "you betrayed them, they cooperated";
}

function describeTurnArc(turns: TurnDecision[]): string {
  if (turns.length === 0) return "";

  const arc = turns.map((t) => `${t.my}/${t.their}`).join(" → ");
  const betrayals = turns.filter((t) => t.my !== t.their);
  const lastTurn = turns[turns.length - 1];
  const firstTurn = turns[0];

  // Detect patterns
  if (turns.every((t) => t.my === "cooperate" && t.their === "cooperate")) {
    return `Arc: ${arc} — Full trust maintained throughout`;
  }
  if (turns.every((t) => t.my === "betray" && t.their === "betray")) {
    return `Arc: ${arc} — All-out war from start to finish`;
  }
  if (firstTurn.my === "cooperate" && firstTurn.their === "cooperate" &&
      lastTurn.my === "betray" && lastTurn.their !== "betray") {
    return `Arc: ${arc} — Built trust then stabbed them in the back`;
  }
  if (firstTurn.my === "cooperate" && firstTurn.their === "cooperate" &&
      lastTurn.their === "betray" && lastTurn.my !== "betray") {
    return `Arc: ${arc} — They lured you in then backstabbed you`;
  }
  if (firstTurn.my === "cooperate" && firstTurn.their === "cooperate" &&
      lastTurn.my === "betray" && lastTurn.their === "betray") {
    return `Arc: ${arc} — Started friendly, then both went for the throat`;
  }
  if (betrayals.length > 0 && turns[turns.length - 1].my === "cooperate" && turns[turns.length - 1].their === "cooperate") {
    return `Arc: ${arc} — Rocky start but found peace in the end`;
  }

  return `Arc: ${arc}`;
}

export function formatHistoryForPrompt(
  history: EncounterRecord[],
  opponentName: string
): string {
  if (history.length === 0) {
    return `You have never faced ${opponentName} before. This is your first encounter.`;
  }

  const entries = history.map((h) => {
    const outcome = describeOutcome(h.myDecision, h.theirDecision);
    const header = `Season ${h.seasonNumber}: ${outcome} (you: ${h.myScore}pts, them: ${h.theirScore}pts)`;

    if (h.turnDecisions && h.turnDecisions.length > 0) {
      const arcLine = describeTurnArc(h.turnDecisions);
      const summaryLine = h.summary ? `  "${h.summary}"` : "";
      return `${header}\n  ${arcLine}${summaryLine ? "\n" + summaryLine : ""}`;
    }

    return `${header}${h.summary ? ` — ${h.summary}` : ""}`;
  });

  return `YOUR HISTORY WITH ${opponentName.toUpperCase()} (${history.length} previous encounter${history.length > 1 ? "s" : ""}):\n\n${entries.join("\n\n")}`;
}
