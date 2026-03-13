import { test, expect } from "@playwright/test";
import {
  setupTournament,
  createSeasonInBuildingPhase,
  createSeasonWithReadyTeams,
  setTeamCookies,
  wipeTables,
  supabase,
} from "./helpers/db";

let tournamentData: Awaited<ReturnType<typeof setupTournament>>;

test.describe("Team Dashboard", () => {
  test.beforeAll(async () => {
    tournamentData = await setupTournament("Dashboard Test", "DASH1");
  });

  test.afterAll(async () => {
    await wipeTables();
  });

  test("redirects to home if no auth cookies", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/team");
    await expect(page).toHaveURL("/", { timeout: 10_000 });
  });

  test("shows team name and playbook tab by default", async ({ page, context }) => {
    const team = tournamentData.teams[0];
    await setTeamCookies(context, team, tournamentData.tournament.id);

    const season = await createSeasonInBuildingPhase(
      tournamentData.tournament.id,
      tournamentData.teams,
      1
    );

    await page.goto("/team");
    await expect(page.getByText("Alpha Strike")).toBeVisible({ timeout: 10_000 });

    // Status should show "Write your playbook" (case insensitive)
    await expect(page.getByText(/write your playbook/i)).toBeVisible({ timeout: 10_000 });

    // Playbook tab should be active
    await expect(page.locator("nav").getByText("Playbook")).toBeVisible();

    // Should see share card (TeamShareCard shows "Invite teammates")
    await expect(page.getByText(/invite teammates/i)).toBeVisible({ timeout: 10_000 });

    // Clean up
    await supabase.from("playbooks").delete().eq("season_id", season.id);
    await supabase.from("seasons").delete().eq("id", season.id);
  });

  test("shows running matches banner during match execution", async ({ page, context }) => {
    const team = tournamentData.teams[0];
    await setTeamCookies(context, team, tournamentData.tournament.id);

    const season = await createSeasonWithReadyTeams(
      tournamentData.tournament.id,
      tournamentData.teams,
      2
    );
    await supabase.from("seasons").update({
      round_status: "running_matches",
      current_round: 1,
    }).eq("id", season.id);

    await page.goto("/team");

    await expect(
      page.getByText(/agent is negotiating/i)
    ).toBeVisible({ timeout: 10_000 });

    // Clean up
    await supabase.from("playbooks").delete().eq("season_id", season.id);
    await supabase.from("matches").delete().eq("season_id", season.id);
    await supabase.from("seasons").delete().eq("id", season.id);
  });

  test("shows highlights banner when showing_highlights", async ({ page, context }) => {
    const team = tournamentData.teams[0];
    await setTeamCookies(context, team, tournamentData.tournament.id);

    const season = await createSeasonWithReadyTeams(
      tournamentData.tournament.id,
      tournamentData.teams,
      3
    );
    await supabase.from("seasons").update({
      round_status: "showing_highlights",
      current_round: 1,
    }).eq("id", season.id);

    await page.goto("/team");

    await expect(
      page.getByText(/look at the big screen/i)
    ).toBeVisible({ timeout: 10_000 });

    // Clean up
    await supabase.from("playbooks").delete().eq("season_id", season.id);
    await supabase.from("matches").delete().eq("season_id", season.id);
    await supabase.from("seasons").delete().eq("id", season.id);
  });

  test("tab navigation works", async ({ page, context }) => {
    const team = tournamentData.teams[0];
    await setTeamCookies(context, team, tournamentData.tournament.id);

    const season = await createSeasonInBuildingPhase(
      tournamentData.tournament.id,
      tournamentData.teams,
      4
    );

    await page.goto("/team");
    await expect(page.getByText("Alpha Strike")).toBeVisible({ timeout: 10_000 });

    // Wait for the polling to stabilize (status text confirms poll completed)
    await expect(page.getByText(/write your playbook/i)).toBeVisible({ timeout: 10_000 });

    // Wait for at least one more poll cycle to pass so lastStatus is locked in
    await page.waitForTimeout(4000);

    // Navigate to Live tab
    await page.locator("nav").getByText("Live").click();
    await expect(page.getByText(/no matches/i)).toBeVisible({ timeout: 10_000 });

    // Navigate to Results tab
    await page.locator("nav").getByText("Results").click();
    await expect(page.getByText(/no scores/i)).toBeVisible({ timeout: 10_000 });

    // Back to Playbook
    await page.locator("nav").getByText("Playbook").click();
    await expect(page.getByText(/invite teammates/i)).toBeVisible({ timeout: 10_000 });

    // Clean up
    await supabase.from("playbooks").delete().eq("season_id", season.id);
    await supabase.from("seasons").delete().eq("id", season.id);
  });
});
