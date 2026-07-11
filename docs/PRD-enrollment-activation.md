# PRD — Enrollment activation: active by default, pulse-driven demotion

| | |
|---|---|
| Status | Draft — deliberately **not** built in the July 11 fix batch (owner call: too risky to rush) |
| Author | Drafted by Claude from the July 11 testing session (owner decision recorded) |
| Last updated | 2026-07-11 |
| Source feedback | [`testing-feedback-2026-07-11.md`](testing-feedback-2026-07-11.md) — "Fix 'active' definition — participants should be active by default until proven inactive; currently nobody reads as active even when the first Learning Log isn't due yet" (Fix Now, Bug) |
| Related code | `lib/enrollment/reconciler.ts` (+ `reconciler.test.ts`), `app/api/cycles/[cycle_id]/agreement/route.ts:126-135`, `app/api/pods/[pod_id]/register/route.ts`, `lib/enrollment/revocation.ts`, #110 Phase C revocation cron (migration `00030_revocation_warnings_and_idempotency.sql`), admin stuck-inactive tooling (`app/(dashboard)/admin/cycles/[cycle_id]/participants-table.tsx`) |
| Prior intent being reversed | [`dev-report-cycle-process.md`](dev-report-cycle-process.md) Finding #2 — "every self-service join path writes 'inactive' by design; the reconciler only activates on active pod membership" |

## 1. Problem

`cycle_enrollments.status` today means "is this member in a pod that has
itself gone active" — pods only flip active at `pod_min` members, weeks
into the cycle. Until then **every** registrant reads `inactive`, the admin
table brands them "stuck", and status-gated features mis-fire. During July
testing a 3-person cohort could never read active at all (`pod_min`
defaulted to 5). The tester expectation, ratified by the owner:
**a registered participant is active until they stop showing up.**

## 2. Decision (owner, July 11)

> Active until first pulse check should be on by default. Then flip to
> inactive if not filling out pulse checks.

Enrollment starts `active` at registration. The only demotion path is
sustained non-engagement (missed pulse checks / Learning Logs via the
existing two-stage revocation machinery) or explicit admin revocation.
Pod membership stops driving enrollment status entirely.

## 3. Requirements

- **R1.** `POST /api/cycles/[cycle_id]/agreement` seeds
  `cycle_enrollments.status = 'active'` (route currently writes
  `'inactive'` and documents that it never activates — both the code and
  its comment block change).
- **R2.** `reconcileEnrollmentActivation` drops the `hasActivePod` target
  computation. New semantics: an enrollment is `active` unless (a) an
  unexpired `access_revocations` row exists, or (b) an admin set it
  inactive. Pod join/leave routes keep calling the reconciler harmlessly or
  drop the calls — decide during implementation; either way joining/leaving
  a pod must not flip enrollment status.
- **R3.** The #110 Phase C two-stage cron (warn → revoke on missed
  check-ins) becomes the sole automatic demotion path. **Pre-work:** read
  the cron end-to-end and confirm it evaluates engagement independently of
  the reconciler's pod logic; adjust if it delegates.
- **R4. Consumer sweep** — every `cycle_enrollments.status` reader must be
  checked under the new rule: dashboard state machine
  (`dashboard/page.tsx:318,356`), learning-log eligibility
  (`lib/learning-logs/eligible.ts`, `gate.ts`), voting/proposal gates
  (`isEnrolledParticipant` / `isActiveParticipant` in `lib/auth/roles.ts`),
  moderator roster inactive filter, admin participants/people tables,
  directory data. The vote route's comment ("'active' would deadlock here")
  stops being true — simplify that gate if it falls out naturally.
- **R5. Backfill migration:** currently-`inactive`, never-revoked
  enrollments in live cycles (exactly the admin table's "stuck" cohort) are
  set `active`. Idempotent; DOWN documented as not-restorable.
- **R6.** Update `lib/enrollment/reconciler.test.ts` to the new semantics;
  add cases: fresh registration is active; pod leave doesn't demote;
  revocation demotes; reconciler never resurrects a revoked enrollment.
- **R7.** Update `dev-report-cycle-process.md` Finding #2 and the admin
  "stuck-inactive" copy — under the new rule a stuck row indicates a real
  anomaly, not the pre-pod default.

## 4. Acceptance criteria

- A member who signs the cycle agreement immediately reads **active** in
  the admin table, the directory, and the dashboard state machine — before
  joining any pod.
- Joining/leaving pods changes pod membership only; enrollment status is
  untouched.
- The revocation cron still warns then demotes non-engaging members, and
  `access_revocations` rows still gate voting/submission.
- The July test cohort (3 participants) reads active end-to-end with no
  admin intervention.
- Reconciler tests green under the new semantics; full lint/test/build.

## 5. Risks / why this wasn't rushed

- The old behavior is **documented intent** with real invariants hanging
  off it (resource provisioning at pod activation, revocation audit
  expectations). A hasty flip risks activating members the cron then
  immediately re-demotes, or double-writing revocations.
- `isActiveParticipant` gates several submission windows; flipping defaults
  without the R4 sweep could silently widen access.

## 6. Open questions

1. Does "not filling out pulse checks" mean the Learning Log (the pulse
   check's successor per the cycles page copy) — i.e., should the cron key
   on `learning_logs` now rather than `pulse_checks`?
2. Should pod-less-but-active members appear in Poderator rosters anywhere,
   or only in admin views?
3. Grace period: how many missed check-ins before warn, and warn→revoke gap?
   (Cycle-configurable — `at_risk_consecutive_misses` exists on
   `cycle_config`; confirm reuse.)
