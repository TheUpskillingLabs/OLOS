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
- **Timeline**: not built; prod runs **four** uncoordinated time models
  ([`cycle-timeline.md`](./cycle-timeline.md)).
- **Pod registration**: core change (two windows, decoupled enrollment) not
  built; the enrollment seam (`lib/enrollment/reconciler.ts`) and a
  phase-gated (but **unscheduled**) revocation cron shipped
  ([`pod-registration.md`](./pod-registration.md)).

**Timing decision (2026-07-12, owner): the calendar overhaul targets Cycle 3,
staged inside the live cycle.** Cycle 3's calendar (all Eastern, confirmed by
the owner — `cycle-timeline.md` is the source; `anchor-events.ts` shipped with
stale prototype dates and was corrected in this PR): Kickoff **Tue Jul 14** ·
Problem Sprint **Sat Jul 25** (windows 9am–1pm; forming closes **Jul 28** EOD)
· Meet the Pods **Tue Aug 11** (active-join opens) · Hackathon **Thu Aug 13**
· Meet the Projects **Tue Sep 8** · Summit **Tue Oct 13**. The stage
boundaries below are those dates. Testing gates per stage:
[`cycle3-testing-plan.md`](./cycle3-testing-plan.md).

### Simplifications that make Cycle-3 targeting feasible

1. **Dual-write bridge instead of a 22-file big-bang.** `cycle_phases` becomes
   the source of truth and the schedule service **mirrors computed boundaries
   back into the legacy `cycle_config.*_open/close` columns**. Every
   not-yet-migrated page keeps working unchanged; pages move to the resolver
   in batches; the mirror (and the columns) drop only when the last page has
   moved. Removes the launch-window cliff entirely.
2. **Seed, don't derive.** Cycle 3's phases/events are inserted as explicit
   rows from the decided dates. The template-derivation engine
   (offsets/weekday-snap; FR-2/FR-3's recompute machinery beyond simple
   boundary edits) is Cycle-4 work.
3. **No DST machinery now.** Cycle 3 runs Jul 14–Oct 13, entirely inside EDT —
   pin cron hours to fixed UTC equivalents; hourly-gating waits for Cycle 4.
4. **No mass timestamptz conversion now.** New tables (`cycle_phases`,
   `cycle_events`) are born TIMESTAMPTZ; the ~49 legacy naive columns stay
   untouched until Cycle 4 (the irreversible per-column conversion is off the
   critical path). The legacy mirror columns keep their current storage
   convention, verified by test S5.1.
5. **`anchor-events.ts` retires late.** It feeds the live agreement ceremony
   (PR #226); `cycle_events` is seeded *from* it and the ceremony swaps data
   source only when convenient — until then both must agree (single edit
   point: the constant). Its stale prototype dates were corrected to the real
   calendar in this PR — **that fix must reach `main` before Jul 14** (the
   ceremony renders it on day 1).

### Standing decisions (carried forward)

- **DB strategy: hybrid.** Build/test against a reset **dev** DB; apply to
  **prod as forward-only migrations with backfill** (no prod reset).
- **Rollout: phased PRs** in dependency order, not one big-bang.
- **Migration numbering:** `00078`–`00081` are taken on `dev`, **and open
  PR #229 carries a colliding `00078_handle_desuffix`** (its base predates the
  owner-lifecycle merge) — renumber it at merge time; `npm run
  check:migrations` on a rebased branch catches it. Claim the next free
  number per `CONTRIBUTING.md` at branch time.
- **Tests:** dev already carries unit tests (`lib/owner/*.test.ts`, 255+
  passing per the fix-train PRs) — extend that harness for the risk seams
  (window resolver, storage-convention round-trip, reconciler policy).

## Stage 0 — before Kickoff (by Jul 13) — ops only, no schema

- **Merge the July-11 fix train (#224–#230, rebased, in order)** and promote
  `dev → main`; these fixes (vote budgets/stacking, checklist gating, ceremony
  dates, funnel prefill, pulse-leak fix) are launch-day behavior.
- Run the **S5.1 window-entry convention test** and enter Cycle 3's decided
  windows using it; complete the S1 handover rehearsal (close Cycle 2 →
  activate Cycle 3) on staging, then execute for real.
- **Leave the revocation cron unscheduled for now** (revised from the June
  "re-schedule it" item): scheduling its "in no pods" arm before the
  active-join window exists opens the orphan dead-zone ~Jul 29–Aug 11. It
  gets scheduled in Stage 2 together with the gate move.
- Confirm `cycle_config` values: `pod_min`, **`pod_limit` (1 vs 2 — product
  call)**, `submitter_votes`/`non_submitter_votes`, milestone weeks.

## Stage 1 — calendar schema + resolver (land by ~Jul 23, before the Jul 25 Sprint)

Per [`cycle-timeline.md`](./cycle-timeline.md), minus the deferred items above.

1. Migration (next free number): `cycle_phases`, `cycle_events`,
   `cycles.start_at` (backfill from `start_date` under the verified
   convention), `metros.timezone`. Seed Cycle 3 rows (phases from the decided
   windows; events from `anchor-events.ts`).
2. Schedule service v1: boundary edits recompute downstream spine +
   **mirror to legacy columns** (simplification 1).
3. Resolver: `checkWindow` reads `cycle_phases` (tz-aware), gains the new
   keys, keeps the org-reject and the #224 config-missing message. Migrate the
   **critical-path pages** first: dashboard checklist row, join,
   register-pods, propose, vote (the Sprint surface).
4. `advance-phase`: keep gated as-is; do not use on the live cycle (testing
   tool only). Full override/recompute UX is Cycle-4 polish.

Gate: [`cycle3-testing-plan.md`](./cycle3-testing-plan.md) G2 (S4, S5.2–5.4,
S6) green on staging against a prod clone before deploy; deploy in the quiet
stretch (Jul 16–23), days before the Sprint.

**Fallback:** if Stage 1 isn't green by Jul 23, the Sprint runs on manual
columns exactly as today (the mirror means nothing user-facing depends on the
new tables yet) — slip Stage 1 to the Jul 29–Aug 9 stretch (after forming
closes, before active-join opens) and keep Stage 2's date.

## Stage 2 — two pod windows + lifecycle (land by ~Aug 8, before Meet the Pods on Aug 11)

Per [`pod-registration.md`](./pod-registration.md); needs Stage 1.

1. `pod_forming` / `pod_active_join` phase rows govern the register route
   (window matching pod status); metro fence + `pod_limit` unchanged.
2. Reconciler policy change (enrollment decoupled; enrollment paths activate
   at enrollment time). Decide D-9 (retroactive activation for existing
   `inactive` self-registrants) — recommended **yes** at cutover so the two
   enrollment paths converge.
3. Forming-close boundary event: activate ≥ `pod_min`, dissolve the rest
   (reuse `00063` status), free + notify orphans. *(Note: Cycle 3's forming
   window closes Jul 28 EOD, before Stage 2 lands — that close is handled by
   the current per-registration flip; the boundary event applies from
   active-join close (Aug 25) onward and for Cycle 4.)*
4. Revocation cron: move the "in no pods" gate to `pod_active_join.ends_at`
   **and schedule it** in `vercel.json` (fixed UTC hour ≈ 7 AM EDT).
5. Migrate the remaining window pages (solutions, solution-vote,
   register-projects, moderator views) to the resolver; drop the legacy
   mirror + columns once the sweep is clean.

Gate: G3 (S7 + active-join suite) green before Aug 10.

## Stage 3 — auth completion (post-launch-crunch; no calendar dependency)

Per [`permissions-redesign.md`](./permissions-redesign.md). Unchanged in
content; start once Stages 0–2 are stable (September window is fine — nothing
in Cycle 3 blocks on it):

1. Invitations → (role, scope); translate/drain pending invites (P-1).
2. Drain `participant_permissions` (pre-drain audit first).
3. Unify RLS; drop legacy helpers + `user_roles`/`participant_permissions`.

## End-to-end verification

1. Staging = prod clone. Walk the full Cycle-3 calendar with the testing
   plan's personas (P1–P11) at each gate.
2. Seam tests: resolver bounds + storage-convention round-trip; reconciler
   policy (Stage 2); grants attenuation (Stage 3).
3. Dry-run every prod migration against the clone before applying; the Stage-1
   migration is additive (new tables + nullable column) — rollback is a
   drop, not a restore.

## Residual risks

- **Live-cycle deploys.** Stages 1–2 land inside a running cycle by design
  (owner call). Mitigations: additive schema + dual-write mirror (old pages
  never break), deploys in quiet stretches between anchor events, per-stage
  fallback to manual columns.
- **Sprint-day compression.** Jul 25's submit → vote → finalize → forming
  chain runs inside ~4 hours with an admin in the loop — rehearse end-to-end
  (S4.1) regardless of which stage has shipped.
- **Metro fence vs. metro-less members** (S4.4): decide HQ-pods vs.
  metro-backfill before Jul 25 — likeliest mass-failure of Sprint day.
- **Reconciler policy change mid-cycle** (Stage 2): D-9 decision changes who
  counts as active on real data; snapshot enrollment statuses before/after.
- **Legacy-RLS unification** (Stage 3): policy-by-policy diff + before/after
  fixtures, as before.
