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

  // Get current active season
  const { data: season } = await supabase
    .from("seasons")
    .select("id")
    .in("status", ["building", "tweaking"])
    .order("number", { ascending: false })
    .limit(1)
    .single();

  if (!season) {
    return NextResponse.json({ error: "No active season" }, { status: 404 });
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

  // Check if previous season has a playbook to carry over
  const { data: previousPlaybook } = await supabase
    .from("playbooks")
    .select("personality, strategy, secret_weapon")
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
      strategy: previousPlaybook?.strategy || "",
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

  const { personality, strategy, secretWeapon, seasonId } = await req.json();

  // Validate lengths
  if (personality && personality.length > 200) {
    return NextResponse.json({ error: "Personality too long (max 200)" }, { status: 400 });
  }
  if (strategy && strategy.length > 300) {
    return NextResponse.json({ error: "Strategy too long (max 300)" }, { status: 400 });
  }
  if (secretWeapon && secretWeapon.length > 100) {
    return NextResponse.json({ error: "Secret weapon too long (max 100)" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("playbooks")
    .update({
      personality: personality || "",
      strategy: strategy || "",
      secret_weapon: secretWeapon || "",
      submitted_at: new Date().toISOString(),
    })
    .eq("team_id", teamId)
    .eq("season_id", seasonId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ playbook: data });
}
