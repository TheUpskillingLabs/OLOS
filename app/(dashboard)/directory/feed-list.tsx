"use client";

import { useEffect, useRef, useState } from "react";
import type { FeedItemView, FeedPage, FeedScope } from "@/lib/updates/feed";
import UpdateItem, { type FeedViewer } from "./update-item";

/**
 * The paging half of the community feed. The server shell (updates-feed.tsx)
 * renders page 1 into `initialItems`; this island appends further pages from
 * GET /api/updates/feed as the sentinel scrolls into view.
 *
 * Auto-load is capped: after AUTOLOAD_PAGES the sentinel retires and an
 * explicit "Show more updates" button takes over, so on the phone layout the
 * task cards and footer below the feed stay reachable instead of receding
 * behind an endless scroll.
 *
 * `router.refresh()` (composer post, delete, log save) swaps `initialItems`
 * via new props while this component's appended pages persist in client state.
 * Appended items are deduped against the fresh first page every render, so a
 * post that shifts between the server page and the appended window can never
 * render twice. A row that falls off page 1 between refreshes may briefly
 * drop out of view until the next full load — invisible-but-consistent beats
 * duplicated.
 */

const AUTOLOAD_PAGES = 3;

export default function FeedList({
  initialItems,
  initialCursor,
  scope,
  viewer,
}: {
  initialItems: FeedItemView[];
  initialCursor: string | null;
  scope?: FeedScope;
  viewer: FeedViewer;
}) {
  const [appended, setAppended] = useState<FeedItemView[]>([]);
  // Client-owned once the first extra page lands; until then the freshest
  // server cursor wins (a refresh can move page 1's boundary under us).
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set());
  const [loadedPages, setLoadedPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // A 4xx means paging is broken (bad cursor/scope), not flaky — stop asking.
  const [dead, setDead] = useState(false);

  const inFlight = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const effectiveCursor = appended.length > 0 ? cursor : initialCursor;
  const hasMore = !dead && effectiveCursor != null;
  const autoload = hasMore && !error && loadedPages < AUTOLOAD_PAGES;

  async function loadMore() {
    if (inFlight.current || dead) return;
    const from = appended.length > 0 ? cursor : initialCursor;
    if (from == null) return;
    inFlight.current = true;
    setLoading(true);
    setError(false);
    try {
      const qs = new URLSearchParams({ cursor: from });
      if (scope?.participantId != null) {
        qs.set("participant_id", String(scope.participantId));
      } else if (scope?.pageType != null && scope?.pageId != null) {
        qs.set("page_type", scope.pageType);
        qs.set("page_id", String(scope.pageId));
      }
      const res = await fetch(`/api/updates/feed?${qs.toString()}`);
      if (!res.ok) {
        if (res.status >= 400 && res.status < 500) setDead(true);
        throw new Error(`feed page failed: ${res.status}`);
      }
      const page: FeedPage = await res.json();
      setAppended((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
      setLoadedPages((n) => n + 1);
    } catch {
      setError(true);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }
  // The observer callback outlives any single render — point it at the latest
  // closure instead of re-wiring the observer every render.
  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  });

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !autoload) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMoreRef.current();
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [autoload]);

  function onDeleted(id: number) {
    // Instant removal — router.refresh() only heals the server-rendered page.
    setRemovedIds((prev) => new Set(prev).add(id));
    setAppended((prev) => prev.filter((it) => it.id !== id));
  }

  const shownIds = new Set<number>();
  const visibleInitial = initialItems.filter(
    (it) =>
      !removedIds.has(it.id) &&
      (shownIds.has(it.id) ? false : (shownIds.add(it.id), true))
  );
  const visibleAppended = appended.filter(
    (it) =>
      !removedIds.has(it.id) &&
      (shownIds.has(it.id) ? false : (shownIds.add(it.id), true))
  );

  return (
    <div>
      <ul className="space-y-3">
        {visibleInitial.map((item) => (
          <UpdateItem
            key={item.id}
            item={item}
            viewer={viewer}
            onDeleted={onDeleted}
          />
        ))}
        {visibleAppended.map((item) => (
          <UpdateItem
            key={item.id}
            item={item}
            viewer={viewer}
            onDeleted={onDeleted}
          />
        ))}
      </ul>
      {hasMore && (
        <div className="mt-4 flex justify-center">
          {loading ? (
            <p className="min-h-11 py-2 text-sm text-meta" role="status">
              Loading more updates…
            </p>
          ) : error ? (
            <button
              type="button"
              onClick={() => loadMoreRef.current()}
              className="btn btn-ghost min-h-11 px-4 py-2 text-sm"
            >
              Couldn&apos;t load more — try again
            </button>
          ) : !autoload ? (
            <button
              type="button"
              onClick={() => loadMoreRef.current()}
              className="btn btn-ghost min-h-11 px-4 py-2 text-sm"
            >
              Show more updates
            </button>
          ) : null}
        </div>
      )}
      {/* Sentinel sits after the controls so rootMargin measures from the
          list's true end; retired once the autoload budget is spent. */}
      {autoload && <div ref={sentinelRef} aria-hidden="true" />}
    </div>
  );
}
