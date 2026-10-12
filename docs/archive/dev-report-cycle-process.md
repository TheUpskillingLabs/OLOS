# Dev report — cycle process: pod & project creation, verified end-to-end

**Date:** 2026-07-09 · **Branch:** `claude/pod-project-creation-testing-pq7wkx`

This report covers three asks: ensure the **pod creation** and **project
creation** processes work, ensure the **testing infrastructure** works, and
**analyze the intent of the cycle process** so it flows as intended and is
testable by the team.

---

## 1. Intent vs. implementation — what the audit found

The cycle is a 6-phase state machine over `cycle_config` timestamps
(`problem_statement → voting → pod_registration → solution_proposal →
solution_voting → project_registration`), driven by
`POST /api/cycles/[id]/advance-phase` (the admin Dev-tab **Testing controls**) and
gated per-route by `checkWindow()`. The timestamp machine was internally
consistent — but artifact creation was decoupled from it, and partly
unreachable:

| # | Finding | Status |
|---|---------|--------|
| 1 | **Projects could never be created from the product.** `POST /api/pods/[pod_id]/projects/finalize` had no caller — no button, no script. Advancing to `project_registration` opened onto an empty registration page. | **Fixed** — see §2.1 |
| 2 | **Fresh-cycle activation deadlock.** Phases 1–2 (submit statements, vote) required `cycle_enrollments.status='active'`, but every self-service join path writes `'inactive'` by design; the reconciler only activates on active **pod** membership — impossible before phase 3. A cycle populated through the app could never reach voting. | **Fixed** — see §2.2 |
| 3 | **advance-phase created no artifacts.** Clicking only "Advance" walked all six phases with zero pods and zero projects. | **Fixed** for projects (auto-finalize on advance); pods stay manual by design — see §2.1 |
| 4 | **Finalize was not phase-gated.** An admin could finalize voting mid-window, freezing a partial tally permanently (the idempotency guard then blocks a redo). | **Fixed** — see §2.3 |
| 5 | **The seed cycle is a finished snapshot, not drivable.** All windows hard-coded to Mar–Apr 2026; pods/projects pre-created, so the Testing controls read "Cycle complete" and finalize buttons 409. | **Mitigated** — `npm run seed:test-cycle` creates a drivable cycle; see §3.3 |
| 6 | **Small test cohorts got stranded.** Pods only auto-activate at `pod_min`; under it, members' enrollments never reconcile to `active`, blocking phases 4–6. The admin force-activate API existed but had no UI. | **Fixed** — see §2.4 |
| 7 | **Zero test infrastructure repo-wide.** No runner, no tests, no CI, no session bootstrap. | **Fixed** — see §3 |

Two smaller bugs found and fixed along the way:

- **`nameFallback` mangled short names.** The inline LLM-failure fallback in
  both finalize routes stripped the last word from *any* text
  (`"Solar Co-op"` → `"Solar"`), not just truncated ones. Caught by the new
  unit tests; fixed in `lib/llm/names.ts`.
- **Module-scope Anthropic client.** `lib/llm/names.ts` constructed the
  Anthropic client at import time, so a missing `ANTHROPIC_API_KEY` would 500
  every route importing the module instead of falling back to the offline
  name. Now lazy — the error surfaces inside `generateName`, where callers
  already catch it.

**≤1-active-cycle invariant:** partial unique indexes
(`one_active_open_cycle` / `one_upcoming_open_cycle`, migration `00048` on
`dev`) reject additional `'active'`/`'upcoming'` cycles. Consequences: test
cycles are created as `'draft'` (both new scripts do this), and advance-phase
surfaces a clear 409 when promoting a draft while another cycle is active.

---

## 2. Cycle-flow fixes

### 2.1 Project creation is now reachable (three triggers)

The orchestration moved to **`lib/projects/finalize.ts`**
(`finalizeProjectsForPod`) — idempotency guard, threshold/cap selection,
naming with offline fallback, service-client insert — and is now triggered by:

1. **Per-pod "Finalize projects" action** in the admin cycle page's pod
   **Manage drawer** (`pods-table.tsx`, next to Force active), shown until
   the pod has projects. Participant cycles only — org workstreams charter
   projects, they don't vote them.
2. **Auto-finalize on phase advance**: advancing into `project_registration`
   finalizes every pod in the cycle; per-pod outcomes come back in a
   `projects_finalized` summary on the response and never block the
   transition. The phase-advance widget UI is unchanged (note: advance-phase
   requires the `testing:use` permission, not just admin).
3. The existing API endpoint (admin or pod moderator), which now delegates to
   the same helper and keeps its org-cycle rejection.

Pod creation keeps its single manual trigger (**Finalize pod voting** button)
by deliberate choice — the admin decides when the vote is settled.

### 2.2 Phases 1–2 now accept enrolled participants

`isEnrolledParticipant()` (new, `lib/auth/roles.ts`) gates problem-statement
submission and voting: **enrolled and not revoked**. Enrolled-but-`'inactive'`
is the normal pre-pod state — enrollment `status` tracks pod-membership
reality (see the reconciler), so it cannot double as the phase-1/2 gate. The
propose page's matching UI gate was updated too. Pod-scoped phases and
project registration keep their stricter gates, which are correct.

*Why not activate on join instead?* The reconciler would demote such
enrollments back to `'inactive'` on its next run — reintroducing the deadlock
intermittently.

### 2.3 Finalize endpoints are phase-gated

Both finalize endpoints now 409 while their voting window is still open
(pods: `voting`; projects: `solution_voting`). Cycles that never set windows
are unaffected. This prevents freezing a partial tally.

### 2.4 Pod force-activate is in the UI

Forming pods have a **Force active** action in the pod Manage drawer (wired to
`PATCH /api/admin/pods/[pod_id]`, which reconciles member enrollments). This
unblocks under-`pod_min` cohorts — exactly the small-group testing case.

---

## 3. Testing infrastructure

### 3.1 Unit tests (offline, fast)

- **Runner:** Vitest (`npm test` / `npm run test:watch`), node environment,
  no DOM. `lib/**/*.test.ts` next to the code they test.
- **Extracted pure logic** so the creation rules are testable without a DB:
  pod selection lives in `lib/voting/rank.ts` (`rankAndSelect`, shared with
  the per-lab formation), project shortlisting in `lib/projects/shortlist.ts`
  (cap math, text extraction, selection), naming fallback as `nameFallback`
  in `lib/llm/names.ts`. The routes delegate to these — behavior preserved
  (modulo the two bug fixes above).
- New suites: `lib/projects/shortlist.test.ts`, `lib/llm/names.test.ts`, and
  enrollment-predicate cases appended to `lib/auth/roles.test.ts` —
  alongside the repo's existing `lib/**` suites (incl. `voting/rank.test.ts`
  and `enrollment/reconciler.test.ts`).

### 3.2 Live end-to-end proof (`npm run verify:cycle`)

`scripts/verify/cycle-e2e.mjs` walks the **full cycle against the real dev
database**: cycle+config → enrollments → statements → votes (incl. duplicate
rejection) → pod finalize (threshold + cap + ranking) → pod registration
(`pod_min` flip + enrollment reconciliation) → force-activate an under-min pod
→ proposals → project votes → project finalize (threshold + shortlist cap) →
project registration (1-per-cycle index, withdraw/re-register, `project_min`
flip). Uniquely tagged, self-cleaning (`--keep` to inspect), refuses to run
against prod. **Current result: 27/27 passed**, twice in a row.

### 3.3 Drivable manual test cycle (`npm run seed:test-cycle`)

Creates a fresh `TEST`-named draft cycle with windows unset (the Testing controls
start at "Start first phase"), small-cohort config, optional
`--fake-participants N`, and **no pods/projects** so both finalize steps have
work to do. `-- --cleanup <cycle_id>` tears one down (refuses non-`TEST`
cycles). This is what `supabase/seed.sql` couldn't provide (finding #5).

### 3.4 CI + session bootstrap

- **`.github/workflows/ci.yml`** (first workflow in the repo): `npm ci` →
  lint → `tsc --noEmit` → `npm test` on pushes to `main`/`dev` and all PRs.
- **`.claude/hooks/session-start.sh`**: web sessions run `npm install` on
  start so tests/lint work immediately (node_modules isn't committed).

---

## 4. How the team tests the cycle from now on

- **Every change:** `npm test` (and CI enforces it).
- **Flow regression check:** `npm run verify:cycle` — 30 seconds against dev.
- **Group/manual testing:** `npm run seed:test-cycle`, then follow
  [`docs/testing-plan-cycle-uat.md`](./testing-plan-cycle-uat.md) — a
  facilitator-led session script for 5–12 testers on the dev preview.
- **Dev preview sanity check:** the Vercel preview (auto-deployed from `dev`)
  shares the dev Supabase project, so cycles seeded by these scripts are
  visible there immediately (`docs/environments.md`).

## 5. Files changed

New: `lib/projects/shortlist.ts`(+tests), `lib/projects/finalize.ts`,
`lib/enrollment/revocation.ts`, `lib/llm/names.test.ts`,
`scripts/verify/cycle-e2e.mjs`, `scripts/ops/seed-test-cycle.mjs`,
`.claude/hooks/session-start.sh`, this report, the UAT plan.

Edited: `package.json` (verify/seed scripts), `lib/llm/names.ts`,
`lib/auth/roles.ts` (+ appended `roles.test.ts` cases),
`app/api/voting/finalize/[cycle_id]/route.ts`,
`app/api/pods/[pod_id]/projects/finalize/route.ts`,
`app/api/cycles/[cycle_id]/advance-phase/route.ts`,
`app/api/problem-statements/route.ts`, `app/api/votes/route.ts`,
`app/(dashboard)/admin/cycles/[cycle_id]/page.tsx` + `pods-table.tsx`,
`.github/workflows/ci.yml` (adds typecheck), `.claude/settings.json`
(adds the SessionStart hook).

Flagged behavior changes (intent-aligned, called out for review): the
phase-1/2 enrollment gate (§2.2), the finalize phase gates (§2.3), the
`nameFallback` short-text fix, and auto-finalize on advance (§2.1).
