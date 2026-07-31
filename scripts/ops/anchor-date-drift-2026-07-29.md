# Anchor event dates: public `events` table disagrees with `anchor-events.ts`

Found 2026-07-29 while scoping the events-page filter work. Paste this into a GitHub issue.

## Summary

Four of the six anchor events show a different date on the public site than in the dashboard,
the Open Cycle Agreement, and the `.ics` download. The public dates are the stale prototype
dates seeded in `00034_seed_public_content.sql`, which never received the calendar correction
that `lib/cycles/anchor-events.ts` and `00086_cycle_phases_events.sql` got.

Meet the Pods is off by one week. The Hackathon is off by nearly a month. Both are in-person,
venue-bound events people are being asked to commit to attending, so this is a
"members show up on the wrong day" bug, not a cosmetic one.

## The drift

| slug | `anchor-events.ts` + `cycle_events` (correct) | `events` table via 00034 (stale) | delta |
| --- | --- | --- | --- |
| `kickoff-summit` | 2026-07-14 18:00 | 2026-07-14 18:00 | ok |
| `problem-sprint` | 2026-07-25 09:00 to 13:00 | 2026-07-28 18:00 to 20:30 | +3 days, wrong time of day |
| `meet-the-pods` | 2026-08-11 18:00 | 2026-08-18 18:00 | +7 days |
| `hackathon-frame-sprint` | 2026-08-13 09:00 | 2026-09-08 09:00 | +26 days |
| `meet-the-projects` | 2026-09-08 18:00 | 2026-09-15 18:00 | +7 days |
| `showcase-summit` | 2026-10-13 18:00 | 2026-10-13 18:00 | ok |

Source of truth per `docs/requirements/cycle-timeline.md` is the Cycle 3 calendar table, which
`anchor-events.ts` was corrected against. `00086` seeds `cycle_events` from the same corrected
values. Only `events` is stale, and no later migration touches it (`grep` for `meet-the-pods`
returns 00034 and 00086 only).

## Who reads which source

- Public `/events`, `/events/[slug]`, `/build-cycles` read `events` (stale).
- Dashboard key-dates card, `cycle-commitments.tsx`, the agreement ceremony, and `cycleICS()`
  read `ANCHOR_EVENTS` (correct).
- `cycle_events` (correct) has no reader in app code yet.

## Why it will not self-heal

The 00034 rows carry `api_id` values `anchor-01` through `anchor-06`, which never match a Luma
`api_id`, so `syncLumaEvents()` treats them as local-only and never refreshes `start_at`. They
stay stale until someone writes the dates.

## Suggested fix

1. A migration that updates `start_at` / `end_at` for the four drifted slugs to the
   `anchor-events.ts` values. Idempotent, slug-keyed, no other columns touched.
2. Decide whether the anchors should be Luma-backed. If yes, set their `api_id` to the real
   Luma ids so the sync owns dates from then on, and `anchor-events.ts` can start retiring as
   `docs/requirements/cycle-timeline.md` plans. If no, add a test or check that asserts
   `events` anchor dates equal `ANCHOR_EVENTS`, because this will drift again.
3. While in there: anchor `kind` values are `Summit` and `Cycle event`, which do not match the
   meetup / workshop / hackathon taxonomy the events-page filters need. The Frame Sprint is a
   hackathon. Worth folding into the `kind` constraint work rather than doing twice.

## Verify first

Run `anchor-date-drift-2026-07-29.sql` in Supabase Studio against dev
(`cethihabtddiujzayaxe`) and prod (`cdbgkgkjnomjnpicaxqe`). The 00034 seed is what the
migration would produce, but prod has been repaired by hand more than once, so confirm the
live values before writing a fix.
