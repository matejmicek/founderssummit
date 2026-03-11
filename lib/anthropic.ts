import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function chatCompletion(
  model: "claude-haiku-4-5-20251001" | "claude-sonnet-4-6-20250514",
  system: string,
  userMessage: string,
  maxTokens: number = 400
): Promise<string> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = response.content[0];
  if (block.type === "text") {
    return block.text;
  }
  throw new Error("Unexpected response type from Claude");
}

export { anthropic };
