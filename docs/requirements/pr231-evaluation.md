# PR #231 Evaluation — why these docs were re-baselined (2026-07-12)

The six requirement docs in this folder were originally drafted **2026-06-17**
(PR #231), against a codebase whose migrations ended at `00019`. By the time
they came up for review, prod stood at migration `00077` (`00081` on `dev`) and
had independently answered several of the questions the docs posed — twice in
ways that contradict them. This note records the audit that drove the rewrite,
so reviewers don't need to diff against #231.

## What the audit checked

Prod code (`main`, 2026-07-11) — all migrations `00001`–`00077`, `lib/auth/*`,
`lib/cycle/*`, `lib/enrollment/reconciler.ts`, `lib/auth/windows.ts`, the
window-checking UI pages, cron routes + `vercel.json`, `SCHEMA.md`.

## Findings that changed the docs

### Multi-tenancy shipped **inverted** (→ `local-labs.md` superseded)

The June docs put labs *above* cycles (every cycle gets a `NOT NULL lab_id`).
What shipped is the opposite: no `labs` table — `metros` was promoted
(`00062`); open-mode is a **single HQ cycle with labs as sub-cohorts**
(`00067` adds a CHECK forbidding a live open cycle from having a `lab_id`;
`pods.lab_id` carries the sub-cohort; `00068` fences pod membership by
participant metro). Only `mode='org'` cycles are per-lab. The one live remnant
is the missing **timezone home**, moved to `cycle-timeline.md` as
`metros.timezone`.

### The auth redesign ~70% shipped under different names (→ `permissions-redesign.md` re-scoped)

The proposed `role_assignments(role, scope_type, scope_id)` landed as
**`participant_roles`** with typed scope FKs (`cycle_id`/`pod_id`/`lab_id`/
`project_id`), provenance, and revocation history (`00054`/`00058`/`00064`/
`00065`/`00066`), read by both `resolveUserRoles` and the RLS helpers
`is_admin()`/`is_owner()` — plus a governed grants path
(`lib/auth/grants.ts`, `guard_owner_grant`, rooted owner tree) the June doc
didn't specify. Still genuinely open, now the doc's whole scope:
**invitations still carry `permissions[]` + `role_preset`** (and fulfillment
still writes `participant_permissions` + `user_roles`); granular capabilities
still read `participant_permissions`; **RLS is split-brained** between the
legacy `has_permission()`/`is_admin_or_owner()` family (~15 migrations) and
the new helpers. The June backfill/observer-escalation machinery is moot —
`00065` already ran a role-preserving backfill.

### The timeline scaffolding was never built — and a fourth time model appeared (→ `cycle-timeline.md` re-baselined, kept)

No `cycle_phases`, `cycle_events`, `cycles.start_at`, schedule service, or
timezone column exists. The June complaints all still hold (12 naive window
columns; `checkWindow` naive with 6 keys; inline `now >= open && now <= close`
in the UI — now ~131 `_open`/`_close` hits across ~22 files; `advance-phase`
still hardcodes 24h). But two June claims were already false at merge time:
`cycles.start_date`/`end_date` **are** read (they drive the shipped 12-week
calendar — `lib/cycle/week.ts` + `00047` milestone weeks + `00048`), and
`phase_2_start`/`phase_3_start` are **not dead** (they drive the phase
indicator). A fourth model — hardcoded anchor events
(`lib/cycles/anchor-events.ts`, interim pending the Luma cache `00035`) — must
also fold into `cycle_events`. The rewrite keeps the June prescription and
adds the fold-in plan for all four models, plus the timing note that Cycle 3
(Jul 14) opens on manual columns; per the owner's 2026-07-12 decision the
overhaul targets **Cycle 3, staged inside the cycle** (schema + resolver
before the Jul 25 Sprint; pod windows before Aug 11 Meet the Pods). The
June docs' Cycle-3 dates are **owner-confirmed correct**; the shipped
`lib/cycles/anchor-events.ts` constant carried stale prototype dates
(everything ~1–4 weeks late) and was corrected in this PR — it feeds the
agreement ceremony, the dashboard Key-dates card, and the `.ics` download,
so the fix must deploy before Jul 14.

### Pod registration partially overtaken (→ `pod-registration.md` re-baselined, core kept)

Still true: one `pod_registration` window; joining still drives enrollment and
still flips forming→active at `pod_min` — but through one seam now
(`lib/enrollment/reconciler.ts`), which turns the June "hunt down side
effects + build an activation trigger" into a contained policy change.
Overtaken: the "hardcoded 2-pod cap" is `cycle_config.pod_limit` (default
**1**, `00043`); pod **dissolution exists** (`00063`) but only fires at cycle
close-out; the revocation cron was **rewritten** (phase-gated after
`pod_registration_close`, two-stage warn→grace→revoke, reconciler-driven) —
and is **unscheduled** (absent from `vercel.json` since PR #108), which is a
standalone operational gap. The two-window forming/active-join split remains
unbuilt and is still the core ask.

### Stale specifics corrected across the set

- Duplicate migration `00015` — renumbered to `00028` on 2026-06-02; the next
  free number is `00082`, not `00020`.
- The `testing-controls.tsx` `>`-vs-`>=` "bound bug" — current code is
  internally consistent; dropped from the plan.
- "No test infra exists" — `dev` carries unit tests under `lib/owner/`;
  extend, don't invent.
- The June dependency order (`labs → timeline → pod-registration → auth`)
  collapses to **timeline → pod-registration → auth-completion** (labs phase
  dropped; auth storage done), with an ops-only Phase 0 (re-schedule the
  revocation cron).

## Disposition summary

| Doc | Disposition |
|---|---|
| `local-labs.md` | Superseded record (shipped inverted); timezone remnant moved to timeline doc |
| `permissions-redesign.md` | Re-scoped to "finish the unification": invitations → (role, scope); drain `participant_permissions`; unify RLS |
| `cycle-timeline.md` | Kept (highest value); re-baselined on the four coexisting time models; targets Cycle 3, staged (owner decision 2026-07-12) |
| `pod-registration.md` | Core kept (two windows, decoupling); rewritten around the reconciler + rewritten/unscheduled cron |
| `per-lab-configuration.md` | Still deferred; retargeted labs→metros |
| `implementation-plan.md` | Rewritten: Phase 0 cleanups → timeline → pod-registration → auth completion |
