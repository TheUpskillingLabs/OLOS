/* URL-safe member handles for the community directory (/u/[handle]).
   Mirrors the DB slugify_handle() in migration 00044 — keep the two in sync.
   Generation is DB-side (a BEFORE INSERT trigger); these helpers are for the
   profile-edit form's format validation + hint. */

export const HANDLE_RE = /^[a-z0-9][a-z0-9-]*$/;
export const HANDLE_MAX = 50;

/** Turn arbitrary text into a url-safe slug: lowercase, [a-z0-9-] only, no
    leading/trailing/double dashes, capped at 40 chars. Empty → "member". */
export function slugifyHandle(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return s || "member";
}

/** A handle a member may set: [a-z0-9], dashes allowed but not leading, 1–50. */
export function isValidHandle(h: string): boolean {
  return h.length >= 1 && h.length <= HANDLE_MAX && HANDLE_RE.test(h);
}
