/* Small member facts the dashboard and the admin preview both derive for
   the between-cycles surfaces — one definition, so the preview cannot drift.
   Pure module: no Supabase. */

/** The directory card is complete: a headline, a profile photo, and at
    least one "what you're here for" intent (readiness step 8;
    docs/requirements/between-cycles-dashboard.md §3). */
export function directoryCardDone(p: {
  headline?: string | null;
  profile_image_url?: string | null;
  role_intents?: string[] | null;
}): boolean {
  return (
    !!p.headline?.trim() &&
    !!p.profile_image_url?.trim() &&
    Array.isArray(p.role_intents) &&
    p.role_intents.length > 0
  );
}

/** The most recent finished participant cycle (open mode, HQ), for "See
    what {cycle} built". `cycles` must be ordered start_date descending, as
    the dashboard and preview fetch them. */
export function lookBackCycle(
  cycles:
    | { id: number; name: string; status: string; mode: string; lab_id: number | null }[]
    | null
    | undefined
): { id: number; name: string } | null {
  const c = (cycles ?? []).find(
    (x) =>
      x.mode === "open" &&
      x.lab_id === null &&
      (x.status === "closed" || x.status === "archived" || x.status === "closing")
  );
  return c ? { id: c.id, name: c.name } : null;
}
