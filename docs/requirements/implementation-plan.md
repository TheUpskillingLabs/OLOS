# OLOS Redesign — Sequenced Implementation Plan (2026-07 re-baseline)

## Context

The June 2026 plan sequenced four redesigns (`labs → timeline → pod-registration
→ auth`) on the premise that none were built. Six weeks of shipping changed
that premise (see [`pr231-evaluation.md`](./pr231-evaluation.md)):

- **Labs**: shipped **differently** — metros + HQ-cycle sub-cohorts
  (`00060`/`00062`/`00067`/`00068`). The labs phase is **dropped**;
  [`local-labs.md`](./local-labs.md) is a superseded record.
- **Auth storage**: shipped — `participant_roles` unification
  (`00054`–`00066`). What remains is **finishing** it
  ([`permissions-redesign.md`](./permissions-redesign.md)).
- **Timeline**: not built; prod now runs **four** uncoordinated time models
  ([`cycle-timeline.md`](./cycle-timeline.md)).
- **Pod registration**: core change (two windows, decoupled enrollment) not
  built; the enrollment seam (`lib/enrollment/reconciler.ts`) and a
  phase-gated (but **unscheduled**) revocation cron shipped
  ([`pod-registration.md`](./pod-registration.md)).

**Timing constraint:** Cycle 3 starts **Jul 14, 2026** and runs on the manual
window columns. Schema-touching timeline work targets **Cycle 4** (or a
deliberately-decided mid-cycle retrofit); nothing below may disrupt a live
formation window.

### Standing decisions (carried forward)

- **DB strategy: hybrid.** Build/test against a reset **dev** DB; apply to
  **prod as forward-only migrations with backfill** (no prod reset).
- **Rollout: phased PRs** in dependency order, not one big-bang.
- **Migration numbering:** next free number is **00082** (`00078`–`00081` are
  on `dev`); claim numbers per `CONTRIBUTING.md`.
- **Tests:** dev already carries unit tests (`lib/owner/*.test.ts`) — extend
  that harness for the three risk seams (window resolver incl. DST, tz
  conversion round-trip, reconciler policy), don't invent a new one.

## Phase 0 — Independent cleanups (small; safe during Cycle 3)

- **Re-schedule the revocation cron** (`app/api/cron/revocation-check`) in
  `vercel.json` — it has been unscheduled since PR #108; its current gate
  (after `pod_registration_close`) is safe under today's single-window model.
  Verify the two-stage warn→grace behavior against Cycle 3 config first.
- Seed `cycle_events`-precursor data? **No** — do nothing speculative; the
  timeline phase owns schema. Phase 0 is ops-only.
- (Dropped from the June plan: the `testing-controls.tsx` `>`-vs-`>=` "bound
  bug" — the current code is internally consistent; and the duplicate-`00015`
  fix — renumbered to `00028` on 2026-06-02.)

## Phase 1 — Cycle timeline (foundation; targets Cycle 4)

Per [`cycle-timeline.md`](./cycle-timeline.md). Everything else anchors here.

1. Schema (`00082+`): `cycles.start_at` (+ derived `end_at`),
   `metros.timezone`, `cycle_phases`, `cycle_events`; migrate window columns →
   phase rows (split `pod_registration` → `pod_forming` + `pod_active_join`);
   migrate `phase_2/3_start` → event rows; per-column timestamptz conversion
   (audit=UTC; scheduling=verified) — **dry-run on a prod clone first**.
2. Schedule service (compute/recompute `starts_at`/`ends_at`; spine contiguous
   by construction; overlays independent).
3. Single tz-aware window resolver (extend `lib/auth/windows.ts`; new
   `WindowField` keys; keep the org-mode reject) + **consolidate all ~22
   inline-checking files onto it** (server-side resolution passed to pages).
4. `advance-phase` → duration-override + recompute (keep `testing:use` gate).
5. Re-anchor the week grid (`lib/cycle/week.ts` reads `start_at`; tz-aware
   week boundaries); wire Luma sync → `cycle_events`; retire
   `anchor-events.ts`; update `cycle-phase-indicator.tsx`; drop replaced
   columns.
6. FR-14 display tz + FR-15 cron-hour gating.

Verify: changing `start_at` shifts all boundaries + week grid; DST-crossing
23:59 close closes at local 23:59; spine can't save overlapping; a cycle with
`start_at == start_date` produces identical milestone timing; no
`_open`/`_close` comparison outside the resolver.

## Phase 2 — Pod registration (behavioral change; needs Phase 1)

Per [`pod-registration.md`](./pod-registration.md).

1. Register route checks the window matching pod status (`forming` →
   `pod_forming`; `active` → `pod_active_join`); metro fence + `pod_limit`
   unchanged.
2. Reconciler policy change (enrollment decoupled from pod membership;
   enrollment paths activate at enrollment time). Decide D-9 (retroactive
   activation at cutover) before shipping.
3. Forming-close boundary event: activate ≥ `pod_min`, **dissolve** the rest
   (reuse `00063` status), free + notify orphans (notification is net-new).
4. Move the revocation gate to `pod_active_join.ends_at`; confirm
   revoked→rejoin reactivation works during active-join.

Verify: join forming pod only in forming window (and vice versa); join/leave
never touches enrollment status; sub-`pod_min` pod dissolves at forming close
with members freed + notified; nobody warned/revoked before active-join close;
project-layer interaction (last-day joiner can register a project) accepted.

## Phase 3 — Auth completion (largest call-site surface; lands last)

Per [`permissions-redesign.md`](./permissions-redesign.md).

1. Invitations → (role, scope): schema change, role-selector UI,
   `fulfillInvitation` writes via `grantRole` + reconciler; translate or drain
   in-flight pending invites (decide P-1).
2. Drain `participant_permissions`: run the pre-drain audit; make
   `capabilitiesForRoles` the sole `permissions[]` source; remove writers +
   `00065` forward-sync triggers.
3. Unify RLS: migrate the `has_permission()`/`is_admin_or_owner()` policy
   family (~15 migrations) onto `is_admin()`/`is_owner()`/
   `current_participant_id()`; drop legacy helpers, then
   `participant_permissions` + `user_roles` (update `delete_participant`).

Verify: capability snapshot per participant identical before/after the drain;
invitation acceptance produces only `participant_roles` + membership rows;
grants attenuation tests pass; no reference to the legacy names remains.

## End-to-end verification

1. Reset dev DB; seed a Cycle-4-shaped cycle from the template (Cycle 3 dates
   as fixture) + owner/admin/lab_lead/participant fixtures.
2. Run the seam tests (resolver/DST, tz round-trip, reconciler policy, grants).
3. Walk the cycle: problem statement → voting → pod forming → forming-close
   dissolution → active-join → project stage; assert enrollment status and
   cron behavior at each boundary (especially: nobody revoked before
   active-join close).
4. Sub-cohort isolation: a lab pod only admits matching-metro participants;
   lab_lead scope checks 403 on foreign labs.
5. Dry-run every prod migration (esp. the tz conversion) against a prod clone
   before applying.

## Residual risks

- **Per-column tz conversion** is the one irreversible data step — verify real
  values per column; dry-run on a clone.
- **Window consolidation** touches ~22 files during/near a live cycle — hence
  the Cycle-4 targeting; land behind the resolver with unchanged semantics
  first (naive→tz-aware flip is the schema migration moment, not the refactor
  moment).
- **Reconciler policy change** alters who counts as active mid-cycle if D-9 is
  decided as retroactive — model the Cycle-3/4 boundary explicitly.
- **Legacy-RLS unification** can silently widen/narrow row visibility —
  policy-by-policy diff review + before/after query fixtures.
