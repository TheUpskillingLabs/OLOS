// Environment banner (DESIGN.md §10).
//
// The same code serves dev and prod; only this banner changes. It reads the
// deployment's own Supabase URL (and VERCEL_ENV as a fallback) so an organizer
// can never confuse which database they're looking at. PROD is loud and red.

/** OLOS production Supabase project ref (DESIGN.md §10). */
const PROD_PROJECT_REF = "cdbgkgkjnomjnpicaxqe";

/** Extract the project ref from a Supabase URL, e.g. https://<ref>.supabase.co. */
function projectRef(url: string | undefined): string {
  if (!url) return "unknown";
  const match = url.match(/^https?:\/\/([^.]+)\./);
  return match ? match[1] : "unknown";
}

export function EnvBanner() {
  const ref = projectRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const isProd =
    ref === PROD_PROJECT_REF || process.env.VERCEL_ENV === "production";

  if (isProd) {
    return (
      <div
        role="status"
        className="mb-6 flex items-center justify-center gap-2 rounded-card border border-red/60 bg-red/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-red shadow-card"
      >
        <span aria-hidden>⚠</span>
        PROD — live participant data — {ref}
      </div>
    );
  }

  return (
    <div
      role="status"
      className="mb-6 flex items-center justify-center gap-2 rounded-card border border-teal/40 bg-teal/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-teal-deep"
    >
      <span aria-hidden className="text-teal">●</span>
      DEV — {ref}
    </div>
  );
}
