/* The light waitlist for the next public Build Cycle is participants.role_intents
   containing 'cycle' (chosen at sign-up, or one tap on the dashboard;
   lib/cycles/whats-next.ts, docs/requirements/cycle-4-readiness.md §1). The
   PATCH /api/participants/{id} body replaces the whole array, so the
   dashboard button sends the member's intents with 'cycle' added or removed —
   keeping every other intent and the original order. Pure module. */

export function onCycleWaitlist(intents: readonly string[] | null | undefined): boolean {
  return (intents ?? []).includes("cycle");
}

export function withCycleIntent(
  intents: readonly string[] | null | undefined,
  on: boolean
): string[] {
  const rest = [...new Set(intents ?? [])].filter((i) => i !== "cycle");
  return on ? ["cycle", ...rest] : rest;
}
