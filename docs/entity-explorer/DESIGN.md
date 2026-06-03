# Entity Explorer — Design & Implementation Plan

**Status:** Proposal (design only — no code in this PR)
**Branch:** `feat/entity-explorer-design` → base `dev`
**Author:** HQ
**Date:** 2026-06-03

---

## 1. Problem

OLOS has no general-purpose admin dashboard. When an organizer needs to answer
"what pods exist this cycle", "is this participant enrolled", "did that solution
proposal get created" — there's no in-product way to look. Supabase Studio works
for engineers but isn't something we hand to organizers, and it shows raw tables
with no domain framing.

We want a **stopgap**: a single, read-only interface where an organizer picks an
entity (pods, participants, projects, problem statements, …) and sees the rows
that exist in the database, with sensible columns and click-through on
relationships. It buys us time while we build a proper admin, and it should be
**trivial to delete** when that proper admin lands.

## 2. Goals

- One screen: choose an entity from a dropdown, see its rows in a paginated table.
- Cover the main entities (see §6) via a config-driven registry, so adding a new
  entity is a one-line change, not a new page.
- Click-through on foreign keys (a `pod_id` cell links to that pod's row).
- Global cycle filter, since almost everything is `cycle_id`-scoped.
- Works in **both dev and prod** with no per-environment code; a visible
  environment banner so the viewer always knows which database they're in.
- Reuse existing auth, Supabase client, and RSC fetch patterns — no new
  primitives.

## 3. Non-goals (v1)

- **No writes.** Read-only, hard. No create/edit/delete anywhere.
- No per-column search or advanced filtering (cycle filter + pagination only).
- No new database tables or migrations. No persisted UI state.
- No charts, aggregations, or analytics — this is a row browser, not a report.
- Not a replacement for the real admin dashboard. Deliberately disposable.

## 4. Design principle: loosely coupled and removable

This is a stopgap, so the overriding constraint is that **removing it leaves no
trace**. We achieve that by keeping it a self-contained module that only *reads
from* the rest of the app and is never *read by* it.

What that means concretely:

- **Everything lives under two new folders** — `app/(dashboard)/admin/explore/`
  (the route) and `lib/entity-explorer/` (the registry + fetch helpers). Nothing
  outside those folders imports from inside them, except one nav link.
- **It only consumes stable, existing seams** — `createServiceClient()`,
  `withAdminAuth`/`isAdmin`, and direct table reads. It adds no shared types, no
  exported helpers other code depends on, no migrations.
- **One feature flag** — gate the route and the nav link behind a single
  `ENTITY_EXPLORER_ENABLED` env check (or a constant). Off = the feature is
  invisible and inert.
- **Removal checklist** (the whole cost of deleting it later):
  1. `rm -rf app/(dashboard)/admin/explore lib/entity-explorer`
  2. Remove the one nav link in the dashboard nav.
  3. Drop the `ENTITY_EXPLORER_ENABLED` env var.
  No migrations to revert, no schema changes, no data to clean up.

> **Why "loosely tied to admin" rather than fully separate?** We reuse
> `withAdminAuth` purely as a guard import — that's a one-line dependency, not
> structural coupling. We deliberately do *not* fold it into the existing admin
> pages, share their components, or extend their types, so admin and explorer can
> evolve (or the explorer can vanish) independently.

## 5. Architecture

It is a config-driven generalization of what
`app/(dashboard)/admin/participants/page.tsx` already does by hand: an async
RSC fetches rows with the service-role client, optionally fetches related rows
for label/FK resolution, and renders a generic table.

```
Organizer (admin) ──▶ /admin/explore?entity=pods&cycle=3&page=1
                          │
                          ├─ withAdminAuth guard (isAdmin)  ── 403 otherwise
                          │
                          ├─ registry[entity]  ── columns, label, FKs, soft-delete
                          │
                          ├─ createServiceClient() ── reads `pods` (RLS bypassed)
                          │      + resolves FK label rows in parallel
                          │
                          └─ <EntityTable /> ── generic, dumb renderer
```

The only non-generic thing is the **registry**. Everything else (query,
pagination, rendering) is driven by it.

## 6. The registry

A single allowlist config file: `lib/entity-explorer/registry.ts`. Each entry
declares how to show one entity. Per entity:

| Field | Purpose |
|---|---|
| `key` | URL slug, e.g. `"pods"` |
| `label` | UI display name, e.g. "Pods" |
| `table` | Supabase table name |
| `columns` | Ordered list of columns to display (explicit — not `select *`) |
| `labelField` | Which column represents the row in a FK reference (e.g. `name`) |
| `cycleScoped` | Whether the global cycle filter applies (has a `cycle_id`) |
| `softDeleteColumn` | `removed_at` / `left_at` / `revoked_at` / none |
| `foreignKeys` | Map of column → target entity key, for click-through |
| `defaultSort` | Column + direction for the initial view |

**Explicit allowlist, not schema reflection.** We list entities and columns by
hand rather than auto-reflecting the schema. This means a future migration can't
silently surface an internal-only table or a newly-added sensitive column in the
UI — a new entity appears only when someone adds a registry entry.

### Entities in scope for v1

Drawn from `SCHEMA.md` (~18 tables). v1 ships the operational/domain entities;
the rest can be added one registry line at a time.

| Entity | Table | Cycle-scoped | Soft-delete col | Notable FKs |
|---|---|---|---|---|
| Cycles | `cycles` | — | — | — |
| Participants | `participants` | — | — | — |
| Cycle enrollments | `cycle_enrollments` | yes | `status` flag | `participant_id`, `cycle_id` |
| Problem statements | `problem_statements` | yes | — | `cycle_id`, `participant_id` |
| Votes | `votes` | yes | — | `voter_id`, `problem_statement_id` |
| Pods | `pods` | yes | — | `cycle_id` |
| Pod memberships | `pod_memberships` | — | `left_at` | `participant_id`, `pod_id` |
| Moderator assignments | `moderator_assignments` | yes | `removed_at` | `participant_id`, `pod_id`, `cycle_id` |
| Solution proposals | `solution_proposals` | yes | — | `cycle_id`, `pod_id`, `participant_id` |
| Project votes | `project_votes` | yes | — | `voter_id`, `solution_proposal_id` |
| Projects | `projects` | yes | — | `cycle_id`, `pod_id`, `solution_proposal_id` |
| Project memberships | `project_memberships` | — | — | `participant_id`, `project_id` |
| User roles | `user_roles` | — | `revoked_at` | `participant_id` |
| Pulse checks | `pulse_checks` | yes | — | `participant_id`, `cycle_id` |

> Access note: organizers are equated to admins, who already see all of this, so
> there are **no per-column visibility rules** — the registry governs *display*
> (which columns, labels, FK targets), never *access*. Participant PII (email,
> name, Google ID) is shown.

## 7. Route & file layout

All new code is contained in two folders.

```
app/(dashboard)/admin/explore/
  page.tsx            # RSC: reads ?entity, ?cycle, ?page; guards; fetches; renders
  entity-table.tsx    # Client/server component: generic table + pagination controls
  entity-picker.tsx   # Entity dropdown + cycle filter + show-deleted toggle
  env-banner.tsx      # "DEV" / "PROD" banner

lib/entity-explorer/
  registry.ts         # the allowlist config (§6)
  fetch.ts            # generic fetch: base rows + parallel FK-label resolution + pagination
  types.ts            # EntityConfig, EntityRow, etc. (module-internal only)
```

URL shape: `/admin/explore?entity=pods&cycle=3&page=1&deleted=0`. State lives in
the URL (shareable, no persistence layer needed).

> We nest under `/admin/explore` because it's behind the admin guard and the
> `(dashboard)` layout already gives us the nav shell and auth redirect — but the
> code is otherwise standalone and imports nothing from the sibling admin pages.

## 8. Auth

Equate organizers to admins. Reuse the existing guard exactly as the moderator
and admin pages do:

```ts
import { withAdminAuth } from "@/lib/auth/middleware"; // or isAdmin() in the RSC
```

Because the explorer uses the **service-role client** (it must, to see across all
participants — RLS would hide rows), the route guard is the *only* thing
protecting every row in the database. So:

- The page RSC checks `isAdmin(userRoles)` and redirects/403s otherwise.
- No new role, no new permission. `isAdmin` = has `cycles:write` (owner/admin/
  developer presets).
- Read-only means no mutation surface to protect beyond the read guard.

## 9. Data fetching

`lib/entity-explorer/fetch.ts`, mirroring the participants page pattern:

1. Look up `registry[entity]`; 404 if not an allowlisted key.
2. `createServiceClient().from(table).select(columns).range(...)` for the current
   page (server-side pagination, e.g. 50 rows/page). Apply `cycle_id` filter when
   `cycleScoped` and a cycle is selected.
3. **Soft-delete:** by default filter `softDeleteColumn IS NULL`; a "Show deleted"
   toggle includes them with a visual strike/badge.
4. **FK label resolution:** collect FK ids on the page, batch-fetch the target
   tables' `labelField` in parallel (`.in("id", ids)`), join in memory. A
   `pod_id` then renders as the pod name, linking to
   `/admin/explore?entity=pods&...`.
5. **JSONB columns** (`proposal_data`, pulse `responses`): render as a collapsed,
   pretty-printed block — no special parsing.

No ORM; raw `supabase-js`, consistent with the rest of the app.

## 10. Dev vs prod

The same code serves both. `createServiceClient()` reads the deployment's own
`SUPABASE_SERVICE_ROLE_KEY` / URL, so the dev deploy points at dev
(`cethihabtddiujzayaxe`) and prod at prod (`cdbgkgkjnomjnpicaxqe`) with zero
branching. The only environment-aware element is a **banner** (`env-banner.tsx`)
that reads the Supabase URL / a `VERCEL_ENV`-style var and shows a clear
**DEV** (muted) or **PROD** (red) label, so an organizer never confuses the two.

No migrations, so there's nothing to apply per environment — it ships the moment
the code deploys.

## 11. UI surface (v1)

- Top bar: entity dropdown · cycle filter · "Show deleted" toggle · env banner.
- Table: explicit columns from the registry, FK cells as links, JSONB cells
  collapsed, soft-deleted rows badged.
- Footer: prev/next pagination + "rows X–Y".

That's the whole surface. Per-column search and free-text filter are explicitly
v2.

## 12. Implementation plan (when we proceed)

Each step is independently reviewable.

1. **Registry + types** (`lib/entity-explorer/registry.ts`, `types.ts`) — define
   `EntityConfig` and populate the ~14 entities from §6. No UI yet; this is the
   reviewable contract.
2. **Generic fetch** (`fetch.ts`) — base query, pagination, cycle filter,
   soft-delete filter, FK-label batch resolution. Unit-testable in isolation.
3. **Route + table** (`explore/page.tsx`, `entity-table.tsx`, `entity-picker.tsx`)
   — wire the registry + fetch into a guarded RSC and the generic renderer.
4. **Env banner + nav link** (`env-banner.tsx`, one nav entry) behind
   `ENTITY_EXPLORER_ENABLED`.
5. **Verification** — `tsc --noEmit` + eslint clean; manual pass on dev against a
   real cycle (every entity loads, FK links resolve, deleted toggle works,
   pagination works); confirm the banner reads correctly on a prod-pointing
   build before exposing it.

Estimated: ~1 day for a solid read-only v1.

## 13. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Service-role client = the guard is the only protection | Single `isAdmin` gate on one route; read-only; no mutation surface. |
| A migration silently exposes a new sensitive table/column | Explicit allowlist registry — nothing appears without a registry edit. |
| Organizer confuses dev and prod | Mandatory env banner (red PROD). |
| Large tables (votes, pulse_checks) slow the page | Server-side pagination from day one; never fetch unbounded. |
| Feature outlives its welcome / hard to remove | Self-contained folders + flag + 3-step removal checklist (§4). |

## 14. Out of scope / future

- Per-column search, free-text filter, multi-column sort.
- Saved views / persisted filters (would need a table — avoided deliberately).
- Any write/edit capability.
- Row detail drill-down pages (v1 is list + FK link-hopping only).
- Export to CSV.

These are intentionally deferred — if we need them, we're probably ready to build
the real admin instead of extending the stopgap.
