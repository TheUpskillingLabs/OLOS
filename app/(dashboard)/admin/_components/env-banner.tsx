// Environment banner — the admin shell's DB indicator.
//
// The same code serves dev and prod; only this banner changes. It reads the
// deployment's own Supabase URL (and VERCEL_ENV as a fallback) so an organizer
// can never confuse which database they're looking at. PROD is loud and red.
//
// Promoted out of the Entity Explorer into the admin shell (rendered by
// app/(dashboard)/admin/layout.tsx) so every admin page — not just the
// explorer — carries the warning.

import { isProdProject, projectRef } from "@/lib/env/project";

export function EnvBanner() {
  const ref = projectRef(process.env.NEXT_PUBLIC_SUPABASE_URL);

  if (isProdProject()) {
    return (
      <div
        role="status"
        title={`Supabase project: ${ref}`}
        className="mb-6 flex items-center gap-2 rounded-card border border-red/60 bg-red/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-red shadow-card"
      >
        <span aria-hidden>⚠</span>
        PROD — live participant data — {ref}
      </div>
    );
  }

  return (
    <div
      role="status"
      title={`Supabase project: ${ref}`}
      className="mb-6 flex items-center gap-2 rounded-card border border-teal/40 bg-teal/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-teal-deep"
    >
      <span aria-hidden className="text-teal">●</span>
      DEV — development database
    </div>
  );
}
