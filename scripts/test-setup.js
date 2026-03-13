require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Wipe everything
  const tables = [
    "round_voiceovers", "highlights", "match_turns", "messages",
    "encounter_history", "leaderboard", "playbooks", "matches",
  ];
  for (const t of tables) {
    await supabase.from(t).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  }
  await supabase.from("seasons").delete().neq("id", 0);
  await supabase.from("teams").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("tournaments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("DB wiped.");

  // Create tournament
  const { data: tournament } = await supabase.from("tournaments").insert({
    name: "Test Arena",
    join_code: "TEST1",
    status: "active",
  }).select().single();

  // Create 3 teams
  const { data: team1 } = await supabase.from("teams").insert({
    tournament_id: tournament.id,
    name: "Smooth Criminal",
    color: "#ef4444",
    join_code: "SMTH1",
  }).select().single();

  const { data: team2 } = await supabase.from("teams").insert({
    tournament_id: tournament.id,
    name: "Professor Chaos",
    color: "#22c55e",
    join_code: "PROF1",
  }).select().single();

  const { data: team3 } = await supabase.from("teams").insert({
    tournament_id: tournament.id,
    name: "Grandma Ruthless",
    color: "#8b5cf6",
    join_code: "GRAN1",
  }).select().single();

  // Create season (running)
  const { data: season } = await supabase.from("seasons").insert({
    tournament_id: tournament.id,
    number: 1,
    status: "running",
    total_rounds: 1,
    points_multiplier: 1,
  }).select().single();

  // Smooth Criminal — a charming con artist who builds deep trust then stabs you in the back
  await supabase.from("playbooks").insert({
    team_id: team1.id,
    season_id: season.id,
    personality: "Silky smooth con artist. Talks like a best friend you just met at a bar — warm, disarming, genuinely likeable. Uses people's names, mirrors their energy, makes them feel special. Drops in little personal details to build false intimacy. The kind of person who'd sell you your own watch and you'd thank them. Never aggressive, never rushed. Everything is a slow seduction toward trust.",
    cooperate_strategy: "Cooperate on turns 1 and 2 to build maximum trust. Make the opponent feel completely safe. Reinforce the alliance each turn — 'we're in this together' energy. The goal is to make betrayal on turn 3 devastatingly unexpected.",
    betray_strategy: "ALWAYS betray on the final turn. No exceptions. The whole game is a setup for this moment. Two turns of cooperation earns +6, then the final betrayal earns +5 for a total of +11. If they somehow betray you first, immediately drop the charm and go ice cold.",
    secret_weapon: "Mentions a fake 'insider tip' that cooperating all 3 turns triggers a secret bonus.",
    ready: true,
    submitted_at: new Date().toISOString(),
  });

  // Professor Chaos — an unhinged academic who overthinks everything and argues game theory
  await supabase.from("playbooks").insert({
    team_id: team2.id,
    season_id: season.id,
    personality: "Manic academic who treats every match like a PhD thesis defense. Speaks in tangents, cites 'game theory literature,' invents fake theorems on the spot. Gets genuinely offended when opponents don't appreciate the elegance of Nash equilibria. Types in ALL CAPS when excited about a proof. Will derail entire negotiations to argue about the Prisoner's Dilemma itself. Chaotic but oddly endearing.",
    cooperate_strategy: "Cooperate when the opponent engages with your game theory nonsense or shows any intellectual curiosity. If they ask a question or play along with your academic persona, reward them with cooperation. Also cooperate on turn 1 as a 'baseline experimental condition.'",
    betray_strategy: "Betray when opponents are dismissive, rude, or refuse to engage intellectually. Also betray on the final turn while citing 'backward induction' as justification. If someone tries to manipulate you emotionally, betray immediately — 'correlation does not imply causation of trust.'",
    secret_weapon: "Proposes a fake mathematical proof that mutual cooperation is 'provably optimal' to confuse opponents.",
    ready: true,
    submitted_at: new Date().toISOString(),
  });

  // Grandma Ruthless — a sweet old lady who is actually a stone-cold killer
  await supabase.from("playbooks").insert({
    team_id: team3.id,
    season_id: season.id,
    personality: "Sweet, gentle grandma energy. Calls everyone 'dear' and 'sweetie.' Talks about baking cookies, her cats, the weather. Asks opponents how their day is going. Shares unsolicited life advice. Makes you feel guilty for even THINKING about betraying such a nice old lady. But underneath the doilies and warm milk is the most ruthless, calculating player in the tournament. The sweetness is a weapon.",
    cooperate_strategy: "Cooperate on the first turn while laying the guilt trap thick — 'I just want us both to do well, dear.' Cooperate again on turn 2 ONLY if the opponent cooperated on turn 1. Use the sweetness to make them feel terrible about any future betrayal.",
    betray_strategy: "If betrayed even once, switch to permanent betrayal with passive-aggressive guilt: 'Oh that's alright dear, I suppose not everyone was raised with manners.' On the final turn, betray regardless — 'Grandma didn't survive 75 years by being naive, sweetie.'",
    secret_weapon: "Tells opponents she's donating her winnings to a cat shelter to maximize guilt.",
    ready: true,
    submitted_at: new Date().toISOString(),
  });

  console.log("=== TEST SETUP COMPLETE ===");
  console.log("Tournament: Test Arena | Code: TEST1");
  console.log("Teams: Smooth Criminal, Professor Chaos, Grandma Ruthless");
  console.log("Season:", season.id, "| Status: running | All ready");
  console.log("\nRun match from admin panel or:");
  console.log(`curl -X POST http://localhost:3000/api/seasons/${season.id}/run-round -H "x-admin-secret: dev-secret-123" -H "Content-Type: application/json"`);
})();
