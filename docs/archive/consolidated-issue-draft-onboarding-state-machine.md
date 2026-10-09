## Milestone
v1.0 (May 2026 launch cycle)

## Labels
`area/backend`, `area/frontend`, `area/database`, `priority/p0`, `size/l`, `type/architecture`

## Estimate
2-3 days

## Goal
Consolidate the fragmented participant onboarding/enrollment lifecycle into a single, idempotent state machine with one centralized "enrollment activation reconciler," explicit reactivation paths for every soft-deletable row, admin/moderator self-service UI for the fixes currently requiring raw SQL, server-side guards against placeholder-name participants, and a redesigned revocation cron with grace periods and warning states. This eliminates the cascade that took down ~75% of the Energy cohort and the placeholder-name gap that stranded Aaron McKeever (#61) and two other prod participants.

## Context
See the architecture review (`docs/architecture-review-onboarding-state-machine.md`) for the full current-state assessment, broken-edges table, state-machine and flow diagrams, and proposed unified design.

Root causes (from the six subsystem maps):
1. `cycle_enrollments.status` flips `inactive -> active` from ONLY one code path in the normal flow: `app/api/pods/[pod_id]/register/route.ts:133-150`. Pods activated by any other path (admin SQL, migration script `scripts/migration/migrate.py` Pass 5, `supabase/seed.sql`, future admin UI) leave member enrollments stuck `inactive`.
2. Invitation fulfillment writes `status='active'` with `ignoreDuplicates=true` (`app/api/auth/callback/route.ts:60`), so an invited participant who already has an `inactive` row from `/api/cycles/[cycle_id]/interest` stays `inactive` forever.
3. The revocation cron's `not_in_pod` rule counts `pod_memberships` across ALL cycles (cron route line 38-42) while the soft-delete UPDATE on line 63 is also cross-cycle — simultaneously over-deletes and under-detects.
4. The 7-day pulse rule has no grace period and uses `participants.created_at` as the baseline, so a participant created >7 days before cycle activation is revocation-eligible on day 1.
5. Three prod participants have `first_name='Unknown'` from `scripts/migration/migrate.py:711-716, 884-885`; no PATCH route exists on `/api/participants/[participant_id]`, no admin name-edit UI, no self-fix UI, and no server-side block on submit/vote endpoints.
6. `fulfillInvitation()` has no placeholder-name guard.
7. No admin UI for: manual pod-membership add/remove, manual pod activation, editing participant names, reactivating an `inactive` enrollment that has no `access_revocations` row.

## Scope (In)
### Phase A — State machine centralization (half-day)
- Extract `reconcileEnrollmentActivation(participantId, cycleId, podId?)` helper into `lib/enrollment/reconciler.ts`. Idempotent. Promotes `cycle_enrollments.status` `inactive -> active` whenever (a) the participant has at least one active `pod_memberships` row for the cycle AND (b) at least one pod they belong to is `status='active'`. Conversely, demotes `active -> inactive` (with `access_revocations` audit row) when no active pod membership remains.
- Replace inline activation logic in `app/api/pods/[pod_id]/register/route.ts:119-150` with a single call to the reconciler.
- Fix `app/api/auth/callback/route.ts:56-63`: drop `ignoreDuplicates: true`, switch to explicit upsert-then-promote, and call the reconciler after `fulfillInvitation()` completes.
- Add placeholder-name guard at the top of `fulfillInvitation()` (issue #103): if the participant's `first_name='Unknown'` OR `last_name='Unknown'`, set an `invitation_pending_profile_completion` flag and skip the `cycle_enrollments` upsert until the participant completes their profile.
- Add a follow-up migration `00021_*_with_check.sql` adding `WITH CHECK` clauses to `participants_update_own` (matching what 00019 did for `solution_proposals`).
- Tighten `pod_memberships_select` RLS so soft-deleted rows are visible only to the row owner or admin (current `USING (true)` leaks revoked memberships).
- Add unit tests covering the reconciler for: net-new pod activation, late join into an already-active pod, invitation acceptance for a participant with a pre-existing inactive row, leave-last-pod demotion.

### Phase B — Admin/moderator self-service UI (one day)
- `PATCH /api/participants/[participant_id]` — partial-update route accepting `first_name`, `last_name`, `preferred_name`. Admin OR self. Returns the updated row.
- Mode A `/profile/edit` form (issue #98) — participant self-service.
- Mode B `/profile?required=true&next=X` route + dashboard-layout redirect (issue #102) — server-side enforced redirect when `first_name='Unknown' OR last_name='Unknown'`. Includes 403 + `redirect_hint` JSON on submission endpoints (`/api/proposals`, `/api/votes`, `/api/pulse-checks`, `/api/pods/[id]/register`) as defense in depth.
- Admin manual pod-membership controls on `/admin/cycles/[cycle_id]`:
  - `POST /api/admin/pods/[pod_id]/memberships` — admin-supplied `participant_id`; honors 2-pod cap; calls reconciler.
  - `DELETE /api/admin/pods/[pod_id]/memberships/[participant_id]` — admin soft-delete with reason; calls reconciler.
- Admin pod-status override `PATCH /api/admin/pods/[pod_id]` for `status` (forming/active/closed). Validates pod_min when forcing `active`.
- Admin name-edit form on `/admin/participants/[participant_id]/permissions`.
- Surface "stuck inactive (never activated)" enrollments in `participants-table.tsx` with a filter and a one-click "Activate via reconciler" action (only fires if the participant is actually eligible).
- Render `revoked_systems` and `revocation_scope` columns in `RevocationsSection`.

### Phase C — Revocation cron redesign (1-2 days)
- Re-register `/api/cron/revocation-check` in `vercel.json` (PR #108 removed it; this re-adds it with the new semantics safely).
- Fix the cross-cycle bug at `app/api/cron/revocation-check/route.ts:38-42` and line 63: scope `pod_memberships` lookups and UPDATEs by joining to `pods.cycle_id`.
- Add a `warned_at` column to `cycle_enrollments` (or a new `enrollment_warnings` table). Introduce a two-strike rule:
  - Day N of eligibility: send warning email, set `warned_at`.
  - Day N+3 (configurable per cycle): if still eligible, revoke.
- Replace `participants.created_at` baseline with `MAX(cycle_enrollments.activated_at, cycle.pod_registration_open_at)` so a participant cannot be revoked for missing a pulse check before their cycle was active.
- Add per-(participant, cycle, reason) idempotency on `access_revocations` INSERTs (unique partial index).
- Add per-(participant, cycle, variant) idempotency on the pulse-check-reminder cron via a new `pulse_check_reminders_sent` table.
- Add `pre_revocation_warning` cron variant under the same scheduled job (single Vercel cron entry, multi-stage handler).

## Scope (Out)
- Multi-pulse-question product change (#97) — separate product decision, not architecture.
- Per-member pulse indicator moderator UX (#87) — depends on Phase B but rendered separately.
- Already-submitted pulse-check page state (#86) — small UX fix, do as separate PR.
- Members API with pulse status (#51) — covered by Phase B but tracked as its own follow-up.
- Hard-delete or archived pod states — `pods.status='archived'` is not in scope; current `forming/active` is sufficient.
- JWT-claim mirroring of roles/permissions — the per-request `resolveUserRoles()` model is preserved.

## Acceptance Criteria
1. A pod created via ANY path (admin SQL, migration script, seed, or normal self-register) — once it has `status='active'` and `>= pod_min` active members — has all member `cycle_enrollments.status='active'` within one reconciler tick.
2. An invited participant with a pre-existing `inactive` enrollment row lands on `/dashboard` with `status='active'` after accepting the invitation (issue caused by `ignoreDuplicates: true`).
3. A participant whose `first_name='Unknown'` is redirected to `/profile?required=true&next=X` from the dashboard layout and gets `403 {error: 'profile_incomplete', redirect_hint: '/profile?required=true'}` from any submission endpoint.
4. An admin can edit any participant's name from `/admin/participants/[id]/permissions` with no SQL.
5. An admin can manually add/remove a pod_membership on behalf of any participant; the reconciler updates `cycle_enrollments` automatically.
6. The revocation cron, when re-enabled, does NOT revoke a participant who registered before the cycle activated and whose first 7 days post-activation included a pulse check.
7. The revocation cron sends a warning email at least 3 days before any revocation.
8. The `not_in_pod` check evaluates membership scoped to the current cycle only (verified by SQL test in CI).
9. Re-running the revocation cron twice in one day produces zero duplicate `access_revocations` rows and zero duplicate emails.
10. `pod_memberships` with `inactive_at IS NOT NULL` are not visible to non-admin, non-owner authenticated users (RLS test).
11. `participants_update_own` policy has `WITH CHECK (auth_user_id = auth.uid() OR is_admin_or_owner())`.

## Test Plan
### Automated
- Unit tests for `reconcileEnrollmentActivation` covering all 4 scenarios above.
- Integration test: invitation flow with pre-existing inactive enrollment row.
- Integration test: revocation cron with backdated `created_at` (-30d), recent cycle activation (-3d), pulse check 1 day ago — must NOT revoke.
- RLS regression test: anonymous + authenticated-non-admin trying to SELECT inactive `pod_memberships`.
- Idempotency test: run revocation cron twice in a row.

### Manual
- Restore Aaron McKeever (#61) via admin UI without SQL.
- Fix the three `Unknown` prod participants via admin name-edit form.
- Walk a fresh participant from invitation email through to `enrolled-active` and verify no `inactive` stranding.
- Pod admin-create flow: admin creates pod, admin-adds 4 members via new UI, verifies all 4 enrollments flip `active`.
- Force-leave: admin removes a member from an active pod via UI, verifies enrollment correctly demotes (if no remaining pod) or stays active (if other pod).

## Phased Rollout
**Phase A** (~0.5 day): centralized reconciler, callback fix, placeholder guard in `fulfillInvitation`, RLS WITH CHECK migration, pod_memberships_select tightening. PR into `dev`.
**Phase B** (~1 day): all admin/moderator UI. Depends on Phase A reconciler. PR into `dev`.
**Phase C** (~1-2 days): cron redesign + re-registration in `vercel.json`. Depends on Phase A schema/RLS work. PR into `dev`. **Do not merge Phase C to `main` until staging soak ≥ 48 hours.**

## Supersedes / Subsumes
- Subsumes #102 (profile-completion redirect Mode B) — implemented as part of Phase B.
- Subsumes #98 (Mode A profile edit) — implemented as part of Phase B.
- Subsumes #103 (fulfillInvitation guard) — implemented in Phase A.
- Subsumes #107 (P0 cron redesign) — implemented in Phase C.
- Subsumes #94 (Unknown-names root cause) — answer documented in architecture review; remediation via Phase B name-edit UI.
- Downgrades #51 (members API w/ pulse status) — depends on Phase B but tracked separately as smaller follow-up.
- Downgrades #87 (per-member pulse indicator) — depends on Phase B but UX-only follow-up.
- Keeps as-is #86 (already-submitted pulse page state) — separate UX concern, not architectural.
- Keeps as-is #97 (multi-pulse question) — product decision, not architecture.
