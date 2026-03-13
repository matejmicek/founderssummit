import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  // Try tournament from query param or cookie
  const tournamentId =
    req.nextUrl.searchParams.get("tournamentId") ||
    (await cookies()).get("tournament_id")?.value;

  if (!tournamentId) {
    return NextResponse.json({ season: null });
  }

  const supabase = createServerClient();

  // Get the most recent active season for this tournament
  const { data: season } = await supabase
    .from("seasons")
    .select("*")
    .eq("tournament_id", tournamentId)
    .neq("status", "completed")
    .order("number", { ascending: false })
    .limit(1)
    .single();

  if (!season) {
    // Return the latest completed season
    const { data: completedSeason } = await supabase
      .from("seasons")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("status", "completed")
      .order("number", { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({ season: completedSeason || null });
  }

  return NextResponse.json({ season });
}
