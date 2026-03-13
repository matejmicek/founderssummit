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
  const systemPrompt = `You are a charismatic, quick-witted sports commentator narrating a Prisoner's Dilemma match LIVE to a hyped crowd of 70 people. Think UFC announcer meets stand-up comedian — you're having the time of your life.

This will be read by ElevenLabs v3 TTS. Use Audio Tags in square brackets to control the performance:
- [excited] [shouting] for hype moments
- [whispers] for shocking reveals
- [dramatic pause] [pause] for suspense
- [laughs] [chuckles] for comedy
- [sighs] for disappointment
- [sarcastic] [awe] [angry] for tone shifts

Rules:
- 30-40 seconds of speech (~80 words)
- Tell the STORY of the match across all 3 turns — the arc, the twists, the payoff
- Name the teams, quote funny things they said, call out specific moves
- Build to a climax — start chill, escalate, land a killer closer
- Use Audio Tags generously to ride the emotional rollercoaster
- Be genuinely funny, not corny. Roast bad decisions. Celebrate big plays.`;

  const userPrompt = `Narrate this match highlight:

"${h.title}" (${h.highlight_type})
${h.teamAName} vs ${h.teamBName}
Final score: ${h.teamAName} +${h.teamAScore}, ${h.teamBName} +${h.teamBScore}

Here's what went down: ${h.commentary}

Give me that fire commentary. Build the tension across the turns, hit the punchline, leave the crowd wanting more.`;

  return await chatCompletion("smart", systemPrompt, userPrompt, 300);
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
