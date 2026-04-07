import { NextRequest, NextResponse } from "next/server";
import { getHighlightData, getTeamHighlightData } from "@/lib/engine/highlights";
import { generateVoiceoversForHighlights } from "@/lib/engine/voiceover";

export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: seasonId } = await params;
  const adminSecret = req.headers.get("x-admin-secret");
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const round = parseInt(req.nextUrl.searchParams.get("round") || "1");

  try {
    // Generate voiceovers for global highlights
    const highlightData = await getHighlightData(parseInt(seasonId), round);
    const needsVoiceover = highlightData.filter((h) => h.id); // all of them

    if (needsVoiceover.length > 0) {
      await generateVoiceoversForHighlights(needsVoiceover);
    }

    // Generate voiceovers for team highlights
    const teamHighlightData = await getTeamHighlightData(parseInt(seasonId), round);
    if (teamHighlightData.length > 0) {
      await generateVoiceoversForHighlights(teamHighlightData);
    }

    return NextResponse.json({
      generated: needsVoiceover.length + teamHighlightData.length,
      globalHighlights: needsVoiceover.length,
      teamHighlights: teamHighlightData.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error).slice(0, 500) },
      { status: 500 }
    );
  }
}
