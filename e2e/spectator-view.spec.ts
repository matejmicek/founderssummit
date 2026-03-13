import { test, expect, BrowserContext } from "@playwright/test";
import {
  setupTournament,
  createSeasonWithReadyTeams,
  wipeTables,
  supabase,
} from "./helpers/db";

let tournamentData: Awaited<ReturnType<typeof setupTournament>>;

async function setTournamentCookie(context: BrowserContext, tournamentId: string) {
  const url = process.env.E2E_BASE_URL || "http://localhost:3000";
  await context.addCookies([
    { name: "tournament_id", value: tournamentId, url },
  ]);
}

test.describe("Spectator View", () => {
  test.beforeAll(async () => {
    tournamentData = await setupTournament("Spectator Test", "SPEC1");
  });

  test.afterAll(async () => {
    await wipeTables();
  });

  test("shows waiting state when no season", async ({ page, context }) => {
    await setTournamentCookie(context, tournamentData.tournament.id);
    await page.goto("/spectate");
    await expect(page.getByText("Agent Arena")).toBeVisible();
    await expect(page.getByText(/waiting for game/i)).toBeVisible({ timeout: 10_000 });
  });

  test("shows leaderboard and match feed", async ({ page, context }) => {
    await setTournamentCookie(context, tournamentData.tournament.id);
    const season = await createSeasonWithReadyTeams(
      tournamentData.tournament.id,
      tournamentData.teams,
      1,
      { ready: true }
    );

    await page.goto("/spectate");
    // Use heading to disambiguate from tab button
    await expect(page.getByRole("heading", { name: /leaderboard/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: /matches/i })).toBeVisible();

    await supabase.from("playbooks").delete().eq("season_id", season.id);
    await supabase.from("seasons").delete().eq("id", season.id);
  });

  test("can switch between tabs", async ({ page, context }) => {
    await setTournamentCookie(context, tournamentData.tournament.id);
    const season = await createSeasonWithReadyTeams(
      tournamentData.tournament.id,
      tournamentData.teams,
      2,
      { ready: true }
    );

    await page.goto("/spectate");
    await expect(page.getByRole("heading", { name: /leaderboard/i })).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "matrix" }).click();
    await expect(page.getByRole("heading", { name: /head-to-head/i })).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "leaderboard" }).click();
    await expect(page.getByRole("heading", { name: /leaderboard/i })).toBeVisible({ timeout: 5000 });

    await supabase.from("playbooks").delete().eq("season_id", season.id);
    await supabase.from("seasons").delete().eq("id", season.id);
  });

  test("shows running matches indicator", async ({ page, context }) => {
    await setTournamentCookie(context, tournamentData.tournament.id);
    const season = await createSeasonWithReadyTeams(
      tournamentData.tournament.id,
      tournamentData.teams,
      3
    );
    await supabase.from("seasons").update({
      round_status: "running_matches",
      current_round: 1,
    }).eq("id", season.id);

    await page.goto("/spectate");
    await expect(page.getByText(/matches in progress/i)).toBeVisible({ timeout: 10_000 });

    await supabase.from("playbooks").delete().eq("season_id", season.id);
    await supabase.from("matches").delete().eq("season_id", season.id);
    await supabase.from("seasons").delete().eq("id", season.id);
  });

  test("auto-switches to highlights when round completes", async ({ page, context }) => {
    await setTournamentCookie(context, tournamentData.tournament.id);
    const season = await createSeasonWithReadyTeams(
      tournamentData.tournament.id,
      tournamentData.teams,
      4
    );
    await supabase.from("seasons").update({
      round_status: "running_matches",
      current_round: 1,
    }).eq("id", season.id);

    await page.goto("/spectate");
    await expect(page.getByText(/matches in progress/i)).toBeVisible({ timeout: 10_000 });

    // Simulate round completing
    await supabase.from("seasons").update({
      round_status: "showing_highlights",
    }).eq("id", season.id);

    // Should auto-switch to highlights tab (polls every 2s)
    await expect(page.getByRole("heading", { name: /highlights/i })).toBeVisible({ timeout: 10_000 });

    await supabase.from("playbooks").delete().eq("season_id", season.id);
    await supabase.from("matches").delete().eq("season_id", season.id);
    await supabase.from("seasons").delete().eq("id", season.id);
  });
});
