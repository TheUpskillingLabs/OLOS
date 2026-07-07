import { Suspense } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { fetchDirectoryData } from "@/lib/directory/data";
import DirectorySearch from "./directory-search";
import UpdatesFeed from "./updates-feed";

/**
 * /directory — the community directory (roadmap Phase 2). Members-only: the
 * (dashboard)/layout.tsx guard gates the whole route group, and the weekly
 * Learning-Log gate applies (locked members bounce Home).
 *
 * LinkedIn-style search across the community's three entities — people, pods,
 * and projects — with tabs, filters, and URL-shareable state. Data is fetched
 * once here (lib/directory/data.ts); filtering and ranking are instant on the
 * client.
 *
 * Security: we read display-column allowlists via the SERVICE client — never
 * a widened participants RLS. No PII column (email, phone, zip, dcpl_card,
 * notes, google_id) is selected. Test/staff accounts are excluded everywhere,
 * including pod/project member counts and avatar stacks.
 */

export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  const data = await fetchDirectoryData();

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="t-h1 text-ink">Directory</h1>
          <p className="mt-1 t-small">Find your people. Build your edge.</p>
        </div>
        <Link
          href="/local-labs"
          className="inline-flex items-center gap-1.5 rounded-card border border-ink/10 bg-white px-3.5 py-2 text-sm font-medium text-teal-deep shadow-card transition-colors duration-150 hover:border-teal/40 hover:text-ink"
        >
          <MapPin className="h-4 w-4" aria-hidden />
          Cities
        </Link>
      </header>

      {/* The island reads useSearchParams — Suspense keeps Next happy. */}
      <Suspense>
        <DirectorySearch data={data} updatesSlot={<UpdatesFeed />} />
      </Suspense>
    </div>
  );
}
