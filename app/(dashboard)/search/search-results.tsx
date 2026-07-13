"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, SearchX } from "lucide-react";
import { EmptyState, Tabs } from "@/app/components/ui";
import SearchThumb from "@/app/components/search/search-thumb";
import { rankGroup } from "@/lib/search/order";
import {
  SEARCH_GROUP_LABELS,
  SEARCH_TYPE_ORDER,
  type SearchCorpus,
  type SearchDoc,
  type SearchResultType,
} from "@/lib/search/types";

/**
 * The /search results workspace — tabbed results (All + one tab per entity
 * type) over the server-fetched corpus, mirroring the directory island's
 * contract: client-side instant filtering, URL-shareable state via
 * router.replace, ?focus=1 autofocus for the mobile nav icon:
 *
 *   /search?q=climate&tab=event
 */

type Tab = "all" | SearchResultType;

interface SearchState {
  tab: Tab;
  q: string;
}

function isType(v: string | null): v is SearchResultType {
  return (SEARCH_TYPE_ORDER as readonly string[]).includes(v ?? "");
}

function parseParams(params: URLSearchParams): SearchState {
  const tab = params.get("tab");
  return {
    tab: isType(tab) ? tab : "all",
    q: params.get("q") ?? "",
  };
}

function serialize(state: SearchState): string {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.tab !== "all") params.set("tab", state.tab);
  return params.toString();
}

export default function SearchResults({ data }: { data: SearchCorpus }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<SearchState>(() =>
    parseParams(new URLSearchParams(searchParams))
  );
  // The input tracks keystrokes; state.q follows after a debounce so
  // filtering (and the URL) don't churn on every character.
  const [qInput, setQInput] = useState(state.q);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastWritten = useRef<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setState((s) => (s.q === qInput.trim() ? s : { ...s, q: qInput.trim() }));
    }, 250);
    return () => clearTimeout(t);
  }, [qInput]);

  // State → URL. Skip when already in sync (e.g. right after hydration).
  useEffect(() => {
    const qs = serialize(state);
    if (qs === serialize(parseParams(new URLSearchParams(searchParams)))) {
      return;
    }
    lastWritten.current = qs;
    router.replace(qs ? `/search?${qs}` : "/search", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, router]);

  // URL → state, for changes we didn't write (back/forward, nav search).
  //
  // While one of our own router.replace calls is still in flight,
  // searchParams can deliver a STALE snapshot from an older navigation —
  // adopting it snapped tabs back (the directory island's July 2026 bug).
  // Ignore deliveries until our latest write lands, then resume adopting
  // genuinely external changes.
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const qs = serialize(parseParams(params));
    if (lastWritten.current !== null) {
      if (lastWritten.current === qs) lastWritten.current = null; // landed
      return;
    }
    const next = parseParams(params);
    setState(next);
    setQInput(next.q);
  }, [searchParams]);

  // The mobile nav search icon lands on /search?focus=1.
  useEffect(() => {
    if (new URLSearchParams(searchParams).get("focus")) {
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { tab, q } = state;

  // Rank every group for the current query — the corpus is a few hundred
  // slim rows, so this is instant.
  const ranked = useMemo(() => {
    const out = {} as Record<SearchResultType, SearchDoc[]>;
    for (const type of SEARCH_TYPE_ORDER) {
      out[type] = rankGroup(data[type] ?? [], q);
    }
    return out;
  }, [data, q]);

  const total = SEARCH_TYPE_ORDER.reduce(
    (n, type) => n + ranked[type].length,
    0
  );
  const empty = tab === "all" ? total === 0 : ranked[tab].length === 0;

  const set = (patch: Partial<SearchState>) =>
    setState((s) => ({ ...s, ...patch }));
  const clearSearch = () => {
    setQInput("");
    set({ q: "" });
  };

  return (
    <div>
      {/* Search box */}
      <input
        ref={inputRef}
        type="text"
        placeholder="Search people, pods, projects, events, labs, and cycles…"
        value={qInput}
        onChange={(e) => setQInput(e.target.value)}
        aria-label="Search"
        className="w-full max-w-xl rounded-card border border-ink/10 bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-meta-soft focus:border-teal focus:outline-none focus:ring-[3px] focus:ring-teal/15 transition-[border-color,box-shadow] duration-150"
      />

      {/* Tabs */}
      <Tabs
        className="mt-5"
        value={tab}
        onValueChange={(v) => set({ tab: v as Tab })}
        tabs={[
          { value: "all", label: "All" },
          ...SEARCH_TYPE_ORDER.map((type) => ({
            value: type,
            label: SEARCH_GROUP_LABELS[type],
            badge: (
              <span className="text-xs text-meta tabular-nums">
                {ranked[type].length}
              </span>
            ),
          })),
        ]}
      />

      {/* Results */}
      <div className="mt-6 space-y-10">
        {empty ? (
          <EmptyState
            icon={SearchX}
            title="No results"
            description={
              q
                ? `Nothing matches “${q}”. Try a different term.`
                : "Nothing to show here yet."
            }
            action={
              q ? (
                <button
                  type="button"
                  className="btn btn-teal self-start"
                  onClick={clearSearch}
                >
                  Clear search
                </button>
              ) : undefined
            }
          />
        ) : tab === "all" ? (
          SEARCH_TYPE_ORDER.map((type) => (
            <AllSection
              key={type}
              title={SEARCH_GROUP_LABELS[type]}
              count={ranked[type].length}
              items={ranked[type].slice(0, q ? 3 : 5)}
              onSeeAll={() => set({ tab: type })}
            />
          ))
        ) : (
          <section>
            <p className="mb-3 text-sm text-meta tabular-nums">
              {ranked[tab].length}{" "}
              {ranked[tab].length === 1
                ? SEARCH_GROUP_LABELS[tab].replace(/s$/, "").toLowerCase()
                : SEARCH_GROUP_LABELS[tab].toLowerCase()}
            </p>
            <ResultList>
              {ranked[tab].map((d) => (
                <SearchRow key={d.href} doc={d} />
              ))}
            </ResultList>
          </section>
        )}
      </div>
    </div>
  );
}

function AllSection({
  title,
  count,
  items,
  onSeeAll,
}: {
  title: string;
  count: number;
  items: SearchDoc[];
  onSeeAll: () => void;
}) {
  if (count === 0) return null;
  return (
    <section>
      <div className="section-head" style={{ marginBottom: 14 }}>
        <h2 className="t-h3 text-ink">
          {title} <span className="text-meta tabular-nums">· {count}</span>
        </h2>
        {count > items.length && (
          <button type="button" className="see" onClick={onSeeAll}>
            See all →
          </button>
        )}
      </div>
      <ResultList>
        {items.map((d) => (
          <SearchRow key={d.href} doc={d} />
        ))}
      </ResultList>
    </section>
  );
}

function ResultList({ children }: { children: ReactNode }) {
  return (
    <ul className="card divide-y divide-ink/10 overflow-hidden">{children}</ul>
  );
}

function SearchRow({ doc: d }: { doc: SearchDoc }) {
  return (
    <li>
      <Link
        href={d.href}
        className="flex items-center gap-3.5 px-4 py-3 transition-colors duration-150 hover:bg-teal/5 focus-visible:bg-teal/5"
      >
        <SearchThumb result={d} size="lg" />
        <span className="min-w-0 flex-1">
          <span className="t-h4 block truncate text-ink">{d.label}</span>
          {d.sublabel && (
            <span className="block truncate text-sm font-medium text-charcoal">
              {d.sublabel}
            </span>
          )}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-meta-soft" aria-hidden />
      </Link>
    </li>
  );
}
