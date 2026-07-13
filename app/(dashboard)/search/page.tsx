import { Suspense } from "react";
import { fetchSearchDocs } from "@/lib/search/data";
import SearchResults from "./search-results";

/**
 * /search — global search results over all six entity types: people, pods,
 * projects, events, local labs, and cycles. Members-only via the
 * (dashboard)/layout.tsx gate (and the proxy middleware — /search is not a
 * public path). The nav search bar's plain-Enter, "See all results", and
 * mobile icon all land here.
 *
 * Follows the /directory model: the corpus is fetched once server-side
 * (lib/search/data.ts owns the visibility guards and column allowlists);
 * filtering and ranking are instant on the client. Event recency is baked
 * into each doc's orderKey here on the server, so the island never needs
 * "now" — hydration-stable.
 */

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const data = await fetchSearchDocs();

  return (
    <div className="space-y-10">
      <header>
        <h1 className="t-h1 text-ink">Search</h1>
        <p className="mt-1 t-small">
          People, pods, projects, events, labs, and cycles — all in one place.
        </p>
      </header>

      {/* The island reads useSearchParams — Suspense keeps Next happy. */}
      <Suspense>
        <SearchResults data={data} />
      </Suspense>
    </div>
  );
}
