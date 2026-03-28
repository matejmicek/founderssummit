import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import crypto from "crypto";

const TEAM_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#14b8a6", "#84cc16", "#f59e0b", "#e879f9", "#fb923c",
];

function generateJoinCode(): string {
  return crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 5);
}

async function setTeamCookies(teamId: string, teamName: string, tournamentId: string) {
  const cookieStore = await cookies();
  const opts = {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24,
  };
  cookieStore.set("team_id", teamId, { ...opts, httpOnly: true });
  cookieStore.set("team_name", teamName, opts);
  cookieStore.set("tournament_id", tournamentId, opts);
}

// POST /api/auth/join — Create a new team OR join via team code
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { tournamentCode, teamName, teamCode } = body;

  const supabase = createServerClient();

  // === JOIN EXISTING TEAM VIA TEAM CODE ===
  if (teamCode && typeof teamCode === "string") {
    const { data: team, error: teamErr } = await supabase
      .from("teams")
      .select("id, name, color, tournament_id, join_code")
      .eq("join_code", teamCode.toUpperCase().trim())
      .single();

    if (teamErr || !team) {
      return NextResponse.json({ error: "Invalid team code" }, { status: 404 });
    }

    // Get tournament info
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("id, name, status")
      .eq("id", team.tournament_id)
      .single();

    if (!tournament || tournament.status === "completed") {
      return NextResponse.json({ error: "Tournament has ended" }, { status: 400 });
    }

    await setTeamCookies(team.id, team.name, tournament.id);
    return NextResponse.json({ team, tournament });
  }

  // === CREATE NEW TEAM ===
  if (!tournamentCode || typeof tournamentCode !== "string") {
    return NextResponse.json({ error: "Tournament code required" }, { status: 400 });
  }
  if (!teamName || typeof teamName !== "string" || teamName.trim().length < 1) {
    return NextResponse.json({ error: "Team name required" }, { status: 400 });
  }
  if (teamName.trim().length > 30) {
    return NextResponse.json({ error: "Team name too long (max 30 chars)" }, { status: 400 });
  }

  // Find tournament
  const { data: tournament, error: tErr } = await supabase
    .from("tournaments")
    .select("id, name, status")
    .eq("join_code", tournamentCode.toUpperCase().trim())
    .single();

  if (tErr || !tournament) {
    return NextResponse.json({ error: "Invalid tournament code" }, { status: 404 });
  }

  if (tournament.status === "completed") {
    return NextResponse.json({ error: "Tournament has ended" }, { status: 400 });
  }

  // Check if team name already taken
  const { data: existing } = await supabase
    .from("teams")
    .select("id, name, color, join_code")
    .eq("tournament_id", tournament.id)
    .eq("name", teamName.trim())
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "Team name already taken. Ask your teammate for the team code to join." },
      { status: 409 }
    );
  }

  // Count existing teams for color assignment
  const { count } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournament.id);

  const color = TEAM_COLORS[(count || 0) % TEAM_COLORS.length];
  const joinCode = generateJoinCode();

  // Create new team
  const { data: team, error } = await supabase
    .from("teams")
    .insert({
      tournament_id: tournament.id,
      name: teamName.trim(),
      color,
      join_code: joinCode,
    })
    .select("id, name, color, join_code")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Team name already taken" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await setTeamCookies(team.id, team.name, tournament.id);
  return NextResponse.json({ team, tournament });
}
