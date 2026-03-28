import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { cookies } from "next/headers";

// GET /api/team/resolve?code=XXXXX — Look up team by join_code and set cookies
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: team, error } = await supabase
    .from("teams")
    .select("id, name, color, join_code, tournament_id")
    .eq("join_code", code.toUpperCase().trim())
    .single();

  if (error || !team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  // Set cookies so the rest of the app works
  const cookieStore = await cookies();
  const opts = {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24,
  };
  cookieStore.set("team_id", team.id, { ...opts, httpOnly: true });
  cookieStore.set("team_name", team.name, opts);
  cookieStore.set("tournament_id", team.tournament_id, opts);

  return NextResponse.json({ team });
}
