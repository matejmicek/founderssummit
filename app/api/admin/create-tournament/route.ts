import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(req: NextRequest) {
  const adminSecret = req.headers.get("x-admin-secret");
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await req.json();
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Tournament name required" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("tournaments")
    .insert({ name: name.trim(), join_code: generateCode() })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tournament: data });
}
