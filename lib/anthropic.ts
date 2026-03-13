import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Model mapping: Haiku-equivalent = gpt-4o-mini, Sonnet-equivalent = gpt-4o
export type ModelTier = "fast" | "smart";

const MODEL_MAP: Record<ModelTier, string> = {
  fast: "gpt-4o-mini",
  smart: "gpt-4o",
};

export async function chatCompletion(
  tier: ModelTier,
  system: string,
  userMessage: string,
  maxTokens: number = 400
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: MODEL_MAP[tier],
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userMessage },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");
  return content;
}

export { openai };
