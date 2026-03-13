require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data: turns } = await supabase.from("match_turns").select("*").order("turn");
  const byMatch = {};
  for (const t of turns || []) {
    if (!byMatch[t.match_id]) byMatch[t.match_id] = [];
    byMatch[t.match_id].push(t);
  }

  for (const [matchId, mTurns] of Object.entries(byMatch)) {
    const sorted = mTurns.sort((a, b) => a.turn - b.turn);
    const last = sorted[sorted.length - 1];
    const totalA = sorted.reduce((s, t) => s + t.team_a_score, 0);
    const totalB = sorted.reduce((s, t) => s + t.team_b_score, 0);

    const { error } = await supabase.from("matches").update({
      team_a_decision: last.team_a_decision,
      team_b_decision: last.team_b_decision,
      team_a_score: totalA,
      team_b_score: totalB,
      status: "completed",
    }).eq("id", matchId);

    console.log(matchId, totalA, totalB, error ? error.message : "OK");
  }
})();
