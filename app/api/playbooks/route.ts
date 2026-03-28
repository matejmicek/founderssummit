import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const teamId = cookieStore.get("team_id")?.value;
  if (!teamId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = createServerClient();

  // Get tournament from cookie
  const tournamentId = cookieStore.get("tournament_id")?.value;

  // Get current active season for this tournament
  // Include completed so teams can still view their playbook after the season ends
  // NOT pending — those haven't started yet
  let query = supabase
    .from("seasons")
    .select("id, status")
    .in("status", ["building", "tweaking", "running", "completed"])
    .order("number", { ascending: false })
    .limit(1);

  if (tournamentId) {
    query = query.eq("tournament_id", tournamentId);
  }

  const { data: season } = await query.single();

  if (!season) {
    return NextResponse.json({ error: "No active season", seasonId: null }, { status: 404 });
  }

  // Get or create playbook
  const { data: playbook } = await supabase
    .from("playbooks")
    .select("*")
    .eq("team_id", teamId)
    .eq("season_id", season.id)
    .single();

  if (playbook) {
    return NextResponse.json({ playbook, seasonId: season.id });
  }

  // Only auto-create playbooks during building or tweaking phases
  if (season.status !== "building" && season.status !== "tweaking") {
    return NextResponse.json({
      error: "Season is running, playbook cannot be created now",
      seasonId: season.id,
    }, { status: 400 });
  }

  // Check if previous season has a playbook to carry over
  const { data: previousPlaybook } = await supabase
    .from("playbooks")
    .select("personality, cooperate_strategy, betray_strategy, secret_weapon")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const { data: newPlaybook, error } = await supabase
    .from("playbooks")
    .insert({
      team_id: teamId,
      season_id: season.id,
      personality: previousPlaybook?.personality || "",
      cooperate_strategy: previousPlaybook?.cooperate_strategy || "",
      betray_strategy: previousPlaybook?.betray_strategy || "",
      secret_weapon: previousPlaybook?.secret_weapon || "",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ playbook: newPlaybook, seasonId: season.id });
}

export async function PUT(req: NextRequest) {
  const cookieStore = await cookies();
  const teamId = cookieStore.get("team_id")?.value;
  if (!teamId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { personality, cooperateStrategy, betrayStrategy, secretWeapon, seasonId } = await req.json();

  // Validate lengths
  if (personality && personality.length > 500) {
    return NextResponse.json({ error: "Personality too long (max 500)" }, { status: 400 });
  }
  if (cooperateStrategy && cooperateStrategy.length > 300) {
    return NextResponse.json({ error: "Cooperate strategy too long (max 300)" }, { status: 400 });
  }
  if (betrayStrategy && betrayStrategy.length > 300) {
    return NextResponse.json({ error: "Betray strategy too long (max 300)" }, { status: 400 });
  }
  if (secretWeapon && secretWeapon.length > 100) {
    return NextResponse.json({ error: "Secret weapon too long (max 100)" }, { status: 400 });
  }

  const supabase = createServerClient();

  // Upsert: create if missing (team joined before season existed), update if exists
  const { data, error } = await supabase
    .from("playbooks")
    .upsert(
      {
        team_id: teamId,
        season_id: seasonId,
        personality: personality || "",
        cooperate_strategy: cooperateStrategy || "",
        betray_strategy: betrayStrategy || "",
        secret_weapon: secretWeapon || "",
        submitted_at: new Date().toISOString(),
        ready: false,
      },
      { onConflict: "team_id,season_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ playbook: data });
}

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  const teamId = cookieStore.get("team_id")?.value;
  if (!teamId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { ready, seasonId } = await req.json();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("playbooks")
    .update({ ready: !!ready })
    .eq("team_id", teamId)
    .eq("season_id", seasonId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ playbook: data });
}
