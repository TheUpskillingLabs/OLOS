/**
 * Query sanitization for the global search — pure, no imports.
 *
 * PostgREST's .or() parses commas/parens as syntax, and %/_ are ilike
 * wildcards — strip them all so user input can't break or widen the match.
 * (Moved verbatim from the old /api/directory/suggest route.)
 */

export const MIN_QUERY_LENGTH = 2;

export function sanitizeQuery(raw: string): string {
  return raw
    .trim()
    .replace(/[,()%\\_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
