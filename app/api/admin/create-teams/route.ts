import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// This endpoint is now just for listing teams in a tournament
export async function GET(req: NextRequest) {
  const tournamentId = req.nextUrl.searchParams.get("tournamentId");
  if (!tournamentId) {
    return NextResponse.json({ error: "tournamentId required" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("created_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ teams: data || [] });
}
