import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const seasonId = searchParams.get("seasonId");

  const supabase = createServerClient();

  let query = supabase
    .from("leaderboard")
    .select("*, team:teams(id, name, color)")
    .order("rank", { ascending: true });

  if (seasonId) {
    query = query.eq("season_id", parseInt(seasonId));
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ leaderboard: data || [] });
}
