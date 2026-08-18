# feat/luma-registrations test plan

Written 2026-08-18. Branch under test: `feat/luma-registrations` (`4f9a278`, pushed,
2 commits off `origin/dev` at `6b7af16`). Migration `00101` is **already applied to dev**;
nothing to apply there. Prod has **not** had it and must, before the promotion to main.

## What is under test

Two silent defects in the Luma guest mirror plus a freshness change:

1. `event_rsvps.participant_id` was only ever written by the in-app one-tap path, so every
   row the Luma mirror created was unattributable. `00101` backfills, and the mirror now
   resolves guest emails to participants going forward.
2. The mirror window was `start_at > now`, dropping an event the moment it *started*, so
   day-of registrations were never captured. Now future OR ended within 7 days.
3. Cron `0 */6 * * *` to `*/15 * * * *`, plus `guests_attributed` in the sync summary and a
   `LUMA_SYNC_LAG_NOTE` string that nothing renders yet.

## Why this order

The two behavioral fixes are the kind that fail silently rather than loudly: a wrong upsert
does not throw, it just quietly changes nothing, and a wrong window just mirrors fewer
events. So section C exists to make each one produce a visible before/after in the database,
and it runs before any UI checking. If C fails, the surfaces in D would all look plausible
and all be wrong.

---

## The hazards

**H1. There is no `LUMA_API_KEY` in any local env file** (`.env.local`,
`.env.development.local`, `.env.local.example` all lack it; only `.env.production.local` has
one). Without it `lumaEnabled()` is false, `syncLumaEvents` never runs, the cron route
returns `{skipped: true}`, and the admin sync button 501s with "LUMA_API_KEY is not
configured in this environment". **Nothing in section C is testable until this is resolved.**
See P3.

**H2. `addLumaGuest` writes to the real Luma calendar.** There is one Luma workspace, no
sandbox. An in-app RSVP made from localhost or dev forwards a real guest to a real event.
Use your own account for D4 rather than a fabricated email, and remove the guest from Luma
afterward if the event is one that matters.

**H3. The sync archives published future non-anchor events absent from the Luma listing.**
Low risk here (dev's events came from the July prod refresh against the same calendar, and
anchor rows are exempt), and `supabase/seed.sql` seeds no events at all, so there is nothing
dev-only to lose from seed. Still, record the event count at P5 so an unexpected archival is
visible rather than mysterious.

**H4. Vercel Cron fires against production deployments only.** The `*/15` schedule cannot be
observed on dev at all. It is verified by inspection now and by behavior after the promotion.
See section F.

---

## P. Pre-flight

- [ ] P1. On the branch, clean tree: `git checkout feat/luma-registrations`, confirm HEAD is
      `4f9a278`, `git status` clean.
- [ ] P2. `ls supabase/migrations | tail -2` shows `00100` and `00101`.
- [ ] P3. Resolve H1. Copy `LUMA_API_KEY` from `.env.production.local` into `.env.local`.
      Localhost shares the dev Supabase project (`cethihabtddiujzayaxe`), so this gives real
      Luma reads and dev writes, which is exactly the combination section C needs. Re-read H2
      before doing any RSVP.
- [ ] P4. `npm run dev`, sign in as an owner/admin account.
- [ ] P5. Baseline snapshot. Keep this output in a scratch note, sections B and C both
      compare against it:

  ```sql
  SELECT count(*) AS rsvp_rows,
         count(participant_id) AS attributed,
         count(DISTINCT participant_id) AS distinct_members
    FROM event_rsvps;

  SELECT count(*) AS published_events FROM events WHERE status = 'published';
  ```

---

## A. Static checks (no database, no Luma)

- [ ] A1. `npm test` passes. Expect 65 files / 606 tests, of which 13 are new in
      `lib/integrations/luma.test.ts`.
- [ ] A2. `npx tsc --noEmit` clean.
- [ ] A3. `npx eslint lib/integrations/luma.ts lib/integrations/luma.test.ts lib/events/copy.ts`
      clean.
- [ ] A4. `npm run check:migrations` reports 101 migrations, all prefixes unique.
- [ ] A5. Read `lib/events/copy.ts`. Confirm the string has no em dash and reads as intended:
      "Registered on Luma? It can take up to 15 minutes to show up here."
- [ ] A6. Read `vercel.json`. Confirm only the `sync-luma-events` schedule changed, and the
      other four crons are untouched.

## B. Data layer on dev (SQL only, no sync run)

- [ ] B1. The invariant. **Must be 0.** Already confirmed once; re-run after P1 in case
      anything moved.

  ```sql
  SELECT count(*) FROM event_rsvps r
    JOIN participants p ON lower(p.email) = lower(r.email)
   WHERE r.participant_id IS NULL;
  ```

- [ ] B2. No orphaned attributions: every `participant_id` points at a real participant.
      **Must be 0.**

  ```sql
  SELECT count(*) FROM event_rsvps r
    LEFT JOIN participants p ON p.id = r.participant_id
   WHERE r.participant_id IS NOT NULL AND p.id IS NULL;
  ```

- [ ] B3. Sanity on the shape of what was backfilled. Attributed rows should be spread over
      many members, not concentrated on one.

  ```sql
  SELECT participant_id, count(*) FROM event_rsvps
   WHERE participant_id IS NOT NULL
   GROUP BY 1 ORDER BY 2 DESC LIMIT 10;
  ```

## C. The two fixes, made visible

This is the section that matters. Each step forces the fix to produce an observable change.

### C1. The upsert actually updates existing rows

The old `ignoreDuplicates: true` would make the whole attribution fix a no-op on rows that
already exist, which is nearly all of them. This proves it does not.

- [ ] C1a. Pick a target: an attributed RSVP on an event that is still upcoming, so the
      mirror will visit it.

  ```sql
  SELECT r.id, r.event_id, r.email, r.participant_id, e.name, e.start_at
    FROM event_rsvps r JOIN events e ON e.id = r.event_id
   WHERE r.participant_id IS NOT NULL
     AND e.api_id IS NOT NULL
     AND e.start_at > now()
   LIMIT 5;
  ```

- [ ] C1b. Break it deliberately. Note the id first.

  ```sql
  UPDATE event_rsvps SET participant_id = NULL WHERE id = <target id>;
  ```

- [ ] C1c. Trigger a sync: the admin sync button on `/admin/content`, or
      `POST /api/admin/events/sync`.
- [ ] C1d. **The row is attributed again.** If `participant_id` is still NULL, the upsert is
      wrong and everything downstream of it is decorative.

  ```sql
  SELECT id, email, participant_id FROM event_rsvps WHERE id = <target id>;
  ```

### C2. Nothing gets clobbered or duplicated

The two-writes split exists because a bulk PostgREST upsert applies the union of keys across
rows, which would null `participant_id` on rows that already had one.

- [ ] C2a. Re-run P5's first query. Compared to the baseline: `attributed` is equal or
      higher, never lower. `rsvp_rows` is equal or higher, never lower.
- [ ] C2b. No duplicate rows crept in past the unique constraint. **Must be 0.**

  ```sql
  SELECT event_id, lower(email), count(*) FROM event_rsvps
   GROUP BY 1, 2 HAVING count(*) > 1;
  ```

- [ ] C2c. Run the sync a second time and repeat C2a. Two consecutive runs should leave the
      numbers identical, since the mirror is meant to be idempotent.

### C3. The window fix

- [ ] C3a. Is there anything to observe? This lists events the OLD code would have skipped
      and the new code mirrors:

  ```sql
  SELECT id, name, start_at, end_at FROM events
   WHERE api_id IS NOT NULL
     AND start_at <= now()
     AND coalesce(end_at, start_at) > now() - interval '7 days';
  ```

- [ ] C3b. If C3a returns rows: note their `event_id`s, run a sync, and confirm
      `event_rsvps` now has rows for at least one of them, or that its existing rows were
      refreshed. If C3a returns nothing, the calendar has no recently-ended event and this
      fix rides on A1's unit tests (`inGuestMirrorWindow` has cases for currently-running,
      inside-grace, past-grace, and missing `end_at`). Say so in the PR rather than ticking
      the box.
- [ ] C3c. Check the sync summary from C1c: `guests_mirrored` should be at least as high as
      before, and `errors` should not contain new `guests <api_id>` lines.

## D. Surfaces

- [ ] D1. Poderator pod workshops. `/moderator/pods/<id>/workshops` and the "Next workshops"
      digest on the Overview. Counts should be **visibly higher** than they were, because
      `getPodWorkshops` reads `.in("participant_id", memberIds)`. Cross-check one pod against
      SQL:

  ```sql
  SELECT e.name, count(*) FROM event_rsvps r
    JOIN events e ON e.id = r.event_id
    JOIN pod_memberships pm ON pm.participant_id = r.participant_id
   WHERE pm.pod_id = <pod id> AND e.status = 'published' AND e.start_at >= current_date
   GROUP BY 1 ORDER BY 1;
  ```

- [ ] D2. Admin sync button on `/admin/content` shows `guests_attributed` in its summary
      alongside `guests_mirrored`, and the number is plausible (lower than
      `guests_mirrored`, greater than zero).
- [ ] D3. `/events` and `/learning` render unchanged. Event cards, filters, the
      All/Workshops/Anchor segments, visibility (private Luma events on `/learning` only).
- [ ] D4. Event detail one-tap, per H2 use your own account. On a Luma-managed upcoming
      event: click Register, the CTA flips to "You're going ✓", and the row lands attributed:

  ```sql
  SELECT participant_id, email, ip_hash FROM event_rsvps
   WHERE event_id = <event id> AND lower(email) = '<your email>';
  ```

  `participant_id` set, `ip_hash` NULL. Then run a sync and confirm it is **still** set:
  that is the null-clobber check on a row the mirror will definitely revisit.

## E. Regressions

- [ ] E1. Anonymous email RSVP on an editorial (non-Luma) event still works and still
      rate-limits. Row has `participant_id` NULL and `ip_hash` set.
- [ ] E2. Nothing in the four other crons changed: spot-check one, e.g.
      `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/learning-log-window`.
      Do **not** curl `revocation-check`, it emails real members.
- [ ] E3. `git diff origin/dev..HEAD --stat` still shows exactly 5 files. Nothing crept in.

## F. Deferred to production

Not testable before the promotion. Record these as follow-ups on the PR rather than
pretending they were checked.

- [ ] F1. Prod apply of `00101`. Exact expected values, measured on prod 2026-08-18:
      resolved **456**, unresolved **412**, distinct members **102**, and the B1 invariant
      going **358 to 0**. Anything else means the migration and the verification query
      disagree.
- [ ] F2. Prod's poderator workshop counts will jump the moment F1 runs, before any deploy.
      Correct, but surprising. Warn whoever reads them.
- [ ] F3. The `*/15` cron only starts applying on production. After the promotion, confirm
      in the Vercel cron dashboard that `sync-luma-events` is firing every 15 minutes and
      that duration stays well under 15 minutes, since overlapping ticks would race the
      archival reconciliation.
- [ ] F4. `LUMA_SYNC_LAG_NOTE` is unrendered. It lands with the My Workshops surface later in
      this arc. Not a gap in this PR, but do not let it be forgotten.

## G. Wrap-up

- [ ] G1. Undo P3 if you would rather not keep a production Luma key in `.env.local`.
- [ ] G2. Confirm C1b's deliberate breakage was healed by C1d, and no other row was left
      modified by hand.
- [ ] G3. Findings onto the PR, including anything skipped and why (C3b especially).
- [ ] G4. Merge to dev with a squash. The dev to main promotion later uses a **merge commit,
      never a squash**.
