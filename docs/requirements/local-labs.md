# Requirements — Local Labs (Multi-Tenancy)

| | |
|---|---|
| **Status** | **Superseded — implemented differently** (2026-07 re-baseline; see [`pr231-evaluation.md`](./pr231-evaluation.md)) |
| **Last updated** | 2026-07-12 |
| **What shipped instead** | `metros` promotion + HQ-cycle sub-cohorts: migrations `00060`, `00062_local_labs`, `00067_hq_open_cycle_sub_cohorts`, `00068_pods_local` |
| **Live remnant** | A timezone home — picked up by [`cycle-timeline.md`](./cycle-timeline.md) |

## What this doc proposed (June 2026)

A new `labs` root table **above** cycles: every cycle and every participant would
carry a `NOT NULL lab_id`, all existing rows backfilled to a single "DC" lab, and
each lab would run its own cycles.

## What actually shipped (July 2026) — the opposite hierarchy

The codebase answered the multi-tenancy question differently, and the shipped
model **contradicts this doc's core premise**. Do not build from this doc; the
record below is kept so the divergence is explicit.

- **No `labs` table.** The existing **`metros`** table (public "Local Labs"
  content, `00033`) was promoted into the organizational lab anchor
  (`00062_local_labs`): `slug`/`name`/`st`/`status ('active'|'waitlist')`/
  `zip_prefixes`/`is_default`. A participant's lab is **`participants.metro_id`**
  (nullable), not `lab_id`.
- **Labs are sub-cohorts *inside* the cycle, not parents *above* it.**
  Open-mode is a **single HQ-run cycle**; `00067` folds any per-lab open cycle
  into the HQ stream and adds the CHECK `cycles_open_is_hq_when_live` —
  a live open cycle is *forbidden* from having a `lab_id`. A pod's lab lives on
  **`pods.lab_id`** (its host sub-cohort), and `00068` fences membership:
  active open-mode lab pods only admit participants whose `metro_id` matches.
- **Per-lab cycles exist only for `mode='org'`** (internal team cycles,
  `00060`/`00062`: `one_active_org_cycle_per_lab`).
- **Lab leadership** is a role grant: `participant_roles(role='lab_lead',
  lab_id=…)` (the `lab_leads` table from `00062` was folded into the unified
  role model by `00064`/`00065`). The app seam is `lib/auth/lab.ts`
  (`requireLabAccess`, `labForCycle`, `labForPod`) — the "single shared
  lab-scoping helper" this doc asked for exists in that form.
- **No backfill to "DC id 1" ever ran**; metro membership is assigned through
  registration/directory flows instead.

See `SCHEMA.md` for the current shapes.

## The one live remnant: a timezone home

This doc placed `timezone` on `labs`. No timezone column exists anywhere in the
schema today, and the cycle-timeline work still needs one. Since a live open
cycle has no lab FK, the June rule "a cycle uses its lab's timezone" no longer
has a path. Recommendation, carried into
[`cycle-timeline.md`](./cycle-timeline.md):

- Add **`metros.timezone TEXT`** (IANA, default `America/New_York`).
- The **cycle schedule** renders/computes in the HQ default zone; **sub-cohort
  surfaces** (a lab pod's pages, lab-scoped comms) may resolve
  `pods.lab_id → metros.timezone` for display. Today every metro is US-Eastern,
  so the default is correct everywhere; the column makes the first non-Eastern
  metro a data change, not a schema change.

## Decisions log

- **2026-06-17** — (original) `labs` above cycles; backfill to DC; timezone on
  the lab. **Superseded by shipped code (00060/00062/00067/00068).**
- **2026-07-12** — Doc re-baselined: keep as a superseded record; the timezone
  question moves to `cycle-timeline.md` with `metros.timezone` as the
  recommended home.
