import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const adminSecret = req.headers.get("x-admin-secret");
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();

  const [teamsResult, seasonsResult] = await Promise.all([
    supabase.from("teams").select("*").order("created_at"),
    supabase.from("seasons").select("*").order("number"),
  ]);

  return NextResponse.json({
    teams: teamsResult.data || [],
    seasons: seasonsResult.data || [],
  });
}
