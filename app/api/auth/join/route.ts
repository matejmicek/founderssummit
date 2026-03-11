import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const { joinCode } = await req.json();

  if (!joinCode || typeof joinCode !== "string") {
    return NextResponse.json({ error: "Join code required" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: team, error } = await supabase
    .from("teams")
    .select("id, name, color")
    .eq("join_code", joinCode.toUpperCase().trim())
    .single();

  if (error || !team) {
    return NextResponse.json({ error: "Invalid join code" }, { status: 404 });
  }

  // Set team cookie
  const cookieStore = await cookies();
  cookieStore.set("team_id", team.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
  });
  cookieStore.set("team_name", team.name, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
  });

  return NextResponse.json({ team });
}
