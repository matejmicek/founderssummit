import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  const [matchResult, messagesResult, turnsResult] = await Promise.all([
    supabase
      .from("matches")
      .select("*, team_a:teams!matches_team_a_id_fkey(id, name, color), team_b:teams!matches_team_b_id_fkey(id, name, color)")
      .eq("id", id)
      .single(),
    supabase
      .from("messages")
      .select("*")
      .eq("match_id", id)
      .order("sequence"),
    supabase
      .from("match_turns")
      .select("*")
      .eq("match_id", id)
      .order("turn"),
  ]);

  if (matchResult.error) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  return NextResponse.json({
    match: matchResult.data,
    messages: messagesResult.data || [],
    turns: turnsResult.data || [],
  });
}
