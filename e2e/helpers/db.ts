import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import type { Page, BrowserContext } from "@playwright/test";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Team definitions ───

const TEAMS_5 = [
  { name: "Alpha Strike", color: "#ef4444", join_code: "ALPH1" },
  { name: "Beta Wave", color: "#22c55e", join_code: "BETA1" },
  { name: "Gamma Burst", color: "#3b82f6", join_code: "GAMM1" },
  { name: "Delta Force", color: "#8b5cf6", join_code: "DELT1" },
  { name: "Epsilon Edge", color: "#f59e0b", join_code: "EPSI1" },
];

const PLAYBOOK_TEMPLATES = [
  {
    personality: "Aggressive negotiator. Direct, confrontational, pushes for dominance.",
    cooperate_strategy: "Only cooperate on turn 1 to test the waters.",
    betray_strategy: "Betray on turns 2 and 3. Maximize personal gain.",
    secret_weapon: "Threatens to betray every turn to intimidate.",
  },
  {
    personality: "Friendly diplomat. Warm and trusting. Believes in mutual benefit.",
    cooperate_strategy: "Always cooperate unless betrayed first. Forgive once.",
    betray_strategy: "Only betray if betrayed twice in a row.",
    secret_weapon: "Claims insider info that cooperation wins more.",
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
    betray_strategy: "If opponent betrays, betray back immediately.",
    secret_weapon: "Single-word answers to unnerve opponents.",
  },
];

// ─── DB operations ───

const WIPE_TABLES = [
  "round_voiceovers", "highlights", "match_turns", "messages",
  "encounter_history", "leaderboard", "playbooks", "matches",
];

export async function wipeTables() {
  for (const t of WIPE_TABLES) {
    await supabase.from(t).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  }
  await supabase.from("seasons").delete().neq("id", 0);
  await supabase.from("teams").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("tournaments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}

export async function setupTournament(tournamentName = "E2E Test Arena", joinCode = "E2E01") {
  await wipeTables();

  const { data: tournament, error } = await supabase
    .from("tournaments")
    .insert({ name: tournamentName, join_code: joinCode, status: "active" })
    .select()
    .single();
  if (error) throw new Error(`Tournament insert failed: ${error.message}`);

  const teamRecords = [];
  for (const t of TEAMS_5) {
    const { data, error } = await supabase
      .from("teams")
      .insert({ tournament_id: tournament!.id, ...t })
      .select()
      .single();
    if (error) throw new Error(`Team "${t.name}" insert failed: ${error.message}`);
    teamRecords.push(data!);
  }

  return { tournament: tournament!, teams: teamRecords };
}

export async function createSeasonWithReadyTeams(
  tournamentId: string,
  teams: { id: string }[],
  seasonNumber: number,
  opts: { multiplier?: number; ready?: boolean } = {}
) {
  const { multiplier = seasonNumber >= 2 ? 2 : 1, ready = true } = opts;

  const { data: season, error } = await supabase
    .from("seasons")
    .insert({
      tournament_id: tournamentId,
      number: seasonNumber,
      status: "running",
      total_rounds: 1,
      points_multiplier: multiplier,
    })
    .select()
    .single();
  if (error) throw new Error(`Season insert failed: ${error.message}`);

  for (let i = 0; i < teams.length; i++) {
    const { error: pbErr } = await supabase.from("playbooks").insert({
      team_id: teams[i].id,
      season_id: season!.id,
      ...PLAYBOOK_TEMPLATES[i % PLAYBOOK_TEMPLATES.length],
      ready,
      submitted_at: new Date().toISOString(),
    });
    if (pbErr) throw new Error(`Playbook for team ${i} failed: ${pbErr.message}`);
  }

  return season!;
}

export async function createSeasonInBuildingPhase(
  tournamentId: string,
  teams: { id: string }[],
  seasonNumber: number
) {
  const { data: season, error } = await supabase
    .from("seasons")
    .insert({
      tournament_id: tournamentId,
      number: seasonNumber,
      status: "building",
      total_rounds: 1,
      points_multiplier: 1,
    })
    .select()
    .single();
  if (error) throw new Error(`Season insert failed: ${error.message}`);

  // Create empty playbooks (not ready)
  for (let i = 0; i < teams.length; i++) {
    await supabase.from("playbooks").insert({
      team_id: teams[i].id,
      season_id: season!.id,
      personality: "",
      cooperate_strategy: "",
      betray_strategy: "",
      secret_weapon: "",
      ready: false,
    });
  }

  return season!;
}

export async function markAllTeamsReady(seasonId: number) {
  await supabase
    .from("playbooks")
    .update({ ready: true })
    .eq("season_id", seasonId);
}

export async function markTeamReady(seasonId: number, teamId: string) {
  await supabase
    .from("playbooks")
    .update({ ready: true })
    .eq("season_id", seasonId)
    .eq("team_id", teamId);
}

export async function updatePlaybook(
  seasonId: number,
  teamId: string,
  fields: Record<string, string>
) {
  const { error } = await supabase
    .from("playbooks")
    .update(fields)
    .eq("season_id", seasonId)
    .eq("team_id", teamId);
  if (error) throw new Error(`Playbook update failed: ${error.message}`);
}

export async function getMatches(seasonId: number) {
  const { data } = await supabase
    .from("matches")
    .select("*")
    .eq("season_id", seasonId);
  return data || [];
}

export async function getLeaderboard(seasonId: number) {
  const { data } = await supabase
    .from("leaderboard")
    .select("*")
    .eq("season_id", seasonId)
    .order("rank");
  return data || [];
}

export async function getHighlights(seasonId: number) {
  const { data } = await supabase
    .from("highlights")
    .select("*")
    .eq("season_id", seasonId);
  return data || [];
}

export async function updateSeasonStatus(seasonId: number, status: string) {
  await supabase.from("seasons").update({ status }).eq("id", seasonId);
}

export async function updateRoundStatus(seasonId: number, roundStatus: string) {
  await supabase.from("seasons").update({ round_status: roundStatus }).eq("id", seasonId);
}

// ─── Auth helpers ───

/**
 * Set team auth cookies on a Playwright browser context.
 */
export async function setTeamCookies(
  context: BrowserContext,
  team: { id: string; name: string },
  tournamentId: string,
) {
  const url = process.env.E2E_BASE_URL || "http://localhost:3000";
  await context.addCookies([
    { name: "team_id", value: team.id, url },
    { name: "team_name", value: encodeURIComponent(team.name), url },
    { name: "tournament_id", value: tournamentId, url },
  ]);
}

export { supabase, TEAMS_5, PLAYBOOK_TEMPLATES };
