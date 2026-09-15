# PR #313 full-test runbook — cron path + admin sweep, in order

Written 2026-08-01. Supersedes the sequencing in `pr-311-312-313-test-plan-v2.md`
§3c for this session only; §3.0's hazards still apply. Branch under test:
`fix/enrollment-registered-status-rebased` (`3571694`, pushed). Fixture:
cycle **13** "ZZ TEST revocations" on dev, participants **146 ZZ Logger** /
**147 ZZ Slacker**.

**Why this order.** The admin sweep revokes on first sight, with no warning and
no email. If it runs first, the members are already `inactive` and the cron's
warn → grace → revoke path has nothing left to exercise. So: cron first, while
both members are warnable; reactivate; sweep second.

**The one rule that matters: while cycle 9 is parked, the cron is safe; the
moment cycle 9 is restored, the cron is live ammunition again. Never curl
`/api/cron/revocation-check` after the restore in step A8.** Its warning stage
emails real `participant.email` addresses through Resend with no env guard.

---

## P. Pre-flight (on your Mac)

- [ ] P1. `git fetch && git checkout fix/enrollment-registered-status-rebased`
      — confirm HEAD is `3571694`. `npm run dev`.
- [ ] P2. `.env.local` has `CRON_SECRET` (the cron 401s without it) and
      `RESEND_API_KEY` (warning emails come from localhost in this setup).
      Localhost shares the dev Supabase project (`cethihabtddiujzayaxe`), so
      everything below happens against dev data.
- [ ] P3. `00099` is **already applied to dev** (2026-07-31, as old `00092`).
      Do not re-run it. Nothing to apply.
- [ ] P4. Snapshot, if yesterday's wasn't taken — §0.4 of the v2 plan, schema
      name `archive_aug01` if `archive_jul31` doesn't exist.
- [ ] P5. Record the restore targets. Keep this output in a scratch note:

  ```sql
  SELECT id, name, status, mode, lab_id FROM cycles WHERE id = 9;
  SELECT c.id, c.mode, c.lab_id, p.id AS pod_id
    FROM cycles c JOIN pods p ON p.cycle_id = c.id
   WHERE c.name = 'ZZ TEST revocations';
  ```

- [ ] P6. Fixture sanity — both members `active`, `warned_at` null, one
      week-0 log from Logger:

  ```sql
  SELECT ce.participant_id, p.first_name, ce.status, ce.warned_at,
         ce.warning_reason,
         (SELECT count(*) FROM learning_logs l
           WHERE l.participant_id = ce.participant_id AND l.cycle_id = 13) AS logs
    FROM cycle_enrollments ce JOIN participants p ON p.id = ce.participant_id
   WHERE ce.cycle_id = 13 ORDER BY ce.participant_id;
  ```

Week map for cycle 13 (start 2026-07-04, 7-day weeks): w0 Jul 4–10 (Logger
logged Jul 5), w1 Jul 11–17, w2 Jul 18–24, w3 Jul 25–31, w4 Aug 1–7
(current, incomplete). As of today both members have missed w1–w3: 3
consecutive ≥ threshold 2, so both are flaggable.

---

## A. Cron path — warn → recover → grace → revoke → reactivate

- [ ] A1. **Park cycle 9 and confirm the cron sees nothing.** Do NOT flip the
      fixture yet — this run doubles as the `mode <> 'open'` skip test
      (plan step 13):

  ```sql
  UPDATE cycles SET status = 'closing' WHERE id = 9;
  ```

  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" \
    http://localhost:3000/api/cron/revocation-check
  ```

  Expect: zero cycles processed, no writes, no email. Record the response body.

- [ ] A2. **Flip the fixture to open** and confirm it is the ONLY cycle the
      cron can see (must return exactly one row, cycle 13):

  ```sql
  UPDATE cycles SET mode = 'open', lab_id = NULL
   WHERE name = 'ZZ TEST revocations';

  SELECT c.id, c.name, c.mode, c.status, cc.log_gate_paused, cc.log_due_at
    FROM cycles c JOIN cycle_config cc ON cc.cycle_id = c.id
   WHERE c.status = 'active' AND c.mode = 'open'
     AND COALESCE(cc.log_gate_paused, FALSE) = FALSE
     AND cc.log_due_at IS NOT NULL
     AND c.start_date IS NOT NULL AND c.end_date IS NOT NULL;
  ```

  **If that query returns anything other than exactly cycle 13, stop.**

- [ ] A3. **Run 1 — warning.** Same curl as A1. Expect: both members get
      `warned_at` stamped, `warning_reason='missed_logs'`, status still
      `active`, and TWO emails in your inbox (hq+zz-logger, hq+zz-slacker):
      "access pauses in 3 days". Verify with the P6 query. No
      `access_revocations` rows yet.

- [ ] A4. **Recovery.** Give Logger a log in the most recent completed week
      (w3), then run the cron again:

  ```sql
  INSERT INTO learning_logs
    (participant_id, cycle_id, kind, clarity, alignment, accomplished, created_at)
  VALUES (146, 13, 'weekly', 4, 4, 'recovery log, week 3',
          (CURRENT_DATE - INTERVAL '3 days')::timestamptz);
  ```

  Expect: Logger's `warned_at`/`warning_reason` cleared ("recovered"), status
  `active`. Slacker still warned, unchanged. No new email to Logger.

- [ ] A5. **Grace expiry → revoke.** Backdate Slacker's warning past the 3-day
      grace, run the cron a third time:

  ```sql
  UPDATE cycle_enrollments
     SET warned_at = warned_at - INTERVAL '4 days'
   WHERE participant_id = 147 AND cycle_id = 13;
  ```

  Expect for Slacker: `status='inactive'`, `inactive_date` set, one
  `access_revocations` row (`reason='missed_logs'`). Pod membership row
  intact by design. Logger untouched. Note in findings whether a revocation
  email is sent (the plan only specifies one at the warning stage).

  ```sql
  SELECT * FROM access_revocations WHERE cycle_id = 13;
  SELECT participant_id, status, inactive_date, warned_at
    FROM cycle_enrollments WHERE cycle_id = 13;
  ```

- [ ] A6. **Reactivation (plan step 12).** As your signed-in owner session on
      localhost (browser devtools console):

  ```js
  fetch('/api/revocations/reactivate/147', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({cycle_id: 13})
  }).then(r => r.json()).then(console.log)
  ```

  Expect: `pod_memberships.inactive_at` cleared, reconciler runs, and since
  ZZ TEST pod is `status='active'`, Slacker lands back at `active` (a
  non-active pod would leave him at `registered`). The `missed_logs`
  revocation row is NOT deleted — that's by design.

- [ ] A7. Optional 2-minute skip check: set the fixture's
      `log_gate_paused = TRUE`, curl the cron (expect: skipped, no writes),
      set it back to `FALSE`.

- [ ] A8. **RESTORE — do this now, not at the end of the session:**

  ```sql
  BEGIN;
  UPDATE cycles SET mode = 'org', lab_id = <lab_id from P5>
   WHERE name = 'ZZ TEST revocations';
  UPDATE cycles SET status = 'active' WHERE id = 9;
  COMMIT;
  ```

  Re-run the A2 visibility query: exactly one row, cycle **9**. From this
  point on, **do not curl the cron again**.

---

## B. Admin sweep — the no-grace path (plan step 14) + floor fix (§3a-bis)

State entering B: Slacker `active` (reactivated, still zero logs → 3+ misses),
Logger `active` with a w3 log (0 consecutive misses). That gives the sweep a
real positive AND a real negative case.

- [ ] B1. **Add a third member to prove the floor fix.** A recent joiner must
      accrue no misses for weeks before they joined:

  ```sql
  DO $$
  DECLARE v_late INT;
  BEGIN
    INSERT INTO participants (google_id, first_name, last_name, email)
    VALUES ('zz-test-latecomer', 'ZZ Latecomer', 'Test',
            'hq+zz-latecomer@theupskillinglabs.org')
    RETURNING id INTO v_late;
    INSERT INTO cycle_enrollments (participant_id, cycle_id, enrolled_at, status)
    VALUES (v_late, 13, (CURRENT_DATE - INTERVAL '2 days')::timestamp, 'active');
    INSERT INTO pod_memberships (participant_id, pod_id, joined_at)
    VALUES (v_late, <pod_id from P5>, (CURRENT_DATE - INTERVAL '2 days')::timestamp);
    RAISE NOTICE 'latecomer=%', v_late;
  END $$;
  ```

- [ ] B2. **Run the sweep, fixture cycle only** (signed-in owner session,
      devtools console):

  ```js
  fetch('/api/revocations/check/13', {method: 'POST'})
    .then(r => r.json()).then(console.log)
  ```

  Expect: **Slacker revoked immediately** — `inactive`, second
  `access_revocations` row, **no warning, no email** (check the inbox stays
  quiet). **Logger untouched** (recent log). **Latecomer untouched** — this is
  the floor fix working; before it, his weeks-before-joining counted as misses.

- [ ] B3. Confirm no other cycle was touched — the sweep is per-cycle, so:

  ```sql
  SELECT count(*) FROM access_revocations WHERE cycle_id <> 13;  -- unchanged vs P4 snapshot
  ```

---

## C. Surfaces (plan §3d, §3e) and state machine spot-checks

- [ ] C1. `/moderator/pods/<pod_id from P5>`: column reads **Learning Log**,
      sort "Log status (at-risk first)" puts Slacker first, filter label "Log".
      No pulse checks in the fixture, so cadence is log-derived
      (`synthesizeLogCadence`).
- [ ] C2. `/admin/cycles/13`: Active StatCard shows `N registered (pre-pod)`;
      filter reads **"Show only stuck-registered"** (= `registered` with an
      active pod); per-row **Run reconciler** appears only on stuck rows. To
      manufacture a stuck row: reactivate Slacker again (A6) — if he lands
      `registered` with a live pod membership, he's the test case; run the
      row's reconciler and watch him go `active`.
- [ ] C3. Display maps (known parked issue, do not fix now, just record):
      `registered` still painted with the grey "dropped out" chip in
      `admin/people/people-table.tsx`, `participant-sheet.tsx`,
      `admin/explore/cells.tsx`.
- [ ] C4. Plan §3b steps 4–7 (interest → `registered`, pod-add → `active`,
      profile badge, `inactive` losing the participant role) need a signable
      member; the ZZ fixtures can't sign in (`auth_user_id` null). Cover what
      you can with your own account + a throwaway custom cycle, or record as
      untested with a reason.

---

## D. Wrap-up

- [ ] D1. **Verify the restore held**: cycle 9 `active`/`open`; fixture
      `org` with its lab; A2 query returns only cycle 9;
      `log_gate_paused = FALSE` everywhere it was before (P5/P6 notes).
- [ ] D2. Findings → `docs/testing/pr-313-findings.md`, same format as
      `pr-312-findings.md`. Include: the cron response bodies (A1, A3–A5),
      whether revocation sends mail, and anything the floor got wrong.
- [ ] D3. Fixture: keep for the prod-merge re-test, or run the teardown at the
      bottom of `pr-313-throwaway-cycle.sql` (it does NOT remove Latecomer's
      participant row via name — the `hq+zz-%` email DELETE catches it).
- [ ] D4. Merge gate reminders: open the PR if not yet open; `00099` has
      **never been applied to prod** and its backfill is not idempotent — plan
      the manual prod apply at promotion time, per the usual workflow.
