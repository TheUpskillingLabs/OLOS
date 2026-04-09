import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function generateName(
  type: "pod" | "project",
  description: string
): Promise<string> {
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
