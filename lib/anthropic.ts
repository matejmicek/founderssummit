import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type ModelTier = "fast" | "smart";

const MODEL_MAP: Record<ModelTier, string> = {
  fast: "gpt-4o",
  smart: "gpt-4o",
};

export async function chatCompletion(
  tier: ModelTier,
  system: string,
  userMessage: string,
  maxTokens: number = 400
): Promise<string> {
  const maxRetries = 5;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: MODEL_MAP[tier],
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMessage },
        ],
      });

      const text = response.choices[0]?.message?.content;
      if (!text) throw new Error("Empty response from OpenAI");
      return text;
    } catch (error: unknown) {
      const status = (error as { status?: number }).status;
      if (status === 429 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt + 1) * 1000;
        console.log(`Rate limited (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }

  throw new Error("Max retries exceeded");
}

export { openai };
