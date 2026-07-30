"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarX2, SearchX } from "lucide-react";
import { EmptyState } from "@/app/components/ui";
import { cityOf, fmtDate, fmtMonth, monthKey } from "@/lib/content/format";
import type { EventRow } from "@/lib/content/queries";
import { EventTeaser } from "./teasers";

/**
 * The month-grouped events agenda — shared by the public /events page and the
 * /learning events section. Upcoming events render first under month headers
 * (soonest month first); past events live in a separate tab (newest first).
 * Filters: a segmented All / Workshops / Anchor events control, and In person
 * / Virtual chips, plus a debounced search over name/venue/host. The first is
 * segmented rather than chips so "All" has somewhere to live and the three
 * read as one exclusive choice; the location pair are chips because either can
 * be off. The word "kind" appears nowhere a reader can see it — it is the
 * database column (00092: NOT NULL DEFAULT 'Workshop', so a daily Luma import
 * is filterable the moment it lands), not a label.
 *
 * All filtering is client-side over the server-fetched list (~90 rows).
 * `nowMs` comes from the server page so the upcoming/past split is identical
 * between SSR and hydration. `syncUrl` mirrors state to the query string
 * (public page only — /learning's hash-anchor chips would fight URL writes).
 * `corners` maps slug → a save-button node (serializable across the RSC
 * boundary, unlike a render prop); /learning passes it, the public page
 * doesn't.
 *
 * Mobile (public page only): the cards give way to bare agenda rows — date ·
 * time, title, city — per the owner's 390px mock (July 2026). A phone screen
 * fits three thumbnail cards; the row list puts a whole month in the same
 * space, which is the point of an agenda. /learning keeps cards at every
 * width because its save hearts live on the card corner.
 */

type View = "upcoming" | "past";

interface AgendaState {
  view: View;
  q: string;
  loc: "virtual" | "in_person" | null;
  kind: string | null;
}

const DEFAULTS: AgendaState = {
  view: "upcoming",
  q: "",
  loc: null,
  kind: null,
};

const LOC_FILTERS: { key: AgendaState["loc"] & string; label: string }[] = [
  { key: "in_person", label: "In person" },
  { key: "virtual", label: "Virtual" },
];

/* The type segments. `value` is the stored `events.kind` exactly as the CHECK
   in 00092 spells it (null = All); `label` is what the page shows. Fixed
   rather than derived from the data so the control doesn't reflow, and so a
   bucket with nothing in it this month still reads as a category that exists —
   landing on the "no matching sessions" empty state rather than vanishing.

   This is not the old ✦ toggle returning. That chip was the only way to find
   the cycle spine, which is why it went; anchors now lead the page in the
   featured strip, and this just narrows the list below them. */
const TYPE_SEGMENTS: { value: string | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "Workshop", label: "Workshops" },
  { value: "Anchor", label: "Anchor events" },
];
const TYPE_VALUES = new Set(
  TYPE_SEGMENTS.map((t) => t.value).filter((v): v is string => v !== null)
);

function parseParams(params: URLSearchParams): AgendaState {
  const loc = params.get("loc");
  const type = params.get("type");
  return {
    view: params.get("view") === "past" ? "past" : "upcoming",
    q: params.get("q") ?? "",
    loc: loc === "virtual" || loc === "in_person" ? loc : null,
    // An unknown ?type= (a hand-edited or stale link) falls back to All rather
    // than filtering the page down to nothing.
    kind: type && TYPE_VALUES.has(type) ? type : null,
  };
}

function serialize(state: AgendaState): string {
  const params = new URLSearchParams();
  if (state.view !== "upcoming") params.set("view", state.view);
  if (state.q) params.set("q", state.q);
  if (state.loc) params.set("loc", state.loc);
  if (state.kind) params.set("type", state.kind);
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

  const { view, q, loc, kind } = state;

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

  const matches = useMemo(() => {
    const needle = q.toLowerCase();
    return (e: EventRow) =>
      (!loc || e.location_type === loc) &&
      (!kind || e.kind === kind) &&
      (!needle ||
        [e.name, e.location_name, e.host].some((f) =>
          f?.toLowerCase().includes(needle)
        ));
  }, [q, loc, kind]);

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

  const activeFilterCount = [loc, kind].filter(Boolean).length;
  const set = (patch: Partial<AgendaState>) =>
    setState((s) => ({ ...s, ...patch }));
  const resetAll = () => {
    setQInput("");
    set({ q: "", loc: null, kind: null });
  };

  const isFiltered = !!q || activeFilterCount > 0;

  return (
    <div className="agenda">
      {/* One slim toolbar — upcoming/past toggle, compact search, the
          All/Workshops/Anchor segments, the location chips, reset — so the
          cards start near the fold. */}
      <div className="flex flex-wrap items-center gap-2">
        {/* No live counts in the segment labels — a changing digit resized
            the pill as filters narrowed the list (July 2026 feedback); the
            "N of M" readout at the row's end already carries the number. */}
        <div className="seg" role="group" aria-label="Upcoming or past events">
          {(
            [
              { key: "upcoming", label: "Upcoming" },
              { key: "past", label: "Past" },
            ] as const
          ).map((v) => (
            <button
              key={v.key}
              type="button"
              className={view === v.key ? "active" : undefined}
              aria-pressed={view === v.key}
              onClick={() => set({ view: v.key })}
            >
              {v.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search sessions and venues…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          aria-label="Search events"
          className="h-11 w-full rounded-card border border-ink/10 bg-white px-4 text-base text-ink placeholder:text-meta-soft focus:border-teal focus:outline-none focus:ring-[3px] focus:ring-teal/15 transition-[border-color,box-shadow] duration-150 md:w-96"
        />
        <div className="seg" role="group" aria-label="Filter by event type">
          {TYPE_SEGMENTS.map((t) => {
            const active = kind === t.value;
            return (
              <button
                key={t.label}
                type="button"
                className={active ? "active" : undefined}
                aria-pressed={active}
                onClick={() => set({ kind: t.value })}
              >
                {t.label}
              </button>
            );
          })}
        </div>
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
            {/* No session count beside the month (owner call — same as the
                hero): the list under it is its own answer. */}
            <h2 className="month-head">{g.label}</h2>
            {/* `.all` is load-bearing: without it .cards.dense hides cards 7+
                on desktop (globals.css nth-child cap). */}
            <div className={`cards dense all${syncUrl ? " max-md:hidden" : ""}`}>
              {g.events.map((e) => (
                <EventTeaser key={e.slug} event={e} corner={corners?.[e.slug]} />
              ))}
            </div>
            {syncUrl && (
              <div className="md:hidden">
                {g.events.map((e) => (
                  <AgendaRow key={e.slug} event={e} />
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}

/* One mobile agenda row — the 390px mock's list item: date · time and title
   on the left, the city (or Virtual) trailing right, anchors on a tint so the
   spine reads at a glance without a ✦. The whole row is the link. */
function AgendaRow({ event: e }: { event: EventRow }) {
  const isAnchor = e.kind === "Anchor";
  return (
    <Link
      href={`/events/${e.slug}`}
      className="flex items-baseline justify-between gap-3"
      style={{
        borderTop: "1px solid var(--rule)",
        padding: "12px 10px",
        background: isAnchor ? "var(--tint)" : undefined,
        borderRadius: isAnchor ? "var(--r)" : undefined,
        color: "inherit",
        textDecoration: "none",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div className="lbl lbl-teal">{fmtDate(e.start_at)}</div>
        <div
          className="t-h4"
          style={{
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {e.name}
        </div>
      </div>
      <span className="lbl" style={{ flexShrink: 0 }}>
        {e.location_type === "virtual" ? "Virtual" : cityOf(e.location_name)}
      </span>
    </Link>
  );
}
