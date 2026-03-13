import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: seasonId } = await params;
  const adminSecret = req.headers.get("x-admin-secret");
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  await supabase
    .from("seasons")
    .update({ round_status: "idle" })
    .eq("id", seasonId);

  return NextResponse.json({ ok: true });
}
