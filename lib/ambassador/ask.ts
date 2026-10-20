/* The personal, dated ask an ambassador sends from their own phone ("say {me}
   sent you") — the strongest lever in the research: a dated invite from
   someone you know. Shared by the Conversation step's "Who will you ask?" and
   "Who's first?" on the apply flow's pass. Nothing is sent by OLOS.

   Pure module. */

import type { AmbassadorSession } from "./session";

/** Fill the invite template with the next session, or the undated one. */
export function askMessage(
  template: string,
  templateOpen: string,
  them: string,
  me: string,
  session: Pick<AmbassadorSession, "type" | "day" | "time" | "place"> | null
): string {
  const t = session ? template : templateOpen;
  return t
    .replaceAll("{them}", them || "…")
    .replaceAll("{me}", me || "…")
    .replaceAll("{what}", session?.type ?? "")
    .replaceAll("{day}", session?.day ?? "")
    .replaceAll("{time}", session?.time ?? "")
    .replaceAll("{place}", session?.place ?? "");
}

/** Opens the phone's messaging app with the text ready to send. */
export function smsHref(text: string, to = ""): string {
  return `sms:${to}?&body=${encodeURIComponent(text)}`;
}

/** Spoken-length estimate: ~150 words a minute (65–85 words ≈ 30 s). */
export function wordStats(text: string): { words: number; seconds: number } {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return { words, seconds: Math.round((words / 150) * 60) };
}

/** The 30-second why, built from the four answers until the ambassador edits
 *  the draft itself. */
export function buildStory(answers: string[]): string {
  return answers
    .map((a) => a.trim())
    .filter(Boolean)
    .map((v) => (/[.?!]$/.test(v) ? v : `${v}.`))
    .join(" ");
}
