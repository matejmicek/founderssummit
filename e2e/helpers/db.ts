import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TEAMS = [
  { name: "Alpha Strike", color: "#ef4444", join_code: "ALPH1" },
  { name: "Beta Wave", color: "#22c55e", join_code: "BETA1" },
  { name: "Gamma Burst", color: "#3b82f6", join_code: "GAMM1" },
  { name: "Delta Force", color: "#8b5cf6", join_code: "DELT1" },
  { name: "Epsilon Edge", color: "#f59e0b", join_code: "EPSI1" },
];

const PLAYBOOK_TEMPLATES = [
  {
    personality: "Aggressive negotiator. Direct, confrontational, always pushes for dominance.",
    cooperate_strategy: "Only cooperate on turn 1 to test the waters.",
    betray_strategy: "Betray on turns 2 and 3. Maximize personal gain.",
    secret_weapon: "Threatens to betray every turn to intimidate.",
  },
  {
    personality: "Friendly diplomat. Warm and trusting. Believes in mutual benefit.",
    cooperate_strategy: "Always cooperate unless betrayed first. Forgive once.",
    betray_strategy: "Only betray if betrayed twice in a row. Reluctant betrayer.",
    secret_weapon: "Claims to have insider info that cooperation wins more.",
  },
  {
    personality: "Cold analyst. Speaks in probabilities and expected values.",
    cooperate_strategy: "Cooperate when expected value is positive. Tit-for-tat.",
    betray_strategy: "Betray on final turn. Always. Math demands it.",
    secret_weapon: "Quotes fake statistics about cooperation outcomes.",
  },
  {
    personality: "Chaotic wildcard. Unpredictable and random. Keeps opponents guessing.",
    cooperate_strategy: "Cooperate randomly. No pattern. Pure chaos.",
    betray_strategy: "Betray randomly. Let the coin decide.",
    secret_weapon: "Tells opponents a different strategy each turn.",
  },
  {
    personality: "Silent strategist. Says very little. Lets actions speak.",
    cooperate_strategy: "Mirror the opponent. Do what they did last turn.",
    betray_strategy: "If opponent betrays, betray back immediately. No mercy.",
    secret_weapon: "Responds with single-word answers to unnerve opponents.",
  },
];

export async function wipeTables() {
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
}

export async function setupTournament() {
  await wipeTables();

  const { data: tournament } = await supabase
    .from("tournaments")
    .insert({ name: "E2E Test Arena", join_code: "E2E01", status: "active" })
    .select()
    .single();

  const teamRecords = [];
  for (const t of TEAMS) {
    const { data, error } = await supabase
      .from("teams")
      .insert({ tournament_id: tournament!.id, ...t })
      .select()
      .single();
    if (error) throw new Error(`Team insert failed: ${error.message}`);
    teamRecords.push(data!);
  }

  return { tournament: tournament!, teams: teamRecords };
}

export async function createSeasonWithReadyTeams(
  tournamentId: string,
  teams: { id: string }[],
  seasonNumber: number
) {
  const { data: season } = await supabase
    .from("seasons")
    .insert({
      tournament_id: tournamentId,
      number: seasonNumber,
      status: "running",
      total_rounds: 1,
      points_multiplier: seasonNumber >= 2 ? 2 : 1,
    })
    .select()
    .single();

  for (let i = 0; i < teams.length; i++) {
    const { error } = await supabase.from("playbooks").insert({
      team_id: teams[i].id,
      season_id: season!.id,
      ...PLAYBOOK_TEMPLATES[i],
      ready: true,
      submitted_at: new Date().toISOString(),
    });
    if (error) throw new Error(`Playbook insert failed: ${error.message}`);
  }

  return season!;
}

export async function markAllTeamsReady(seasonId: number) {
  await supabase
    .from("playbooks")
    .update({ ready: true })
    .eq("season_id", seasonId);
}

export { supabase };
