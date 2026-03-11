import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServerClient();

  // Get the most recent active season
  const { data: season } = await supabase
    .from("seasons")
    .select("*")
    .neq("status", "completed")
    .order("number", { ascending: false })
    .limit(1)
    .single();

  if (!season) {
    // Return the latest completed season
    const { data: completedSeason } = await supabase
      .from("seasons")
      .select("*")
      .eq("status", "completed")
      .order("number", { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({ season: completedSeason || null });
  }

  return NextResponse.json({ season });
}
