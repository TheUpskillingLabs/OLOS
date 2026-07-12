# Requirements — Local Labs (Multi-Tenancy)

| | |
|---|---|
| **Status** | Draft — for review (**active**; ships with the auth redesign) |
| **Author** | (you) |
| **Last updated** | 2026-06-17 |
| **Related code** | `supabase/migrations/00001` (cycles, participants), `lib/auth/` |
| **Related docs** | [`permissions-redesign.md`](./permissions-redesign.md) (the lab-admin tier scopes against the `labs` introduced here) |
| **Pairs with** | This is **Change #1 of 2.** Change #2 is the admin-scope redesign in `permissions-redesign.md`. |

## Overview

OLOS is becoming **multi-tenant** at the data-model level. Today there is one
implicit org (`SCHEMA.md`: `cycles` = "the root of everything"; `participants` =
"the system-wide identity table"). We are putting the **lab** concept into the
schema **now** — a new root entity above cycles — so the data model and the
admin tiers (super / lab / cycle) are correct from the start.

**Scope of this change:** the *structure* (the `labs` table, `lab_id` links, the
lab-admin tier). **Out of scope:** per-lab *configuration management* — there is
only one lab, so option lists, Slack/Drive/GitHub provisioning, and branding
stay **global**. We are not building UI to manage those per lab (see L-2).

New scope hierarchy:

```
lab (NEW root)  →  cycle  →  pod  →  project  →  membership
```

## Goals

- A first-class **`labs`** entity in the schema now; seed the existing org as
  **"DC"** (id 1).
- Every **cycle** belongs to exactly one lab; every **participant** belongs to
  exactly **one** lab. Backfill all existing rows to DC.
- The model supports N labs even though we run one today — the admin tiers and
  `lab_id` plumbing are real, not stubbed.

## Non-goals

- **Per-lab configuration management.** `option_lists`, provisioning targets
  (Slack/Drive/GitHub), and branding remain global; no per-lab admin UI. With
  one lab this buys nothing; revisit when a second lab needs different values
  (L-2).
- The admin role tiers themselves — specified in
  [`permissions-redesign.md`](./permissions-redesign.md). This doc adds the
  `labs` entity + `lab_id` links the tiers scope against.
- Changing the cycle→pod→project phase machine.

## Glossary

| Term | Meaning |
|---|---|
| **lab** | A local chapter. The new top-level tenant. `labs` table. UI calls it "Lab" too. Today there is one: DC. |
| **lab membership** | `participants.lab_id` — the one lab a participant belongs to. Distinct from *administering* a lab (a role grant; see Doc B). |

## Model & schema changes

- **`labs`** — new table: `id`, `name`, `slug` (UK), `status`, **`timezone`**
  (IANA, default `America/New_York` — the cycle timeline reads it; see
  `cycle-timeline.md` D-4), `created_at`.
  No per-lab config columns (Slack/Drive/branding) in this cut — see L-2.
- **`cycles.lab_id`** — FK → `labs`, `NOT NULL` (after backfill). Lab is the
  derivable parent of every pod/project (through the cycle).
- **`participants.lab_id`** — FK → `labs`, `NOT NULL` (after backfill). "Lab
  admins see all participants in their lab" = `WHERE participants.lab_id = <lab>`.

## Data isolation

Reads are lab-scoped: lab admins and participants see only their own lab's data;
super admins see everything. **Mechanism: soft, app-level filtering** (L-1) —
queries add `WHERE lab_id = <user's lab>` (or the cycle's lab); RLS is not the
cross-lab wall. With a single lab everyone is in DC, so the filter is trivially
satisfied today — but the `lab_id` + filter pattern goes in now so it is correct
the moment a second lab exists.

- **Risk to manage:** a query that forgets the lab filter would leak another
  lab's data once 2+ labs exist. Mitigation: a single shared lab-scoping query
  helper (mirroring the authz seam in Doc B AC-2), so the predicate lives in one
  place. Upgradeable to RLS lab-predicates later without changing the app
  contract.

## Migration (hybrid rollout — per Doc B)

**Rollout model (decided 2026-06-17):** build/test against a **reset dev DB**, but
apply to **prod as forward-only migrations *with* backfill** — prod is **not** reset.
The backfill steps below are therefore real (they run against prod's existing rows);
in dev they simply seed.

1. Create `labs`; insert **"DC"** (id 1).
2. Add `lab_id` to `cycles` and `participants` (nullable), backfill **every**
   existing row to DC, then set `NOT NULL` (default to DC for new rows until the
   app sets it explicitly).
3. Hand off to Doc B for the role/RLS changes that consume `lab_id`.

## Acceptance criteria

- `labs` exists with a DC row; every cycle and participant resolves to DC with
  no orphans.
- The schema + `isAdminOf`/lab-scoped queries would correctly separate a second
  lab's data if one were inserted (verified by inserting a throwaway "Lab 2"
  with its own cycle/participant in a test).
- Nothing per-lab to configure: option lists, provisioning, and branding remain
  global and unchanged.

## Decisions log

- **2026-06-17** — Put `labs` in the schema **now** (not deferred); a new root
  above cycles. Build the structure; skip per-lab config management.
- **2026-06-17** — One implicit lab today: **DC**. Seed it and default everyone
  to DC.
- **2026-06-17** — A participant belongs to **exactly one** lab
  (`participants.lab_id`); explicit, not derived from cycle enrollment.
- **2026-06-17** — Term is **`lab`** in code and UI (no "chapter" identifier).
- **2026-06-17 (L-1)** — Isolation is **soft, app-level filtering**, not a strict
  RLS wall; shared lab-scoping helper; upgradeable to RLS later.
- **2026-06-17 (L-2)** — `option_lists`, provisioning targets, and branding stay
  **global**; no per-lab config management until a second lab needs it.
- **2026-06-17 (L-3)** — Participants **cannot move labs**; manual reassignment
  only; history stays with the original lab.
- **2026-06-17 (L-4)** — Super admins = the **current owners and admins** (the
  Doc B backfill set; exact list via D-4).
- **2026-06-17 (L-5)** — **Super admins only** create labs.

## Open decisions

- *(None blocking.)* L-2's per-lab config items (option lists, provisioning,
  branding) are intentionally global for now; reopen per item when a second lab
  requires different values.
