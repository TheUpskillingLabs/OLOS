"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarX2, SearchX } from "lucide-react";
import { EmptyState, FilterDropdown } from "@/app/components/ui";
import { fmtMonth, monthKey } from "@/lib/content/format";
import type { EventRow } from "@/lib/content/queries";
import { EventTeaser } from "./teasers";

/**
 * The month-grouped events agenda — shared by the public /events page and the
 * /learning events section. Upcoming events render first under month headers
 * (soonest month first); past events live in a separate tab (newest first).
 * Filters: Online / In person, the ✦ anchor toggle, a Kind dropdown (built
 * from kinds actually present — most Luma imports have none), and a debounced
 * search over name/venue/host.
 *
 * All filtering is client-side over the server-fetched list (~90 rows).
 * `nowMs` comes from the server page so the upcoming/past split is identical
 * between SSR and hydration. `syncUrl` mirrors state to the query string
 * (public page only — /learning's hash-anchor chips would fight URL writes).
 * `corners` maps slug → a save-button node (serializable across the RSC
 * boundary, unlike a render prop); /learning passes it, the public page
 * doesn't.
 */

type View = "upcoming" | "past";

interface AgendaState {
  view: View;
  q: string;
  loc: "virtual" | "in_person" | null;
  anchor: boolean;
  kind: string | null;
}

const DEFAULTS: AgendaState = {
  view: "upcoming",
  q: "",
  loc: null,
  anchor: false,
  kind: null,
};

const LOC_FILTERS: { key: AgendaState["loc"] & string; label: string }[] = [
  { key: "virtual", label: "Online" },
  { key: "in_person", label: "In person" },
];

function parseParams(params: URLSearchParams): AgendaState {
  const loc = params.get("loc");
  return {
    view: params.get("view") === "past" ? "past" : "upcoming",
    q: params.get("q") ?? "",
    loc: loc === "virtual" || loc === "in_person" ? loc : null,
    anchor: params.get("anchor") === "1",
    kind: params.get("kind"),
  };
}

function serialize(state: AgendaState): string {
  const params = new URLSearchParams();
  if (state.view !== "upcoming") params.set("view", state.view);
  if (state.q) params.set("q", state.q);
  if (state.loc) params.set("loc", state.loc);
  if (state.anchor) params.set("anchor", "1");
  if (state.kind) params.set("kind", state.kind);
  return params.toString();
}

export default function EventsAgenda({
  events,
  nowMs,
  corners,
  syncUrl = false,
}: {
  /** All published events, start_at ascending (getEvents() order). */
  events: EventRow[];
  /** Server clock — keeps the upcoming/past split hydration-stable. */
  nowMs: number;
  /** slug → save-button node (the /learning hearts). */
  corners?: Record<string, ReactNode>;
  /** Mirror state to the URL (shareable) — public /events only. */
  syncUrl?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<AgendaState>(() =>
    syncUrl ? parseParams(new URLSearchParams(searchParams)) : DEFAULTS
  );
  const [qInput, setQInput] = useState(state.q);
  const lastWritten = useRef<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setState((s) => (s.q === qInput.trim() ? s : { ...s, q: qInput.trim() }));
    }, 250);
    return () => clearTimeout(t);
  }, [qInput]);

  // State → URL (public page). Skip when already in sync.
  useEffect(() => {
    if (!syncUrl) return;
    const qs = serialize(state);
    if (qs === serialize(parseParams(new URLSearchParams(searchParams)))) {
      return;
    }
    lastWritten.current = qs;
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, router, pathname, syncUrl]);

  // URL → state, for changes we didn't write (back/forward).
  useEffect(() => {
    if (!syncUrl) return;
    const params = new URLSearchParams(searchParams);
    const qs = serialize(parseParams(params));
    if (lastWritten.current === qs) return;
    const next = parseParams(params);
    setState(next);
    setQInput(next.q);
  }, [searchParams, syncUrl]);

  const { view, q, loc, anchor, kind } = state;

  // Upcoming keeps in-progress events (end_at not yet passed) rather than
  // dropping a live session into Past the minute it starts.
  const { upcoming, past } = useMemo(() => {
    const isUpcoming = (e: EventRow) =>
      new Date(e.end_at ?? e.start_at).getTime() >= nowMs;
    return {
      upcoming: events.filter(isUpcoming),
      past: events.filter((e) => !isUpcoming(e)).reverse(), // ASC in → newest first
    };
  }, [events, nowMs]);

  const kinds = useMemo(
    () =>
      [...new Set(events.map((e) => e.kind).filter((k): k is string => !!k))].sort(),
    [events]
  );

  const matches = useMemo(() => {
    const needle = q.toLowerCase();
    return (e: EventRow) =>
      (!loc || e.location_type === loc) &&
      (!anchor || e.anchor) &&
      (!kind || e.kind === kind) &&
      (!needle ||
        [e.name, e.location_name, e.host].some((f) =>
          f?.toLowerCase().includes(needle)
        ));
  }, [q, loc, anchor, kind]);

  const filteredUpcoming = useMemo(
    () => upcoming.filter(matches),
    [upcoming, matches]
  );
  const filteredPast = useMemo(() => past.filter(matches), [past, matches]);

  const shown = view === "upcoming" ? filteredUpcoming : filteredPast;
  const total = view === "upcoming" ? upcoming.length : past.length;

  // Order-preserving single pass: upcoming arrives soonest-first, past
  // newest-first, so groups come out in display order with no extra sort.
  const groups = useMemo(() => {
    const out: { key: string; label: string; events: EventRow[] }[] = [];
    for (const e of shown) {
      const k = monthKey(e.start_at);
      const last = out[out.length - 1];
      if (!last || last.key !== k) {
        out.push({ key: k, label: fmtMonth(e.start_at), events: [e] });
      } else {
        last.events.push(e);
      }
    }
    return out;
  }, [shown]);

  const activeFilterCount = [loc, anchor || null, kind].filter(Boolean).length;
  const set = (patch: Partial<AgendaState>) =>
    setState((s) => ({ ...s, ...patch }));
  const resetAll = () => {
    setQInput("");
    set({ q: "", loc: null, anchor: false, kind: null });
  };

  const isFiltered = !!q || activeFilterCount > 0;

  return (
    <div className="agenda">
      {/* One slim toolbar — segmented view toggle, compact search, filter
          chips, kind dropdown, reset — so the cards start near the fold. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="seg" role="group" aria-label="Upcoming or past events">
          {(
            [
              { key: "upcoming", label: "Upcoming", n: filteredUpcoming.length },
              { key: "past", label: "Past", n: filteredPast.length },
            ] as const
          ).map((v) => (
            <button
              key={v.key}
              type="button"
              className={view === v.key ? "active" : undefined}
              aria-pressed={view === v.key}
              onClick={() => set({ view: v.key })}
            >
              {v.label} <span className="tabular-nums">{v.n}</span>
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search sessions and venues…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          aria-label="Search events"
          className="h-[38px] w-full rounded-card border border-ink/10 bg-white px-3 text-sm text-ink placeholder:text-meta-soft focus:border-teal focus:outline-none focus:ring-[3px] focus:ring-teal/15 transition-[border-color,box-shadow] duration-150 md:w-60"
        />
        {LOC_FILTERS.map((f) => {
          const active = loc === f.key;
          return (
            <button
              key={f.key}
              type="button"
              className={`chip${active ? " active" : ""}`}
              aria-pressed={active}
              onClick={() => set({ loc: active ? null : f.key })}
            >
              {f.label}
            </button>
          );
        })}
        <button
          type="button"
          className={`chip${anchor ? " active" : ""}`}
          aria-pressed={anchor}
          title="The cycle's anchor events"
          onClick={() => set({ anchor: !anchor })}
        >
          ✦ Anchor events
        </button>
        {kinds.length >= 2 && (
          <FilterDropdown
            label="Kind"
            anyLabel="Any kind"
            value={kind}
            options={kinds.map((k) => ({ value: k, label: k }))}
            onChange={(v) => set({ kind: v })}
          />
        )}
        {activeFilterCount > 0 && (
          <button
            type="button"
            className="ml-1 text-sm font-medium text-teal-deep hover:text-ink transition-colors duration-150"
            onClick={resetAll}
          >
            Reset filters ({activeFilterCount})
          </button>
        )}
        {isFiltered && shown.length > 0 && (
          <span className="text-xs text-meta tabular-nums">
            {shown.length} of {total}
          </span>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="mt-6">
          {q || activeFilterCount > 0 ? (
            <EmptyState
              icon={SearchX}
              title="No matching sessions"
              description="Nothing matches your search. Try a different term, or clear the filters."
              action={
                <button
                  type="button"
                  className="btn btn-teal self-start"
                  onClick={resetAll}
                >
                  Clear search
                </button>
              }
            />
          ) : view === "upcoming" && past.length > 0 ? (
            <EmptyState
              icon={CalendarX2}
              title="No upcoming sessions yet"
              description="New sessions land here as soon as they're scheduled."
              action={
                <button
                  type="button"
                  className="btn btn-teal self-start"
                  onClick={() => set({ view: "past" })}
                >
                  Browse past events ({past.length})
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={CalendarX2}
              title="No sessions scheduled yet"
              description="Check back soon."
            />
          )}
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.key}>
            <h2 className="month-head">{g.label}</h2>
            {/* `.all` is load-bearing: without it .cards.dense hides cards 7+
                on desktop (globals.css nth-child cap). */}
            <div className="cards dense all">
              {g.events.map((e) => (
                <EventTeaser key={e.slug} event={e} corner={corners?.[e.slug]} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
