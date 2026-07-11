# PRD — Library: members-only with a public preview

| | |
|---|---|
| Status | Draft |
| Author | Drafted by Claude from the July 11 testing session (owner-triaged) |
| Last updated | 2026-07-11 |
| Source feedback | [`testing-feedback-2026-07-11.md`](testing-feedback-2026-07-11.md) — "Put Learning Library behind login (with preview navigable to non-logged-in visitors)" (Fix Soon); Feature Request: "Structured feedback channels for … Library" |
| Related code | `app/(public)/library/page.tsx` + `[slug]/page.tsx`, `proxy.ts:49-73` (`publicPaths` includes `/library`), `lib/content/queries.ts` (`getResources`), saved items (migration `00050_saved_items.sql`) |

## 1. Problem

The Learning Library is fully public: `/library` sits in `proxy.ts`'s
public-path allowlist and the pages render every published resource with no
session check. The owner wants member value gated behind login while still
letting visitors *see that the library exists and what's in it* — a preview
that recruits rather than a wall.

## 2. Requirements

- **R1.** Signed-out visitors keep `/library` (the directory) as a
  **preview**: resource titles, types, and blurbs render; resource
  *content* (the `[slug]` detail body, external links, downloads) requires
  sign-in. Detail pages show a teaser (title, blurb, type) plus a sign-in
  CTA in place of the body.
- **R2.** Signed-in members get today's full experience unchanged
  (including saved items).
- **R3.** Enforcement is server-side in the pages (session check via
  `publicSession()` like the other `(public)` pages) — do **not** simply
  move `/library` out of `proxy.ts`'s public list, or visitors get bounced
  to `/login` with no preview at all. The proxy entry stays; the page
  decides how much to render.
- **R4.** Optionally, a per-resource `public` flag lets editorial mark a
  handful of resources fully open (recruitment samples). Default false.
- **R5.** Library feedback channel: a per-resource "Was this useful?"
  (thumbs + optional text) for signed-in members, stored with
  `resource_id`, surfaced in the admin feedback view — same mechanism the
  Events PRD proposes (share the implementation).

## 3. Acceptance criteria

- Signed out: `/library` renders the browsable index; opening a resource
  shows teaser + sign-in CTA; no resource body/external URL is present in
  the HTML.
- Signed in: identical to today, plus the feedback affordance.
- A resource flagged `public` renders fully for visitors.
- SEO note verified: the index remains indexable; gated bodies are absent
  from markup (not merely hidden).

## 4. Open questions

1. Should search engines index teaser pages of gated resources (recommended:
   yes, teaser-only) — confirm with whoever owns SEO posture.
2. Do saved-items counts ("waiting" on resources) stay visible to visitors?
3. Is the `public` flag editorial-only, or should certain types (e.g.
   recordings of public events) default to public?
