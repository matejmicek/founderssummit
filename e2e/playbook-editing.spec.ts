import { test, expect } from "@playwright/test";
import {
  setupTournament,
  createSeasonInBuildingPhase,
  setTeamCookies,
  wipeTables,
  supabase,
} from "./helpers/db";

let tournamentData: Awaited<ReturnType<typeof setupTournament>>;

test.describe("Playbook Editing", () => {
  test.beforeAll(async () => {
    tournamentData = await setupTournament("Playbook Test", "PLAY1");
  });

  test.afterAll(async () => {
    await wipeTables();
  });

  test("can edit all playbook fields and auto-save", async ({ page, context }) => {
    const team = tournamentData.teams[0];
    await setTeamCookies(context, team, tournamentData.tournament.id);

    const season = await createSeasonInBuildingPhase(
      tournamentData.tournament.id,
      tournamentData.teams,
      1
    );

    await page.goto("/team");
    await expect(page.getByText("Alpha Strike")).toBeVisible({ timeout: 10_000 });

    // Wait for playbook editor to be fully connected (shows "Live sync on")
    await expect(page.getByText(/live sync/i)).toBeVisible({ timeout: 15_000 });

    // Target textareas by placeholder
    const personality = page.getByPlaceholder(/who is your agent/i);
    await expect(personality).toBeVisible({ timeout: 5000 });
    await personality.fill("A cunning strategist who never shows their hand.");

    const cooperate = page.getByPlaceholder(/should your agent cooperate/i);
    await cooperate.fill("Cooperate on turn 1, then mirror opponent.");

    const betray = page.getByPlaceholder(/should your agent betray/i);
    await betray.fill("Betray on the final turn without warning.");

    // Click Save Playbook to force immediate save
    const saveBtn = page.getByRole("button", { name: /save playbook/i });
    await expect(saveBtn).toBeVisible({ timeout: 3000 });
    await saveBtn.click();

    // Wait for save to complete
    await page.waitForTimeout(3000);

    // Verify data saved to DB
    const { data: playbook } = await supabase
      .from("playbooks")
      .select("personality, cooperate_strategy, betray_strategy")
      .eq("team_id", team.id)
      .eq("season_id", season.id)
      .single();

    expect(playbook!.personality).toContain("cunning strategist");
    expect(playbook!.cooperate_strategy).toContain("mirror opponent");
    expect(playbook!.betray_strategy).toContain("final turn");

    // Clean up
    await supabase.from("playbooks").delete().eq("season_id", season.id);
    await supabase.from("seasons").delete().eq("id", season.id);
  });

  test("can mark team as ready", async ({ page, context }) => {
    const team = tournamentData.teams[1];
    await setTeamCookies(context, team, tournamentData.tournament.id);

    const season = await createSeasonInBuildingPhase(
      tournamentData.tournament.id,
      tournamentData.teams,
      2
    );

    // Pre-fill playbook via DB
    await supabase.from("playbooks").update({
      personality: "Test personality for ready check",
      cooperate_strategy: "Test cooperate strategy",
      betray_strategy: "Test betray strategy",
    }).eq("team_id", team.id).eq("season_id", season.id);

    await page.goto("/team");
    await expect(page.getByText("Beta Wave")).toBeVisible({ timeout: 10_000 });

    // Wait for playbook editor to load with DB data
    await expect(page.getByText(/live sync/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Test personality for ready check")).toBeVisible({ timeout: 10_000 });

    // Wait for "Mark Ready" button to become ENABLED (needs seasonId + hasContent)
    const readyBtn = page.getByRole("button", { name: /mark ready/i });
    await expect(readyBtn).toBeEnabled({ timeout: 10_000 });
    await readyBtn.click();

    // Wait for the button to change to "Ready!" confirming the save
    await expect(page.getByRole("button", { name: /ready!/i })).toBeVisible({ timeout: 10_000 });

    // Verify in DB
    const { data: pb } = await supabase
      .from("playbooks")
      .select("ready")
      .eq("team_id", team.id)
      .eq("season_id", season.id)
      .single();
    expect(pb!.ready).toBe(true);

    // Clean up
    await supabase.from("playbooks").delete().eq("season_id", season.id);
    await supabase.from("seasons").delete().eq("id", season.id);
  });

  test("character counters show limits", async ({ page, context }) => {
    const team = tournamentData.teams[2];
    await setTeamCookies(context, team, tournamentData.tournament.id);

    const season = await createSeasonInBuildingPhase(
      tournamentData.tournament.id,
      tournamentData.teams,
      3
    );

    await page.goto("/team");
    await expect(page.getByText("Gamma Burst")).toBeVisible({ timeout: 10_000 });

    // Verify character limit indicators are present
    await expect(page.getByText(/\/500/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/\/300/).first()).toBeVisible();

    // Clean up
    await supabase.from("playbooks").delete().eq("season_id", season.id);
    await supabase.from("seasons").delete().eq("id", season.id);
  });
});
