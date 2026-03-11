import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const adminSecret = req.headers.get("x-admin-secret");
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { number, pointsMultiplier = 1, totalRounds = 5 } = await req.json();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("seasons")
    .insert({
      number,
      status: "pending",
      total_rounds: totalRounds,
      points_multiplier: pointsMultiplier,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ season: data });
}
