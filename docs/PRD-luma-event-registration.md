# PRD — Luma event registration flows (add-events step + commitment links)

| | |
|---|---|
| Status | Draft |
| Author | Drafted by Claude from the July 11 testing session (owner-triaged) |
| Last updated | 2026-07-11 |
| Source feedback | [`testing-feedback-2026-07-11.md`](testing-feedback-2026-07-11.md) — "'Add events' at end of registration should pull in Luma events with one-click register" (Fix Soon); "Link each commitment in 'Your Commitments' to its event (Luma is still the required registration path)" (Fix Soon) |
| Related PRDs | [`PRD-events.md`](PRD-events.md) (Luma-question parity — decides what "one-click" is allowed to skip), [`PRD-cycle-registration.md`](PRD-cycle-registration.md) (the ceremony this step lands in) |

## 1. How the integration actually works (read before building)

- **Events are cron-synced, not fetched live.** `app/api/cron/sync-luma-events`
  pulls Luma into the `events` table; `EventRow` carries `api_id`,
  `luma_url`, `synced_at` (`lib/content/queries.ts:8-27`). `synced_at &&
  luma_url` ⇒ Luma-managed row.
- **In-app RSVP already exists.** `POST /api/events/[event_id]/rsvp`
  (member path): writes `event_rsvps` (dedup `UNIQUE(event_id, email)`)
  and best-effort forwards to Luma via `addLumaGuest(api_id, email, name)`
  (`lib/integrations/luma.ts`). Signed-in members never see Luma's own
  question form — a deliberate owner decision recorded in the route
  comments (`route.ts:16-33`).
- **The cycle's six anchor events are still a hardcoded interim constant**
  (`lib/cycles/anchor-events.ts`, explicitly "until the Luma events cache
  lands") with **no Luma URL field** — which is why the dashboard's
  commitments card can't link out today.

## 2. Problem

1. Cycle registration ends without connecting the member to the dated
   events they just committed to — they must find each event in Luma
   themselves, and many don't (hence the "Outside the App" nudge item).
2. "Your Commitments" (`app/(dashboard)/dashboard/cycle-commitments.tsx`)
   lists the six anchor events as plain text; there is nothing to click
   even though Luma registration is the required path.

## 3. Requirements

### 3.1 "Add events" step at the end of cycle registration

- **R1.** After the signature step succeeds, the ceremony confirmation
  (`ceremony.tsx` SignedScreen) gains an "Add the events" block listing the
  cycle's anchor events with date/venue, sourced from the `events` table
  (match `anchor = true`, upcoming, ordered by `start_at`) — falling back
  to `ANCHOR_EVENTS` while any row is missing.
- **R2.** Each row has one-tap **Register** using the existing member RSVP
  path (`POST /api/events/[event_id]/rsvp`), with per-row registered state
  (the route's dedup makes retries safe). A "Register for all" affordance
  is acceptable v1 sugar.
- **R3.** Rows for events the member already RSVP'd show "Registered ✓"
  (read `event_rsvps` by member email server-side).
- **R4.** The existing `.ics` download stays alongside — calendar ≠
  registration.

### 3.2 Commitments card links

- **R5.** Each "Your Commitments" row links to its event: prefer the in-app
  event page `/events/[slug]` (which carries the RSVP button and the Luma
  link); anchor rows resolve via the `events` table by `api_id`/`slug`.
- **R6.** Rows whose event has no DB row yet render unlinked (current
  behavior) — no dead links.
- **R7.** Retire-the-constant follow-through: once all six anchors resolve
  from the `events` table on both surfaces, `anchor-events.ts` shrinks to
  the `.ics` helper or retires per its own header note.

## 4. Acceptance criteria

- Completing cycle registration shows the anchor-event list; tapping
  Register creates the `event_rsvps` row and (Luma-managed events) the Luma
  guest; the row flips to Registered ✓ and stays ✓ on reload.
- Dashboard commitments rows navigate to the matching event page.
- No live Luma API call on page render (cron cache only).
- Lint/test/build green.

## 5. Open questions

1. **Question parity dependency:** one-click register inherits the
   "skips Luma's registration questions" data-integrity issue tracked in
   `PRD-events.md`. If that PRD decides members must answer Luma's
   questions, this step's CTA becomes "Open in Luma" for affected events
   instead of one-tap. Sequence the two decisions together.
2. Should the add-events step also offer non-anchor upcoming events from
   the cycle window, or anchors only (recommended: anchors only, v1)?
3. `events.anchor` is set by the sync/editorial path — confirm all six
   anchor rows exist in prod before R7 retires the constant.
