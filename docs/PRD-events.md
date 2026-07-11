# PRD — Events: Luma question parity, gallery honesty, feedback channel

| | |
|---|---|
| Status | Draft |
| Author | Drafted by Claude from the July 11 testing session (owner-triaged) |
| Last updated | 2026-07-11 |
| Source feedback | [`testing-feedback-2026-07-11.md`](testing-feedback-2026-07-11.md) — "App registration for events skips the Luma registration questions" (Fix Now, **Data integrity**); "Clarify what the scroll of photos is pulling from" (Fix Soon); Feature Request: "Structured feedback channels for Events" |
| Related code | `app/api/events/[event_id]/rsvp/route.ts` (the documented skip decision, lines 16-33), `app/(public)/events/[slug]/rsvp.tsx`, `lib/integrations/luma.ts` (`addLumaGuest`; sync never writes `gallery`), `app/(public)/events/[slug]/gallery.tsx`, `app/components/feedback/feedback-widget.tsx` |
| Shipped separately | Skeleton/scroll, pill stability, search size, square gallery — PR #230 |

## 1. Problem

1. **Data integrity: in-app RSVPs skip Luma's questions.** The member
   one-tap path forwards only email + name to Luma (`addLumaGuest`). The
   route documents this as an owner decision ("registration parity" — the
   Participant Agreement covers the photo clause), but the July feedback
   flags the *data* consequence: Luma-side registrations carry answers
   (dietary, accessibility, referral, etc.) that in-app registrants never
   provide, so hosts work from incomplete rosters and the two populations
   aren't comparable.
2. **The photo carousel misleads.** For a typical Luma-imported event,
   `img`/`gallery` are null (sync never writes `gallery` — editorial-only
   column), so the detail gallery shows three gradient placeholder slides
   that testers read as broken photo loading.
3. **No structured way to give feedback on an event.** The global widget
   exists, but nothing ties feedback to a specific event.

## 2. Requirements

### 2.1 Question parity (decide, then implement)

- **R1.** Product decision recorded here when made — two viable postures:
  - **(a) Mirror the questions in-app**: the cron sync also pulls each
    event's Luma registration questions; the in-app RSVP renders them and
    forwards answers with the guest add. Full parity, most work; verify the
    Luma API supports submitting answers via guest-add before committing.
  - **(b) Scope the skip**: keep one-tap only for events with no required
    Luma questions; events *with* required questions send members to
    `luma_url` like signed-out visitors. Cheap, honest, loses one-tap on
    exactly the events that need answers.
  Recommendation: **(b)** now, (a) if hosts still hurt. Either way the
  route's "owner decision" comment is updated to point here.
- **R2.** Whichever posture: the RSVP confirmation states what the host
  will/won't know, so members aren't surprised at the door.

### 2.2 Gallery honesty

- **R3.** Events with no real imagery render **one** branded slide, not a
  three-slide carousel of placeholders pretending to be photos (no dots,
  no scroll affordance).
- **R4.** Document (`lib/integrations/luma.ts` header already starts this)
  that `img`/`gallery` are editorial: the admin/editorial path is how real
  photos attach. If Luma cover images are wanted, extend the sync to map
  Luma's cover → `img` (explicitly out of editorial's way: only set when
  null).

### 2.3 Event feedback channel

- **R5.** Post-event, attendees (RSVP row + event ended) get a lightweight
  per-event feedback form (rating + free text), stored with `event_id` and
  surfaced to admins alongside the existing feedback admin
  (`app/(dashboard)/admin/feedback/`). Reuse the `feedback` table
  (migration `00029`) with an `event_id` column if that stays simplest.

## 3. Acceptance criteria

- (Posture b) An event with required Luma questions shows no one-tap
  member RSVP; the CTA opens Luma. Events without required questions keep
  one-tap. Rosters in Luma stop containing answer-less in-app rows for
  question-bearing events.
- A Luma-imported event with no photos shows a single branded frame; no
  dots, no phantom swipes.
- An attendee can rate an ended event they attended; admins see it grouped
  by event.

## 4. Open questions

1. Does Luma's guest-add API accept registration answers at all? (Gates
   posture (a) permanently.)
2. Are RSVP-question requirements queryable from Luma's API for the sync
   (needed for (b)'s "has required questions" flag)?
3. Feedback channel cadence: prompt via email (existing Resend infra) vs
   dashboard-only nudge.
