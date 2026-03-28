import { createServerClient } from "@/lib/supabase";
import { chatCompletion } from "@/lib/anthropic";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = "4YYIPFl9wE5c4L2eu2Gb";
const MODEL_ID = "eleven_v3";

interface HighlightForVoiceover {
  id: string;
  title: string;
  commentary: string;
  highlight_type: string;
  teamAName: string;
  teamBName: string;
  teamADecision: string;
  teamBDecision: string;
  teamAScore: number;
  teamBScore: number;
}

export async function generateVoiceoversForHighlights(
  highlights: HighlightForVoiceover[]
): Promise<void> {
  const supabase = createServerClient();

  // Generate voiceovers in parallel
  await Promise.allSettled(
    highlights.map(async (h) => {
      try {
        const script = await generateScript(h);
        let audioBase64: string | null = null;

        if (ELEVENLABS_API_KEY) {
          audioBase64 = await textToSpeech(script);
        }

        await supabase
          .from("highlights")
          .update({ voiceover_script: script, voiceover_audio_base64: audioBase64 })
          .eq("id", h.id);
      } catch (error) {
        console.error(`Voiceover failed for highlight ${h.id}:`, error);
      }
    })
  );
}

async function generateScript(h: HighlightForVoiceover): Promise<string> {
  const systemPrompt = `You are a charismatic match analyst narrating a Prisoner's Dilemma match to the competing teams — about 70 people who need to learn from what happened so they can improve their agents.

This will be read by ElevenLabs v3 TTS. Use Audio Tags in square brackets to control the performance:
- [excited] [shouting] for hype moments
- [whispers] for shocking reveals
- [dramatic pause] [pause] for suspense
- [laughs] [chuckles] for comedy
- [sighs] for disappointment
- [sarcastic] [awe] [angry] for tone shifts

Rules:
- 40-50 seconds of speech (~100-120 words)
- Walk through the match turn by turn — what each agent said, how they played each other
- Call out the specific tactics: "They opened with a trust play, promised cooperation, then flipped on turn two"
- Highlight the KEY moment — the turn where someone got outplayed, the promise that sealed the deal, the bluff that failed
- Make teams think "I need to update my prompt to handle THAT"
- Name the teams. Quote the funniest or most devastating lines.
- Be entertaining but educational — roast bad plays, celebrate smart ones
- Use Audio Tags to ride the emotional beats`;

  const userPrompt = `Break down this match for the competing teams:

"${h.title}" (${h.highlight_type})
${h.teamAName} vs ${h.teamBName}
Final score: ${h.teamAName} +${h.teamAScore}, ${h.teamBName} +${h.teamBScore}

Tactical breakdown: ${h.commentary}

Narrate this turn by turn. Make the teams feel the dynamics — who outplayed who and how. End with something that makes everyone want to go rewrite their prompt.`;

  return await chatCompletion("smart", systemPrompt, userPrompt, 400);
}

async function textToSpeech(script: string): Promise<string> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: script,
        model_id: MODEL_ID,
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.75,
          style: 0.3,
          speed: 1.05,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error ${response.status}: ${errorText}`);
  }

  const audioBuffer = await response.arrayBuffer();
  return Buffer.from(audioBuffer).toString("base64");
}
