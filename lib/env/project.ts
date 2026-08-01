// Which Supabase project is this deployment pointed at?
//
// The same code serves local, dev and prod; only the database differs. Anything
// that must behave differently against live participant data reads this — the
// admin EnvBanner (the visible indicator) and the member-simulation guard in
// lib/auth/simulation.ts (which tightens to owner-only on prod).

/** OLOS production Supabase project ref. */
export const PROD_PROJECT_REF = "cdbgkgkjnomjnpicaxqe";

/** Extract the project ref from a Supabase URL, e.g. https://<ref>.supabase.co. */
export function projectRef(url: string | undefined): string {
  if (!url) return "unknown";
  const match = url.match(/^https?:\/\/([^.]+)\./);
  return match ? match[1] : "unknown";
}

/**
 * True when this deployment talks to the production database.
 *
 * Checks the Supabase URL first (authoritative — it names the actual database)
 * and falls back to `VERCEL_ENV` so a prod deployment misconfigured to point at
 * dev still reads as prod. Either signal is enough: the failure we care about
 * is treating prod as dev, never the reverse.
 */
export function isProdProject(): boolean {
  return (
    projectRef(process.env.NEXT_PUBLIC_SUPABASE_URL) === PROD_PROJECT_REF ||
    process.env.VERCEL_ENV === "production"
  );
}
