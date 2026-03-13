import { test, expect, Page } from "@playwright/test";
import {
  setupTournament,
  createSeasonWithReadyTeams,
  markAllTeamsReady,
  wipeTables,
  supabase,
} from "./helpers/db";

let tournamentData: Awaited<ReturnType<typeof setupTournament>>;

/**
 * Assert that the current phase stays stable (no flickering).
 * Checks the data-testid="phase-{name}" attribute repeatedly.
 */
async function assertPhaseStable(page: Page, expectedPhase: string, durationMs = 5000) {
  const checkInterval = 250;
  const checks = Math.floor(durationMs / checkInterval);
  let flickerCount = 0;

  for (let i = 0; i < checks; i++) {
    const phaseAttr = await page
      .locator("main[data-testid]")
      .getAttribute("data-testid")
      .catch(() => null);
    if (phaseAttr !== `phase-${expectedPhase}`) flickerCount++;
    await page.waitForTimeout(checkInterval);
  }

  const flickerRate = flickerCount / checks;
  expect(
    flickerRate,
    `Phase "${expectedPhase}" flickered ${flickerCount}/${checks} checks (${(flickerRate * 100).toFixed(0)}%)`
  ).toBeLessThan(0.1);
}

/**
 * Wait for the phase to transition to a specific value.
 */
async function waitForPhase(page: Page, phase: string, timeoutMs = 180_000) {
  await expect(
    page.locator(`main[data-testid="phase-${phase}"]`)
  ).toBeVisible({ timeout: timeoutMs });
}

/**
 * Open admin controls if not already open.
 */
async function openControls(page: Page) {
  const controls = page.locator('[data-testid="admin-controls"]');
  if (!(await controls.isVisible().catch(() => false))) {
    await page.locator('[data-testid="admin-controls-toggle"]').click();
    await expect(controls).toBeVisible({ timeout: 2000 });
  }
}

/**
 * Select a tournament on the admin page.
 */
async function selectTournament(page: Page, name: string) {
  // If we're on tournament select, click it
  const tournamentButton = page.getByText(name, { exact: false }).first();
  await tournamentButton.click();
  // Wait for the header to appear (means we're in tournament view)
  await expect(page.locator("header")).toBeVisible({ timeout: 5000 });
  // Wait for first poll to complete
  await page.waitForTimeout(2500);
}

test.describe("Full Game Flow", () => {
  test.beforeAll(async () => {
    tournamentData = await setupTournament();
    console.log(
      `\n=== Setup: "${tournamentData.tournament.name}" with ${tournamentData.teams.length} teams ===`
    );
  });

  test.afterAll(async () => {
    await wipeTables();
    console.log("\n=== Cleanup: DB wiped ===");
  });

  test("two full seasons with no flickering", async ({ page }) => {
    const { tournament, teams } = tournamentData;
    const timings: Record<string, number> = {};
    const t = (label: string) => { timings[label] = Date.now(); };

    // ========================================
    // Navigate to admin + select tournament
    // ========================================
    await page.goto("/admin");
    await expect(page.getByText("Agent Arena")).toBeVisible();
    await selectTournament(page, "E2E Test Arena");
    await openControls(page);

    // ========================================
    // SEASON 1
    // ========================================
    console.log("\n--- SEASON 1 (5 teams, 10 matches) ---");

    const season1 = await createSeasonWithReadyTeams(tournament.id, teams, 1);
    console.log(`  Created season ${season1.id}`);

    // Wait for poll to pick up the new season
    await waitForPhase(page, "ready_check", 10_000);
    console.log("  Phase: ready_check");

    // Ensure controls are open and "Run Matches" is visible
    await openControls(page);
    const runBtn = page.locator('[data-testid="run-matches-btn"]');
    await expect(runBtn).toBeVisible({ timeout: 5000 });
    await expect(runBtn).toBeEnabled({ timeout: 5000 });

    // ---------- Click Run Matches ----------
    t("s1_start");
    await runBtn.click();

    // Phase: running_matches — "Agents Negotiating"
    await waitForPhase(page, "running_matches", 10_000);
    t("s1_negotiating");
    console.log(
      `  Phase: running_matches (${timings.s1_negotiating - timings.s1_start}ms)`
    );

    // FLICKER CHECK: running_matches should be rock solid
    await assertPhaseStable(page, "running_matches", 5000);
    console.log("  Flicker check: PASSED (running_matches stable)");

    // Phase: generating_highlights — "Matches Complete!"
    await waitForPhase(page, "generating_highlights", 180_000);
    t("s1_generating");
    console.log(
      `  Phase: generating_highlights (${((timings.s1_generating - timings.s1_start) / 1000).toFixed(1)}s since start)`
    );
    await assertPhaseStable(page, "generating_highlights", 3000);
    console.log("  Flicker check: PASSED (generating_highlights stable)");

    // Phase: showing_highlights
    await waitForPhase(page, "showing_highlights", 120_000);
    t("s1_highlights");
    console.log(
      `  Phase: showing_highlights (${((timings.s1_highlights - timings.s1_generating) / 1000).toFixed(1)}s for highlights)`
    );
    await assertPhaseStable(page, "showing_highlights", 4000);
    console.log("  Flicker check: PASSED (showing_highlights stable)");

    // Verify no PENDING matches
    const pendingCount = await page.getByText("PENDING").count();
    expect(pendingCount, "No matches should be PENDING").toBe(0);

    // Verify "Show Final Results" button
    await openControls(page);
    const finalBtn = page.locator('[data-testid="show-final-btn"]');
    await expect(finalBtn).toBeVisible({ timeout: 5000 });

    // ---------- Click Show Final Results ----------
    await finalBtn.click();
    await waitForPhase(page, "final", 10_000);
    t("s1_final");
    console.log(
      `  Phase: final (${((timings.s1_final - timings.s1_start) / 1000).toFixed(1)}s total for season 1)`
    );

    // Verify leaderboard content
    await expect(page.getByText("Final Leaderboard")).toBeVisible();
    await expect(page.getByText("Head-to-Head")).toBeVisible();

    // ========================================
    // SEASON 2 (Championship 2x)
    // ========================================
    console.log("\n--- SEASON 2 (5 teams, 10 matches, 2x multiplier) ---");

    const season2 = await createSeasonWithReadyTeams(tournament.id, teams, 2);
    console.log(`  Created season ${season2.id} (2x)`);

    // Wait for poll to pick up season 2
    await waitForPhase(page, "ready_check", 15_000);
    console.log("  Phase: ready_check");

    await openControls(page);
    const runBtn2 = page.locator('[data-testid="run-matches-btn"]');
    await expect(runBtn2).toBeVisible({ timeout: 5000 });
    await expect(runBtn2).toBeEnabled({ timeout: 5000 });

    // ---------- Click Run Matches ----------
    t("s2_start");
    await runBtn2.click();

    await waitForPhase(page, "running_matches", 10_000);
    t("s2_negotiating");
    console.log(
      `  Phase: running_matches (${timings.s2_negotiating - timings.s2_start}ms)`
    );

    await assertPhaseStable(page, "running_matches", 5000);
    console.log("  Flicker check: PASSED (running_matches stable)");

    await waitForPhase(page, "generating_highlights", 180_000);
    t("s2_generating");
    console.log(
      `  Phase: generating_highlights (${((timings.s2_generating - timings.s2_start) / 1000).toFixed(1)}s since start)`
    );

    await waitForPhase(page, "showing_highlights", 120_000);
    t("s2_highlights");
    console.log(
      `  Phase: showing_highlights (${((timings.s2_highlights - timings.s2_generating) / 1000).toFixed(1)}s for highlights)`
    );

    // No PENDING matches
    const pendingCount2 = await page.getByText("PENDING").count();
    expect(pendingCount2, "No matches should be PENDING in season 2").toBe(0);

    await openControls(page);
    await page.locator('[data-testid="show-final-btn"]').click();
    await waitForPhase(page, "final", 10_000);
    t("s2_final");
    console.log(
      `  Phase: final (${((timings.s2_final - timings.s2_start) / 1000).toFixed(1)}s total for season 2)`
    );

    // ========================================
    // SUMMARY
    // ========================================
    console.log("\n=== TIMING SUMMARY ===");
    console.log(`Season 1: ${((timings.s1_final - timings.s1_start) / 1000).toFixed(1)}s`);
    console.log(`  Match execution: ${((timings.s1_generating - timings.s1_start) / 1000).toFixed(1)}s`);
    console.log(`  Highlight generation: ${((timings.s1_highlights - timings.s1_generating) / 1000).toFixed(1)}s`);
    console.log(`Season 2: ${((timings.s2_final - timings.s2_start) / 1000).toFixed(1)}s`);
    console.log(`  Match execution: ${((timings.s2_generating - timings.s2_start) / 1000).toFixed(1)}s`);
    console.log(`  Highlight generation: ${((timings.s2_highlights - timings.s2_generating) / 1000).toFixed(1)}s`);
    console.log(`Total: ${((timings.s2_final - timings.s1_start) / 1000).toFixed(1)}s`);
  });
});
