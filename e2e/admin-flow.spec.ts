import { test, expect } from "@playwright/test";
import {
  setupTournament,
  createSeasonWithReadyTeams,
  createSeasonInBuildingPhase,
  wipeTables,
  supabase,
} from "./helpers/db";

let tournamentData: Awaited<ReturnType<typeof setupTournament>>;

async function waitForPhase(page: import("@playwright/test").Page, phase: string, timeout = 30_000) {
  await expect(
    page.locator(`main[data-testid="phase-${phase}"]`)
  ).toBeVisible({ timeout });
}

async function openControls(page: import("@playwright/test").Page) {
  const controls = page.locator('[data-testid="admin-controls"]');
  if (!(await controls.isVisible().catch(() => false))) {
    await page.locator('[data-testid="admin-controls-toggle"]').click();
    await expect(controls).toBeVisible({ timeout: 2000 });
  }
}

async function selectTournament(page: import("@playwright/test").Page, name: string) {
  // Wait for tournament list to appear
  await expect(page.getByText("Select or create a tournament")).toBeVisible({ timeout: 5000 });
  // Click the tournament button specifically
  const btn = page.getByRole("button", { name: new RegExp(name, "i") });
  await expect(btn).toBeVisible({ timeout: 5000 });
  await btn.click();
  // Verify we're in tournament view by checking for join code label
  await expect(page.getByText("Join Code")).toBeVisible({ timeout: 5000 });
  // Wait for first poll to load teams
  await page.waitForTimeout(3000);
}

test.describe("Admin Flow - Tournament Management", () => {
  test.beforeAll(async () => {
    tournamentData = await setupTournament("Admin Test Arena", "ADM01");
  });

  test.afterAll(async () => {
    await wipeTables();
  });

  test("shows tournament selection on load", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByText("Agent Arena")).toBeVisible();
    await expect(page.getByRole("button", { name: /Admin Test Arena/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("ADM01")).toBeVisible();
  });

  test("can select tournament and see teams", async ({ page }) => {
    await page.goto("/admin");
    await selectTournament(page, "Admin Test Arena");

    await expect(page.getByText("ADM01").first()).toBeVisible();

    // Should see 5 teams
    for (const team of tournamentData.teams) {
      await expect(page.getByText(team.name)).toBeVisible({ timeout: 10_000 });
    }
  });

  test("admin controls toggle works", async ({ page }) => {
    await page.goto("/admin");
    await selectTournament(page, "Admin Test Arena");

    const controls = page.locator('[data-testid="admin-controls"]');
    await expect(controls).not.toBeVisible();

    await page.locator('[data-testid="admin-controls-toggle"]').click();
    await expect(controls).toBeVisible({ timeout: 2000 });

    await page.locator('[data-testid="admin-controls-toggle"]').click();
    await expect(controls).not.toBeVisible();
  });

  test("building phase shows team readiness", async ({ page }) => {
    const season = await createSeasonInBuildingPhase(
      tournamentData.tournament.id,
      tournamentData.teams,
      1
    );

    await page.goto("/admin");
    await selectTournament(page, "Admin Test Arena");

    await waitForPhase(page, "building", 10_000);
    await expect(page.getByText(/build your agent/i)).toBeVisible();
    await expect(page.getByText(/0.*\/.*5.*teams ready/i)).toBeVisible();

    // Mark 3 teams ready
    for (let i = 0; i < 3; i++) {
      await supabase.from("playbooks").update({ ready: true })
        .eq("team_id", tournamentData.teams[i].id)
        .eq("season_id", season.id);
    }
    await page.waitForTimeout(3000);
    await expect(page.getByText(/3.*\/.*5.*teams ready/i)).toBeVisible({ timeout: 5000 });

    await supabase.from("playbooks").delete().eq("season_id", season.id);
    await supabase.from("seasons").delete().eq("id", season.id);
  });

  test("ready_check shows Run Matches button when all ready", async ({ page }) => {
    const season = await createSeasonWithReadyTeams(
      tournamentData.tournament.id,
      tournamentData.teams,
      2
    );

    await page.goto("/admin");
    await selectTournament(page, "Admin Test Arena");

    await waitForPhase(page, "ready_check", 10_000);

    await openControls(page);
    const runBtn = page.locator('[data-testid="run-matches-btn"]');
    await expect(runBtn).toBeVisible({ timeout: 5000 });
    await expect(runBtn).toBeEnabled();
    await expect(runBtn).toContainText("Run Matches (10)");

    await supabase.from("playbooks").delete().eq("season_id", season.id);
    await supabase.from("seasons").delete().eq("id", season.id);
  });

  test("shows waiting state when not all teams ready", async ({ page }) => {
    const season = await createSeasonWithReadyTeams(
      tournamentData.tournament.id,
      tournamentData.teams,
      3,
      { ready: true }
    );

    // Mark one team as not ready
    await supabase.from("playbooks").update({ ready: false })
      .eq("team_id", tournamentData.teams[0].id)
      .eq("season_id", season.id);

    await page.goto("/admin");
    await selectTournament(page, "Admin Test Arena");
    await waitForPhase(page, "ready_check", 10_000);

    await openControls(page);
    await expect(page.getByText(/Waiting.*4.*5/)).toBeVisible({ timeout: 5000 });

    await supabase.from("playbooks").delete().eq("season_id", season.id);
    await supabase.from("seasons").delete().eq("id", season.id);
  });
});
