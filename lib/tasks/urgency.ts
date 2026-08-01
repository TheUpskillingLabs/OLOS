import { parseWindow } from "@/lib/cycles/lab-time";

/* Deadline-proximity urgency — the ONE derivation both task surfaces use
   (TaskCard on the dashboard queue, TaskRow on the cycle pages), so a
   deadline escalates identically everywhere.

   Two tiers, inside the canonical palette (no amber — the brand block in
   globals.css is deliberately ink/teal/red + neutrals):

     soon     — within 3 days: teal-deep semibold + a relative time suffix
     imminent — within 24 h:   red semibold + the relative suffix

   Anything further out renders as plain meta text. Pure module: no
   Supabase, client-import-safe, `now` always passed in. */

export type DeadlineUrgency = "imminent" | "soon" | null;

export const IMMINENT_HOURS = 24;
export const SOON_HOURS = 72;

export function deadlineUrgency(
  deadline: string | null | undefined,
  now: Date
): DeadlineUrgency {
  const d = parseWindow(deadline);
  if (!d) return null;
  const msLeft = d.getTime() - now.getTime();
  if (msLeft <= 0) return null; // passed — the task is about to drop out anyway
  const hours = msLeft / 3_600_000;
  if (hours <= IMMINENT_HOURS) return "imminent";
  if (hours <= SOON_HOURS) return "soon";
  return null;
}

/** "3 hours left" / "1 day left" — the relative suffix shown alongside the
    absolute lab-time instant once a deadline is within SOON_HOURS. Never a
    replacement for the absolute time (members plan on real clocks). */
export function timeLeftLabel(
  deadline: string | null | undefined,
  now: Date
): string | null {
  const d = parseWindow(deadline);
  if (!d) return null;
  const msLeft = d.getTime() - now.getTime();
  if (msLeft <= 0) return null;
  const hours = msLeft / 3_600_000;
  if (hours > SOON_HOURS) return null;
  if (hours < 1) {
    const mins = Math.max(1, Math.floor(msLeft / 60_000));
    return `${mins} minute${mins === 1 ? "" : "s"} left`;
  }
  if (hours < IMMINENT_HOURS) {
    const h = Math.floor(hours);
    return `${h} hour${h === 1 ? "" : "s"} left`;
  }
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} left`;
}

/** Tailwind classes for a deadline line at a given urgency (empty string
    for the calm default — callers keep their own base classes). */
export function urgencyTextClass(urgency: DeadlineUrgency): string {
  if (urgency === "imminent") return "font-semibold text-red";
  if (urgency === "soon") return "font-semibold text-teal-deep";
  return "";
}
