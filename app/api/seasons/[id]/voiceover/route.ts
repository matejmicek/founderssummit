import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: seasonId } = await params;
  const round = req.nextUrl.searchParams.get("round");
  const format = req.nextUrl.searchParams.get("format"); // "audio" for raw MP3

  if (!round) {
    return NextResponse.json({ error: "round parameter required" }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("round_voiceovers")
    .select("script, audio_base64")
    .eq("season_id", parseInt(seasonId))
    .eq("round", parseInt(round))
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Voiceover not found" }, { status: 404 });
  }

  // Return raw audio as MP3
  if (format === "audio" && data.audio_base64) {
    const audioBuffer = Buffer.from(data.audio_base64, "base64");
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  // Return metadata
  return NextResponse.json({
    script: data.script,
    hasAudio: !!data.audio_base64,
  });
}
