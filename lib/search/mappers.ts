/**
 * Row → SearchDoc mappers for the global search — pure. Input row types are
 * declared locally with only the allowlisted display columns (the "00044
 * decision": service-client reads never select PII).
 *
 * Href map (verified against the live routes):
 *   person  /u/{handle}          (fallback: /search?q={name} — handles are
 *                                 backfilled + trigger-generated, so rare)
 *   pod     /pods/{id}           project /projects/{id}
 *   event   /events/{slug}       lab     /local-labs/{slug}
 *   cycle   /cycles/{id}         (numeric id — cycles.slug is unused for routing)
 */

import { cityOf, fmtDate, fmtMonth } from "@/lib/content/format";
import { metroLabel } from "@/lib/metros-label";
import {
  cycleOrderKey,
  cycleStatusRank,
  eventOrderKey,
  isUpcomingEvent,
  labOrderKey,
  personOrderKey,
  podProjectOrderKey,
} from "./order";
import type { SearchDoc } from "./types";

/** Supabase embeds arrive as an object or a one-element array depending on
 *  the relationship — normalize (same helper as the old suggest route). */
function first<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

export interface PersonRow {
  id: number;
  handle: string | null;
  preferred_name: string | null;
  first_name: string | null;
  last_name: string | null;
  headline: string | null;
  profile_image_url: string | null;
  created_at: string | null;
}

export function personDoc(row: PersonRow): SearchDoc {
  const name =
    row.preferred_name ||
    `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
  return {
    type: "person",
    href: row.handle
      ? `/u/${row.handle}`
      : `/search?q=${encodeURIComponent(name)}`,
    label: name || "A member",
    sublabel: row.headline ?? null,
    imageUrl: row.profile_image_url ?? null,
    initials:
      `${row.first_name?.[0] ?? ""}${row.last_name?.[0] ?? ""}`.toUpperCase() ||
      "?",
    secondary: [row.headline],
    orderKey: personOrderKey(ms(row.created_at)),
  };
}

export interface PodRow {
  id: number;
  name: string | null;
  status: string;
  created_at: string | null;
  problem_statements:
    | { statement_text: string | null }
    | { statement_text: string | null }[]
    | null;
}

export function podDoc(row: PodRow): SearchDoc {
  const statement = first(row.problem_statements)?.statement_text ?? null;
  return {
    type: "pod",
    href: `/pods/${row.id}`,
    label: row.name ?? `Pod ${row.id}`,
    sublabel: statement,
    imageUrl: null,
    initials: "",
    secondary: [statement],
    orderKey: podProjectOrderKey(row.status, ms(row.created_at)),
  };
}

export interface ProjectRow {
  id: number;
  name: string | null;
  status: string;
  created_at: string | null;
  solution_proposals: { name: string | null } | { name: string | null }[] | null;
}

export function projectDoc(row: ProjectRow): SearchDoc {
  const proposal = first(row.solution_proposals)?.name ?? null;
  return {
    type: "project",
    href: `/projects/${row.id}`,
    label: row.name ?? `Project ${row.id}`,
    sublabel: proposal,
    imageUrl: null,
    initials: "",
    secondary: [proposal],
    orderKey: podProjectOrderKey(row.status, ms(row.created_at)),
  };
}

export interface EventRow {
  id: number;
  slug: string;
  name: string;
  kind: string | null;
  start_at: string;
  end_at: string | null;
  location_type: string | null;
  location_name: string | null;
  host: string | null;
}

export function eventDoc(row: EventRow, nowMs: number): SearchDoc {
  const startMs = ms(row.start_at) ?? 0;
  const endMs = ms(row.end_at);
  const upcoming = isUpcomingEvent(endMs ?? startMs, nowMs);
  // Upcoming: "Jul 28 · 6 PM". Past: "June 2026" — fmtDate carries no year,
  // so month+year keeps old events honest.
  const when = upcoming ? fmtDate(row.start_at) : fmtMonth(row.start_at);
  const where =
    row.location_type === "virtual" ? "Online" : cityOf(row.location_name);
  return {
    type: "event",
    href: `/events/${row.slug}`,
    label: row.name,
    sublabel: [when, where].filter(Boolean).join(" · ") || null,
    imageUrl: null,
    initials: "",
    secondary: [row.location_name, row.host, row.kind],
    orderKey: eventOrderKey(startMs, endMs, nowMs),
  };
}

export interface MetroRow {
  id: number;
  slug: string;
  name: string | null;
  st: string | null;
  status: string;
  blurb: string | null;
  partner: string | null;
}

export function labDoc(row: MetroRow): SearchDoc {
  return {
    type: "lab",
    href: `/local-labs/${row.slug}`,
    label: metroLabel(row.name, row.st) || `Lab ${row.id}`,
    sublabel: row.status === "waitlist" ? "Local Lab · Waitlist" : "Local Lab",
    imageUrl: null,
    initials: "",
    secondary: [row.blurb, row.partner, row.st],
    orderKey: labOrderKey(row.status),
  };
}

export interface CycleRow {
  id: number;
  name: string | null;
  slug: string | null;
  status: string;
  start_date: string | null;
  description: string | null;
  what_you_build: string | null;
}

const CYCLE_STATUS_LABELS = ["Active", "Upcoming", "Closing", "Past"];

export function cycleDoc(row: CycleRow): SearchDoc {
  const statusLabel = CYCLE_STATUS_LABELS[cycleStatusRank(row.status)];
  const month = row.start_date ? fmtMonth(row.start_date) : null;
  return {
    type: "cycle",
    href: `/cycles/${row.id}`,
    label: row.name ?? `Cycle ${row.id}`,
    sublabel: [statusLabel, month].filter(Boolean).join(" · "),
    imageUrl: null,
    initials: "",
    secondary: [row.description, row.what_you_build, row.slug],
    orderKey: cycleOrderKey(row.status, ms(row.start_date)),
  };
}
