import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 300_000, // 5 min per test — matches take ~60s
  expect: {
    timeout: 10_000,
  },
  // Run test files in parallel, but tests within a file sequentially
  // (since they share DB state via beforeAll/afterAll)
  fullyParallel: false,
  workers: 1, // Serial — tests share one Supabase instance
  retries: 1, // Retry once on failure (flaky network/timing)
  reporter: [
    ["list"],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        port: 3000,
        reuseExistingServer: true,
        timeout: 30_000,
      },
  // Test ordering: fast tests first, slow integration last
  projects: [
    {
      name: "api",
      testMatch: "api-edge-cases.spec.ts",
    },
    {
      name: "auth",
      testMatch: "team-creation-join.spec.ts",
    },
    {
      name: "dashboard",
      testMatch: "team-dashboard.spec.ts",
    },
    {
      name: "playbook",
      testMatch: "playbook-editing.spec.ts",
    },
    {
      name: "spectator",
      testMatch: "spectator-view.spec.ts",
    },
    {
      name: "admin",
      testMatch: "admin-flow.spec.ts",
    },
    {
      name: "integration",
      testMatch: "full-game-flow.spec.ts",
    },
  ],
});
