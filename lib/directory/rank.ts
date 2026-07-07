/**
 * Pure search-ranking helpers for the directory — shared by the client
 * island (instant filtering) and unit tests. No imports; safe on either
 * side of the RSC boundary.
 *
 * Scoring model (LinkedIn-ish relevance, sized for a few hundred rows):
 *   4  primary field starts with the query        ("mar" → "Maria Lopez")
 *   3  any word of the primary field starts with  ("lop" → "Maria Lopez")
 *   2  primary field contains the query           ("ari" → "Maria Lopez")
 *   1  any secondary field contains the query     (headline, expertise, …)
 *   0  no match — the row is filtered out
 */

export function normalize(s: string): string {
  return s.toLowerCase().trim();
}

export function matchScore(
  query: string,
  primary: string,
  secondary: (string | null | undefined)[] = []
): number {
  const q = normalize(query);
  if (!q) return 0;
  const p = normalize(primary);
  if (p.startsWith(q)) return 4;
  if (p.split(/\s+/).some((word) => word.startsWith(q))) return 3;
  if (p.includes(q)) return 2;
  for (const field of secondary) {
    if (field && normalize(field).includes(q)) return 1;
  }
  return 0;
}

/** Default status ordering for pods/projects: active first, forming next,
 *  everything retired (inactive + legacy closed) last. */
export function statusRank(status: string): number {
  if (status === "active") return 0;
  if (status === "forming") return 1;
  return 2;
}

/**
 * Rank a list for display. With a query: score desc (zero-score rows drop
 * out), ties broken by the list's existing order. Without a query: the
 * existing order is kept — callers pre-sort to their default order.
 */
export function rankByQuery<T>(
  items: T[],
  query: string,
  primaryOf: (item: T) => string,
  secondaryOf: (item: T) => (string | null | undefined)[]
): T[] {
  const q = normalize(query);
  if (!q) return items;
  return items
    .map((item, index) => ({
      item,
      index,
      score: matchScore(q, primaryOf(item), secondaryOf(item)),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}
