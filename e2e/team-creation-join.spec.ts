import { test, expect } from "@playwright/test";
import { setupTournament, wipeTables, supabase } from "./helpers/db";

let tournamentData: Awaited<ReturnType<typeof setupTournament>>;

test.describe("Team Creation & Join Flows", () => {
  test.beforeAll(async () => {
    tournamentData = await setupTournament("Join Test Arena", "JOIN1");
  });

  test.afterAll(async () => {
    await wipeTables();
  });

  test("create a new team via landing page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Agent Arena")).toBeVisible();

    // Click "Create a Team"
    await page.getByText("Create a Team").click();
    await expect(page.getByPlaceholder("TOURNAMENT CODE")).toBeVisible();

    // Fill in tournament code and team name
    await page.getByPlaceholder("TOURNAMENT CODE").fill("JOIN1");
    await page.getByPlaceholder("Your team name").fill("Test Creators");

    // Submit
    await page.getByText("Create Team").click();

    // Should redirect to /team
    await expect(page).toHaveURL(/\/team/, { timeout: 10_000 });
    await expect(page.getByText("Test Creators")).toBeVisible();

    // Verify team was created in DB
    const { data: team } = await supabase
      .from("teams")
      .select("*")
      .eq("name", "Test Creators")
      .single();
    expect(team).toBeTruthy();
    expect(team!.join_code).toBeTruthy();
    expect(team!.join_code.length).toBe(5);
  });

  test("join existing team via team code", async ({ page }) => {
    // Get Alpha Strike's join code
    const team = tournamentData.teams[0];
    const { data: teamData } = await supabase
      .from("teams")
      .select("join_code")
      .eq("id", team.id)
      .single();

    await page.goto("/");
    await page.getByText("Join a Team").click();
    await expect(page.getByPlaceholder("TEAM CODE")).toBeVisible();

    await page.getByPlaceholder("TEAM CODE").fill(teamData!.join_code);
    await page.getByText("Join Team").click();

    // Should redirect to /team
    await expect(page).toHaveURL(/\/team/, { timeout: 10_000 });
    await expect(page.getByText("Alpha Strike")).toBeVisible();
  });

  test("join team via URL /join/[code]", async ({ page }) => {
    const team = tournamentData.teams[1]; // Beta Wave
    const { data: teamData } = await supabase
      .from("teams")
      .select("join_code")
      .eq("id", team.id)
      .single();

    await page.goto(`/join/${teamData!.join_code}`);

    // Should auto-join and redirect to /team
    await expect(page).toHaveURL(/\/team/, { timeout: 10_000 });
    await expect(page.getByText("Beta Wave")).toBeVisible();
  });

  test("shows error for invalid tournament code", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Create a Team").click();
    await page.getByPlaceholder("TOURNAMENT CODE").fill("XXXXX");
    await page.getByPlaceholder("Your team name").fill("Bad Team");
    await page.getByText("Create Team").click();

    await expect(page.getByText("Invalid tournament code")).toBeVisible({ timeout: 5000 });
  });

  test("shows error for invalid team code", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Join a Team").click();
    await page.getByPlaceholder("TEAM CODE").fill("XXXXX");
    await page.getByText("Join Team").click();

    await expect(page.getByText("Invalid team code")).toBeVisible({ timeout: 5000 });
  });

  test("shows error for duplicate team name", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Create a Team").click();
    await page.getByPlaceholder("TOURNAMENT CODE").fill("JOIN1");
    await page.getByPlaceholder("Your team name").fill("Alpha Strike"); // Already exists
    await page.getByText("Create Team").click();

    await expect(page.getByText("Team name already taken")).toBeVisible({ timeout: 5000 });
  });
});
