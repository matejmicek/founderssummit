import { test, expect } from "@playwright/test";
import { setupTournament, createSeasonWithReadyTeams, wipeTables, supabase } from "./helpers/db";

let tournamentData: Awaited<ReturnType<typeof setupTournament>>;

/**
 * API-level edge case tests.
 * These test the backend directly to ensure data integrity under
 * conditions that the UI might not easily trigger.
 */
test.describe("API Edge Cases", () => {
  test.beforeAll(async () => {
    tournamentData = await setupTournament("API Test Arena", "API01");
  });

  test.afterAll(async () => {
    await wipeTables();
  });

  test("run-round rejects without admin secret", async ({ request }) => {
    const season = await createSeasonWithReadyTeams(
      tournamentData.tournament.id,
      tournamentData.teams,
      1
    );

    const res = await request.post(`/api/seasons/${season.id}/run-round`, {
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(401);

    // Clean up
    await supabase.from("playbooks").delete().eq("season_id", season.id);
    await supabase.from("seasons").delete().eq("id", season.id);
  });

  test("run-round rejects with wrong admin secret", async ({ request }) => {
    const season = await createSeasonWithReadyTeams(
      tournamentData.tournament.id,
      tournamentData.teams,
      2
    );

    const res = await request.post(`/api/seasons/${season.id}/run-round`, {
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": "wrong-secret",
      },
    });
    expect(res.status()).toBe(401);

    await supabase.from("playbooks").delete().eq("season_id", season.id);
    await supabase.from("seasons").delete().eq("id", season.id);
  });

  test("run-round rejects when not all teams ready", async ({ request }) => {
    const season = await createSeasonWithReadyTeams(
      tournamentData.tournament.id,
      tournamentData.teams,
      3,
      { ready: false }
    );

    const res = await request.post(`/api/seasons/${season.id}/run-round`, {
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": "dev-secret-123",
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Not all teams are ready");

    await supabase.from("playbooks").delete().eq("season_id", season.id);
    await supabase.from("seasons").delete().eq("id", season.id);
  });

  test("run-round rejects for non-running season", async ({ request }) => {
    const { data: season } = await supabase.from("seasons").insert({
      tournament_id: tournamentData.tournament.id,
      number: 4,
      status: "building",
      total_rounds: 1,
      points_multiplier: 1,
    }).select().single();

    const res = await request.post(`/api/seasons/${season!.id}/run-round`, {
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": "dev-secret-123",
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("not in running state");

    await supabase.from("seasons").delete().eq("id", season!.id);
  });

  test("run-round rejects for nonexistent season", async ({ request }) => {
    const res = await request.post("/api/seasons/99999/run-round", {
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": "dev-secret-123",
      },
    });
    expect(res.status()).toBe(404);
  });

  test("auth/join rejects empty team name", async ({ request }) => {
    const res = await request.post("/api/auth/join", {
      data: { tournamentCode: "API01", teamName: "" },
    });
    expect(res.status()).toBe(400);
  });

  test("auth/join rejects team name over 30 chars", async ({ request }) => {
    const res = await request.post("/api/auth/join", {
      data: { tournamentCode: "API01", teamName: "A".repeat(31) },
    });
    expect(res.status()).toBe(400);
  });

  test("auth/join rejects invalid tournament code", async ({ request }) => {
    const res = await request.post("/api/auth/join", {
      data: { tournamentCode: "ZZZZZ", teamName: "NoTournament" },
    });
    expect(res.status()).toBe(404);
  });

  test("auth/join rejects invalid team code", async ({ request }) => {
    const res = await request.post("/api/auth/join", {
      data: { teamCode: "ZZZZZ" },
    });
    expect(res.status()).toBe(404);
  });

  test("auth/join rejects duplicate team name", async ({ request }) => {
    const res = await request.post("/api/auth/join", {
      data: { tournamentCode: "API01", teamName: "Alpha Strike" },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("already taken");
  });

  test("admin/state rejects without auth", async ({ request }) => {
    const res = await request.get("/api/admin/state");
    expect(res.status()).toBe(401);
  });

  test("playbooks API requires team_id cookie", async ({ request }) => {
    const res = await request.get("/api/playbooks");
    // Should return error or empty (no team_id cookie)
    const body = await res.json();
    expect(body.error || body.playbook === null || !body.playbook).toBeTruthy();
  });

  test("team/me requires team_id cookie", async ({ request }) => {
    const res = await request.get("/api/team/me");
    const body = await res.json();
    expect(body.error || !body.team).toBeTruthy();
  });

  test("auth/join creates team with valid join_code", async ({ request }) => {
    const res = await request.post("/api/auth/join", {
      data: { tournamentCode: "API01", teamName: "API Test Team" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.team.join_code).toBeTruthy();
    expect(body.team.join_code.length).toBe(5);

    // Can join with the generated code
    const res2 = await request.post("/api/auth/join", {
      data: { teamCode: body.team.join_code },
    });
    expect(res2.status()).toBe(200);
    const body2 = await res2.json();
    expect(body2.team.name).toBe("API Test Team");
  });

  test("leaderboard API returns empty for new season", async ({ request }) => {
    const season = await createSeasonWithReadyTeams(
      tournamentData.tournament.id,
      tournamentData.teams,
      5
    );

    const res = await request.get(`/api/leaderboard?seasonId=${season.id}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.leaderboard)).toBe(true);

    await supabase.from("playbooks").delete().eq("season_id", season.id);
    await supabase.from("seasons").delete().eq("id", season.id);
  });

  test("season/current returns season data with tournamentId", async ({ request }) => {
    const season = await createSeasonWithReadyTeams(
      tournamentData.tournament.id,
      tournamentData.teams,
      6
    );

    const res = await request.get(
      `/api/season/current?tournamentId=${tournamentData.tournament.id}`
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.season).toBeTruthy();
    expect(body.season.id).toBe(season.id);

    await supabase.from("playbooks").delete().eq("season_id", season.id);
    await supabase.from("seasons").delete().eq("id", season.id);
  });

  test("season/current returns null without tournament context", async ({ request }) => {
    const res = await request.get("/api/season/current");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.season).toBeNull();
  });
});
