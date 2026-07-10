import Anthropic from "@anthropic-ai/sdk";

/**
 * Offline fallback name used when generateName fails (no API key, network
 * error, etc.): first 40 chars trimmed back to the nearest word boundary.
 * pods.name / projects.name are VARCHAR(40), so the cap is load-bearing.
 *
 * The partial-word strip only runs when the text was actually truncated —
 * the previous inline version ran it unconditionally, which mangled short
 * inputs ("Solar Co-op" → "Solar"; caught by names.test.ts). When the first
 * 40 chars contain no whitespace the regex doesn't match and the full
 * 40-char slice is returned as-is.
 */
export function nameFallback(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= 40) return trimmed;
  return trimmed.slice(0, 40).replace(/\s+\S*$/, "").trim();
}

// Lazy so that a missing ANTHROPIC_API_KEY throws inside generateName —
// where callers already catch and fall back to nameFallback — instead of at
// module import, which would 500 every route that imports this file.
let anthropic: Anthropic | null = null;

export async function generateName(
  type: "pod" | "project",
  description: string
): Promise<string> {
  anthropic ??= new Anthropic();
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 50,
    messages: [
      {
        role: "user",
        content: `Generate a short, catchy name for a ${type} based on this description. Rules: 3 words max, 40 characters max, title case, no punctuation. Just respond with the name, nothing else.\n\nDescription: ${description}`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";
  return text.trim().slice(0, 40);
}
