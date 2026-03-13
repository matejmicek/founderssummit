import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const teamId = cookieStore.get("team_id")?.value;
  if (!teamId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data: team, error } = await supabase
    .from("teams")
    .select("id, name, color, join_code")
    .eq("id", teamId)
    .single();

  if (error || !team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  return NextResponse.json({ team });
}
