# PRD — Profile: consolidation, privacy toggle, durable photos & consent

| | |
|---|---|
| Status | Draft |
| Author | Drafted by Claude from the July 11 testing session (owner-triaged) |
| Last updated | 2026-07-11 |
| Source feedback | [`testing-feedback-2026-07-11.md`](testing-feedback-2026-07-11.md) — Profile (Fix Soon): consolidate View and Edit Profile; Feature Requests: public vs private toggle on the profile view; durable photo storage and contact consent capture |
| Related code | `app/(dashboard)/profile/page.tsx` + `member-profile-view.tsx` (view), `app/(dashboard)/profile/edit/*` (edit), `app/(dashboard)/u/[handle]/page.tsx` (visitor), avatar upload `app/api/participants/[id]/avatar` + migration `00046_avatars_bucket.sql`, consent capture `contact_consent` in the signup funnel + `00057_email_log_and_consent.sql` |
| Shipped separately | Saved-banner placement, back-to-dashboard link, follow slot in card, availability/name prefill — PRs #227/#229 |

## 1. Problem

1. **View and Edit are two parallel surfaces.** `/profile` renders a
   read-only card; `/profile/edit` re-renders every field as a long form.
   Testers bounced between them and lost their place; the two also drift
   (fields exist in one but not the other).
2. **Members can't control visibility.** The visitor view's safety comes
   from a hardcoded column allowlist (`u/[handle]/page.tsx`
   `DISPLAY_COLUMNS`) — the *member* has no say in what shows. Testers
   asked for a public/private toggle.
3. **Photos and consent are shakier than they look.** Avatars fall back to
   the Google OAuth `picture` URL when no upload exists — those URLs
   expire/rot. Contact consent is captured once at signup
   (`contact_consent`) with no way to view or change it later, and no
   consent notion for photo/directory visibility.

## 2. Requirements

### 2.1 Consolidate View/Edit

- **R1.** One owner surface: `/profile` becomes view-with-inline-edit —
  section-scoped edit affordances (edit-in-place per card section, saving
  via the existing `participants-update` validation) instead of the
  separate mega-form. `/profile/edit` survives only as the forced
  Mode B (placeholder-name completion) flow, which needs the single-form
  gate.
- **R2.** The section inventory is the union of today's view + edit fields;
  anything editable is visible and vice versa (except owner-only PII, which
  stays owner-only).

### 2.2 Visibility toggle

- **R3.** Per-member visibility choice on the profile: at minimum a
  two-state toggle — *Members directory* (today's behavior) vs *Hidden*
  (excluded from directory search, PYMK, and `/u/[handle]` resolves 404 for
  non-admins). Per-section visibility is a later iteration; don't build the
  four-tier system here (that's the Directory PRD's poderator-tiering).
- **R4.** Enforcement is server-side (query filters + the `u/[handle]`
  resolver), not presentational.

### 2.3 Durable photo storage + consent

- **R5.** On OAuth sign-in (or first dashboard load), if
  `profile_image_url` is empty and the Google picture URL is present, copy
  the image bytes into the existing avatars bucket and store that URL —
  never persist the ephemeral Google URL as the long-term avatar.
- **R6.** Consent capture becomes visible and editable: a Profile →
  Privacy section showing contact consent (email updates) and adding photo
  consent (event photography — the Participant Agreement's "tell the host"
  clause becomes a stored preference hosts can see on the RSVP list).
  Writes are audited (`email_log_and_consent` precedent).

## 3. Acceptance criteria

- A member edits any profile field without leaving `/profile`; the forced
  name-completion flow still works.
- A member set to Hidden appears in no directory surface and their handle
  URL 404s for peers; flipping back restores visibility immediately.
- Deleting the Google account's photo (or its URL rotting) no longer blanks
  an OLOS avatar that was captured under R5.
- Consent states render in the profile and are changeable; photo consent is
  visible to event hosts on the RSVP/attendee view.

## 4. Open questions

1. Inline-edit implementation: per-section server actions vs the existing
   single PATCH route — decide with the frontend owner.
2. Does Hidden also hide the member from Poderator rosters? (Recommended:
   no — pod operations need the roster; hidden = directory/social surfaces.)
3. Photo consent default for existing members: unset-until-asked vs
   defaulting from the signed agreement's photography clause.
