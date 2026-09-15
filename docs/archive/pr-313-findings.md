# PR #313 (registered status + revocations) — findings log

Testing the rebased branch `fix/enrollment-registered-status-rebased`
(`3571694`) on localhost against the dev DB, 2026-08-01 evening (timestamps in
the log are UTC 2026-08-02). Runbook: `pr-313-full-test-runbook.md`. Fixture:
cycle 13 "ZZ TEST revocations" (pod 11; 146 Logger / 147 Slacker / 148
Latecomer, added mid-test). Fixes made during the session are uncommitted in
the working tree at time of writing; batch into one commit on the branch.

## Fixed during testing

### F1 — cron was a complete no-op: ambiguous `user_roles` embed (PGRST201)

The cron's enrollments select embedded
`participants(…, user_roles(role, revoked_at))`. `user_roles` has TWO FKs to
`participants` (`participant_id` and `granted_by`), so PostgREST rejects the
embed with PGRST201 — and the route never read `error`, so `enrollments` was
null, the loop iterated nothing, and every run of
`GET /api/cron/revocation-check` returned all-zeros while looking healthy.
**The cron path had never actually executed before this session.**

Fix (in `app/api/cron/revocation-check/route.ts`): disambiguate to
`user_roles!user_roles_participant_id_fkey(role, revoked_at)` and log + skip
the cycle when the query errors. Verified: the same curl went from all-zeros
to `warned_count: 2` immediately after.

### F2 — same unchecked-error pattern in the admin sweep (hardening only)

`POST /api/revocations/check/[cycle_id]` checks no query errors either. It has
no ambiguous embed, so it worked, but a failing read yields "nobody revocable"
with a 200. Added error capture + `console.error` on the cycle and enrollments
selects. The remaining unchecked reads (firstLog, podJoins, per-member logs)
degrade the same silent way — worth a follow-up pass, not blocking.

## Verified working (the whole §3c ladder, plus floors)

- Cron skip conditions: parked/`mode<>'open'` cycles invisible (A1, all-zeros
  with cycle 9 parked and fixture still org); `log_gate_paused=TRUE` skips
  (A7); `log_due_at` null skips (see O1).
- Warn: both fixture members warned in one run, `warning_reason='missed_logs'`,
  two Resend emails delivered to the plus-aliases. No revocation on first run.
- Recover: a week-3 log for Logger cleared `warned_at`/`warning_reason`
  ("recovered") on the next run; Slacker untouched, not re-warned inside grace.
- Revoke: backdating `warned_at` past 3 days flipped Slacker to
  `status='inactive'`, `inactive_date` set, `access_revocations` row
  (`missed_logs`). Pod membership row left intact as designed. **No email on
  revocation — the warning is the only mail.**
- Reactivate: `POST /api/revocations/reactivate/147` restored him to `active`
  (pod is active); writes a `reason='reactivated'` audit row (see O2).
- Admin sweep: revoked Slacker immediately, no warning, no email; left Logger
  (recent log, 0 misses) and Latecomer alone.
- **The floor fix does its job**: Latecomer (joined 2 days ago, week 3)
  computed `missed=1` — his joining week counts, prior weeks don't — under the
  threshold, untouched. Before the fix he'd have been revoked on sight.
- Moderator pod page (§3d): Learning Log column, at-risk sort, "Log" filter,
  log-derived health, revoked member greyed with `inactive` chip.
- Admin cycle page (§3e): "33 registered (pre-pod)" StatCard on cycle 9 (also
  explains the "Enrolled 34 / Active 1" confusion parked during #342 testing);
  "Show only stuck-registered (0)" filter; reconciler buttons only on stuck
  rows (none exist on cycle 9, correctly). Org-mode cycle pages render the
  Core-contributors variant without that filter; Slacker's `registered` chip
  renders properly there.

## Observations / ship decisions

### O1 — the dev email hazard was latent, not live (but the discipline stands)

Cycle 9's `log_due_at` is currently **null** (the Friday learning-log-window
cron is what arms it), so the revocation cron would have skipped it even
unparked. Do not relax the parking runbook: any Friday arming makes the hazard
live again.

### O2 — RESOLVED (owner, 2026-08-01): re-revocations now write a fresh row

As found: sweep-revoking a previously-revoked-then-reactivated member hit the
`access_revocations` unique index (00030); the 23505 was swallowed, so the
trail read revoke(01:19) → reactivate(01:23) with no row for the second
revocation — the newest audit row said "reactivated" while the enrollment was
inactive. Owner chose fresh-row semantics. Implemented as **migration 00100**
(drops the unique index, adds a plain lookup index; idempotency is state-driven
via the active→inactive transition) + both routes stop special-casing 23505.
Applied to dev and re-tested: the re-revocation wrote a third row (02:00),
trail now matches reality. **00100 joins 00099 in the manual prod-apply at
promotion.**

### O3 — RESOLVED (owner, 2026-08-01): confirmation dialog strengthened

The button already had a `confirm()`, but its copy ("may revoke access for
inactive participants") didn't say the sweep is immediate with no warning
email and no grace. Copy now states exactly that and contrasts it with the
scheduled check. Verified rendering on cycle 9 (cancelled, no action taken).
Also added the missing `missed_logs` (and `missed_pulses`) entries to
`REASON_LABELS` so revocation reasons render as labels, not raw enum values.

### O4 — cron's warn→grace ladder is per-run-order dependent, fine as designed

Nothing new: grace expiry only revokes on the NEXT run after 3 days. With the
cron absent from `vercel.json`, nothing fires in prod until it is scheduled —
schedule + the O3 decision belong together at merge time.

## Known issues confirmed, still parked

- Moderator display path (`lib/moderator/pod-detail.ts`) uses the UNFLOORED
  count: Latecomer shows red **AT RISK** on the pod roster while the
  enforcement paths correctly compute 1 miss. Moderators will see mid-cycle
  joiners flagged. Port the floor there as a fast-follow.
- `/admin/people` cycle chips still paint `registered` members with the muted
  grey "dropped out" styling (also `participant-sheet.tsx`,
  `admin/explore/cells.tsx`).

## Not tested, with reasons

- §3b state machine via real UI (interest → registered, pod-add → active,
  profile badges, role loss on `inactive`): fixture members can't sign in
  (`auth_user_id` null). The reconciler transitions themselves were exercised
  via reactivation. Needs a signable throwaway member if we want it before
  merge.
- Prod behaviour of `00099`: never applied there; backfill is not idempotent.
  Manual apply at promotion time, snapshot first.

## End-state of the fixture (for the next session)

146 active (logs in w0+w3), 147 **inactive** (re-revoked 02:00 during the O2
re-test; three audit rows: missed_logs → reactivated → missed_logs), 148
active (no logs). Cycle 13 back to `org`/lab 1, gate unpaused. Cycle 9
restored `active`/`open`. Dev DB has 00099 AND 00100 applied. Snapshot:
`archive_aug01`. Teardown SQL (bottom of `pr-313-throwaway-cycle.sql`) NOT
run — keeping the fixture for the prod-merge re-test.
