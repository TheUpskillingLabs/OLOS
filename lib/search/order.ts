/**
 * Default ordering, ranking, and assembly for the global search — pure,
 * shared by the suggest API (server) and the /search island (client).
 *
 * Every entity gets a numeric `orderKey` (ascending = first). Keys encode
 * a coarse status bucket plus a recency tie-break, so a plain sort gives
 * each group its browse order and — because rankByQuery breaks score ties
 * by incoming index — an upcoming event outranks an equally-scored past
 * one, an active cycle an archived one, and so on.
 */

import { rankByQuery, statusRank } from "@/lib/directory/rank";
import {
  SEARCH_TYPE_ORDER,
  type SearchCorpus,
  type SearchDoc,
  type SearchResult,
  type SearchResultType,
} from "./types";

/** Bucket width for orderKey encoding — comfortably larger than any epoch
 *  timestamp in ms (~1.8e12 today; 2^46 ≈ 7e13 lasts to year ~4200) while
 *  keeping rank * bucket arithmetic well inside Number.MAX_SAFE_INTEGER. */
const BUCKET = 2 ** 46;

/** The events-agenda rule: an event is "upcoming" until it has ended —
 *  in-progress events count as upcoming. `timeMs` is (end_at ?? start_at). */
export function isUpcomingEvent(timeMs: number | null, nowMs: number): boolean {
  return timeMs !== null && timeMs >= nowMs;
}

/** Upcoming soonest-first, then past newest-first (the /events split). */
export function eventOrderKey(
  startMs: number,
  endMs: number | null,
  nowMs: number
): number {
  return isUpcomingEvent(endMs ?? startMs, nowMs)
    ? startMs
    : BUCKET + (BUCKET - startMs);
}

/** Cycles: live first, then recruiting, then winding down, then history. */
export function cycleStatusRank(status: string): number {
  if (status === "active") return 0;
  if (status === "upcoming") return 1;
  if (status === "closing") return 2;
  return 3; // closed, archived
}

export function cycleOrderKey(status: string, startMs: number | null): number {
  return cycleStatusRank(status) * 2 * BUCKET + (BUCKET - (startMs ?? 0));
}

/** Pods/projects: active → forming (retired states are filtered out at the
 *  query, but the key stays total), newest first within a bucket. */
export function podProjectOrderKey(
  status: string,
  createdMs: number | null
): number {
  return statusRank(status) * 2 * BUCKET + (BUCKET - (createdMs ?? 0));
}

/** People: newest members first — the directory's browse order. */
export function personOrderKey(createdMs: number | null): number {
  return BUCKET - (createdMs ?? 0);
}

/** Labs: active before waitlist; ties keep the fetch order (name asc). */
export function labOrderKey(status: string): number {
  return status === "active" ? 0 : 1;
}

/** Dropdown display caps per type (16 rows worst case). */
export const SUGGEST_LIMITS: Record<SearchResultType, number> = {
  person: 5,
  pod: 3,
  project: 3,
  event: 3,
  lab: 2,
  cycle: 2,
};

/** Fetch windows for the q-filtered suggest path — wider than the display
 *  caps so prefix matches can beat substring matches that the DB happened
 *  to return first (ilike has no relevance order). */
export const SUGGEST_FETCH_LIMITS: Record<SearchResultType, number> = {
  person: 10,
  pod: 8,
  project: 8,
  event: 10,
  lab: 6,
  cycle: 6,
};

/** Sort a group into its default order, then rank by query relevance.
 *  Empty query → default order (browse). Array sort is stable, so equal
 *  orderKeys keep the fetch order and equal scores keep the default order. */
export function rankGroup(docs: SearchDoc[], q: string): SearchDoc[] {
  const ordered = [...docs].sort((a, b) => a.orderKey - b.orderKey);
  return rankByQuery(
    ordered,
    q,
    (d) => d.label,
    (d) => d.secondary
  );
}

/**
 * Assemble the final result list: fixed group order, each group ranked,
 * optionally capped per type. Output is type-contiguous — the dropdown
 * renders a group header whenever `type` changes between neighbors.
 */
export function assembleResults(
  corpus: SearchCorpus,
  q: string,
  limits?: Partial<Record<SearchResultType, number>>
): SearchDoc[] {
  const out: SearchDoc[] = [];
  for (const type of SEARCH_TYPE_ORDER) {
    const ranked = rankGroup(corpus[type] ?? [], q);
    const cap = limits?.[type];
    out.push(...(cap != null ? ranked.slice(0, cap) : ranked));
  }
  return out;
}

/** Strip ranking fields for the wire. */
export function toResult(doc: SearchDoc): SearchResult {
  return {
    type: doc.type,
    href: doc.href,
    label: doc.label,
    sublabel: doc.sublabel,
    imageUrl: doc.imageUrl,
    initials: doc.initials,
  };
}
