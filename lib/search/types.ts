/**
 * Global search — shared types. Client-safe: no imports, no server code.
 *
 * The global nav search and the /search page cover six entity types. The
 * wire/display DTO (`SearchResult`) is deliberately identical in shape to
 * the old DirectorySuggestion so the dropdown rendering contract carries
 * over; `SearchDoc` adds the ranking inputs that never leave the app
 * (secondary match fields + a pre-computed default-order key).
 */

export type SearchResultType =
  | "person"
  | "pod"
  | "project"
  | "event"
  | "lab"
  | "cycle";

/** Fixed group order — dropdown and /search page render groups in this
 *  sequence, never score-interleaved across types. */
export const SEARCH_TYPE_ORDER: readonly SearchResultType[] = [
  "person",
  "pod",
  "project",
  "event",
  "lab",
  "cycle",
];

export const SEARCH_GROUP_LABELS: Record<SearchResultType, string> = {
  person: "People",
  pod: "Pods",
  project: "Projects",
  event: "Events",
  lab: "Local Labs",
  cycle: "Cycles",
};

/** The slim, PII-free display DTO sent over the wire and rendered in rows. */
export interface SearchResult {
  type: SearchResultType;
  href: string;
  label: string;
  sublabel: string | null;
  imageUrl: string | null;
  initials: string;
}

/**
 * Internal search document: the DTO plus ranking inputs. Serializable
 * (RSC → island prop), but stripped to `SearchResult` before hitting the
 * suggest API response.
 */
export interface SearchDoc extends SearchResult {
  /** Secondary match fields for rankByQuery (headline, host, blurb, …). */
  secondary: (string | null)[];
  /** Pre-computed default-order key (ascending). Encodes status/recency
   *  buckets so the client never needs `now` — hydration-stable. */
  orderKey: number;
}

export type SearchCorpus = Record<SearchResultType, SearchDoc[]>;
