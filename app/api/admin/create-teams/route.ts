import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid confusion
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const DEFAULT_TEAMS = [
  { name: "Alpha", color: "#ef4444" },
  { name: "Bravo", color: "#f97316" },
  { name: "Charlie", color: "#eab308" },
  { name: "Delta", color: "#22c55e" },
  { name: "Echo", color: "#06b6d4" },
  { name: "Foxtrot", color: "#3b82f6" },
  { name: "Golf", color: "#6366f1" },
  { name: "Hotel", color: "#8b5cf6" },
  { name: "India", color: "#ec4899" },
  { name: "Juliet", color: "#f43f5e" },
];

export async function POST(req: NextRequest) {
  const adminSecret = req.headers.get("x-admin-secret");
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const teams = body.teams || DEFAULT_TEAMS;
  const teamCount = Math.min(teams.length, 20);

  const supabase = createServerClient();

  const teamRows = [];
  for (let i = 0; i < teamCount; i++) {
    teamRows.push({
      name: teams[i].name,
      color: teams[i].color,
      join_code: generateJoinCode(),
    });
  }

  const { data, error } = await supabase
    .from("teams")
    .insert(teamRows)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ teams: data });
}
