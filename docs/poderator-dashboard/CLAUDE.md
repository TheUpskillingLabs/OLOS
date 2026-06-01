# Poderator Dashboard — Claude Code Context

Read this before touching anything under `app/(dashboard)/moderator/`,
`app/api/moderator/`, or any migration that creates the tables listed in §New
DB tables below.

---

## Naming convention — UI vs. internal

| Layer | Term | Example |
|---|---|---|
| User-facing UI | **Poderator** | Page title, role badge, tooltips, copy |
| Internal code & DB | **moderator** | `isModerator()`, `moderatorPodIds`, `moderator_assignments`, route paths |

Never expose "moderator" to users in copy. Never use "poderator" in code,
table names, column names, or API paths. The split is intentional and final.

---

## Relevant docs

- PRD: [`docs/PRD-moderator-dashboard.md`](../PRD-moderator-dashboard.md) —
  functional requirements, decisions log, data model implications. **This is
  the source of truth for what to build.**
- Mockups: [`docs/PRD-moderator-dashboard-mockups.html`](../PRD-moderator-dashboard-mockups.html) —
  open in a browser. Three screens: All pods view, Per-pod view, Pulse review
  panel.
- Auth: [`lib/auth/CLAUDE.md`](../../lib/auth/CLAUDE.md) — role resolution,
  `UserRoles` shape, `withAuth` wrappers. Read before touching any guarded
  route.
- Architecture: [`docs/OLOS-architecture-brief.md`](../OLOS-architecture-brief.md)

---

## What already exists

| File | What it does | Relationship to Poderator dashboard |
|---|---|---|
| `app/(dashboard)/moderator/page.tsx` | Basic pod listing — shows assigned pods grouped by cycle, links to `/pods/[id]` | **The All pods view stub.** Replace with the full Poderator All pods view (§6, §7.2, §7.7, §7.9.3 of PRD). Keep the auth guard pattern. |
| `app/(dashboard)/moderator/cycles/[cycle_id]/vote-progress/page.tsx` | Vote progress for a cycle | Survives as-is. The per-pod phase guidance (§7.5) will surface similar data inline. |
| `app/(dashboard)/pods/[pod_id]/pulse-check-dashboard.tsx` | Pulse-check data for a pod | Read this before building the member roster (§7.3) and pod-level aggregations (§7.9.2). May be extractable. |
| `app/api/pods/[pod_id]/members/route.ts` | Pod member list | Reuse for the member roster. Check the response shape before building the roster component. |
| `app/api/pods/[pod_id]/moderators/route.ts` | Moderator assignment read/write | Already exists. Don't duplicate. |

---

## Route structure

All Poderator routes live inside `app/(dashboard)/` (the existing layout group
with the shared nav). Do **not** create a separate `(moderator)` route group —
the `(dashboard)` layout already provides the nav shell and auth redirect.

| URL | File | Description |
|---|---|---|
| `/moderator` | `app/(dashboard)/moderator/page.tsx` | All pods view (replace the stub) |
| `/moderator/pods/[pod_id]` | `app/(dashboard)/moderator/pods/[pod_id]/page.tsx` | Per-pod dashboard |

The PRD §8 originally specified `/pods/[id]/moderator`. Use
`/moderator/pods/[id]` instead — it groups all poderator routes under a
single prefix, which is cleaner for the layout and the guard.

URL reflects the active pod so poderator-to-poderator links deep-link
correctly (PRD §7.7).

### API routes to create

| Method + path | Purpose |
|---|---|
| `GET /api/moderator/pods` | All pods for the authed poderator (wraps `moderator_assignments`). Admins get all pods. |
| `GET /api/moderator/pods/[pod_id]` | Single pod detail + phase signal + member roster with pulse status |
| `GET /api/moderator/pods/[pod_id]/pulse-responses/[participant_id]` | Per-member pulse history for the side panel (§7.4). Returns 403 if caller is not assigned to the pod. |
| `GET /api/moderator/pods/[pod_id]/insights` | Pod-level aggregations (§7.9.2): top tools, stuck-on themes, help themes, completion trend |
| `GET /api/moderator/insights` | Cross-pod aggregations (§7.9.3): patterns across all assigned pods |
| `POST /api/moderator/nudges/dismiss` | Dismiss a nudge instance. Body: `{ pod_id, nudge_key }`. Writes to `nudge_dismissals`. |
| `GET /api/moderator/ui-state` | Last-selected switcher view + roster filter/sort state |
| `PUT /api/moderator/ui-state` | Persist switcher selection, roster filter, tooltip suppression keys |

All routes use the `withAuth` wrapper from `lib/auth/middleware.ts`. Check
`isModerator(userRoles)` or `isAdmin(userRoles)` and return 403 otherwise.
For pod-scoped routes, verify the caller's `userRoles.moderatorPodIds`
includes the requested `pod_id` (or caller is admin).

---

## Auth integration

Use the existing patterns from `lib/auth/`:

```ts
import { withAuth } from "@/lib/auth/middleware";
import { isModerator, isAdmin } from "@/lib/auth/roles";

export const GET = withAuth(async (req, { userRoles }) => {
  if (!isModerator(userRoles) && !isAdmin(userRoles)) {
    return new Response("Forbidden", { status: 403 });
  }
  // pod-scoped check:
  const podId = Number(params.pod_id);
  if (!isAdmin(userRoles) && !userRoles.moderatorPodIds.includes(podId)) {
    return new Response("Forbidden", { status: 403 });
  }
  // ...
});
```

`userRoles.moderatorPodIds` is the list of pod IDs from active
`moderator_assignments` rows. It is resolved fresh on every request —
loss of assignment takes effect immediately (PRD §8).

---

## New DB tables

Next migration number: **00019** (latest is `00018_solution_proposals_rich_fields.sql`).
Split into logical migration files; don't bundle everything in one.

### `nudge_dismissals`

```sql
create table nudge_dismissals (
  id            bigint generated always as identity primary key,
  moderator_participant_id bigint not null references participants(id),
  pod_id        bigint not null references pods(id),
  nudge_key     text   not null,   -- e.g. "at_risk:{participant_id}"
  dismissed_at  timestamptz not null default now(),
  unique (moderator_participant_id, pod_id, nudge_key)
);
```

A dismissed nudge re-fires if the condition re-triggers (PRD §7.2). The
`nudge_key` encodes the instance: when a member re-trips the at-risk
threshold after recovery, a new `nudge_key` is generated (e.g. suffix with
epoch or occurrence count).

### `moderator_ui_state`

```sql
create table moderator_ui_state (
  participant_id  bigint primary key references participants(id),
  last_view       text,   -- 'all_pods' | pod_id as text
  roster_filters  jsonb,  -- { status: string[], search: string }
  roster_sort     text,   -- column key
  tooltip_seen    text[]  -- tooltip keys auto-suppressed after 1–2 views
);
```

Upsert on every PUT. One row per poderator.

### `pulse_themes`

```sql
create table pulse_themes (
  id                    bigint generated always as identity primary key,
  scope_type            text not null check (scope_type in ('individual','pod','cross_pod')),
  scope_id              bigint not null,  -- participant_id, pod_id, or moderator participant_id
  scope_window_start    date not null,
  scope_window_end      date not null,
  source_field          text not null check (source_field in ('stuck_on','help_needed','what_went_well')),
  theme_label           text not null,
  member_count          int  not null default 0,
  mention_count         int  not null default 0,
  contributing_pulse_ids bigint[] not null default '{}',
  generated_at          timestamptz not null default now()
);
create index on pulse_themes (scope_type, scope_id, scope_window_start, scope_window_end);
```

Themes are written by a server action / cron that runs after each pulse
window closes. They are read-only from the dashboard.

### `cycle_config` extensions

Add columns to the existing `cycle_config` table (or wherever cycle-level
config lives — check the schema before writing the migration):

```sql
-- Pod-health indicator band thresholds
alter table cycle_config
  add column if not exists pulse_band_warning_min  int default 1,
  add column if not exists pulse_band_critical_min int default 3,
  -- At-risk nudge threshold
  add column if not exists at_risk_consecutive_misses int default 2,
  -- Default aggregation window (weeks)
  add column if not exists pulse_agg_default_weeks int default 4;
```

Global defaults (1/3/2/4) apply when the cycle hasn't set its own values
(PRD §7.1, §7.2).

---

## Existing tables consumed (no schema changes)

| Table | Used for |
|---|---|
| `moderator_assignments` | Which pods a poderator is assigned to; `removed_at IS NULL` filter |
| `pods` | Pod name, status, cycle_id, resource URLs (Slack, Drive, GitHub, Google Group) |
| `cycles` | Cycle name, current phase, phase open/close timestamps |
| `pod_memberships` | Member roster; `cycle_enrollments.status` for inactive filter |
| `participants` | Member profile fields (tiered visibility — see PRD §7.3) |
| `pulse_checks` | Per-member, per-week submissions for the roster status and pulse review |
| `cycle_enrollments` | Active/inactive status per member per cycle |

---

## PRD decisions to carry forward

These were explicitly decided and should not be re-litigated without a new
decision entry in `docs/PRD-moderator-dashboard.md §10`:

| Topic | Decision |
|---|---|
| Pod-health bands | Absolute headcount, not percentage. Configurable per cycle. |
| Nudges in v1 | At-risk only (consecutive miss threshold). System flags; no automated outreach. |
| Multi-pod poderators | First-class. All pods view is the default landing. |
| Inactive members | Hidden by default; "Show inactive" toggle. |
| Profile visibility | Four tiers (always/hover/click-through/never). See PRD §7.3. |
| Pulse aggregation | Three scopes: individual (side panel), pod-level (per-pod page), cross-pod (All pods). LLM themes for free-text fields. |
| Auto-flip | Disabled for the current cycle. Don't activate it from dashboard logic. |
| No in-product walkthrough | Tooltips only (UI mechanics). Programmatic orientation is handbook + kickoff. |

---

## Component hints

- The **pod switcher** (§7.7) and the **All pods / per-pod view toggle** are
  the same control. Render it as a dropdown or tab row at the top of the page.
  Persist the last selection via `PUT /api/moderator/ui-state`.
- The **pulse review side panel** (§7.4) opens without navigating. Use a
  sheet/drawer component (check `app/components/ui` for existing primitives
  before building new ones).
- The **engagement trajectory sparkline** (§7.9.1) is a dot row, not a chart
  library — filled dot = submitted, outlined dot = missed.
- The **completion trend bars** (§7.9.2, §7.9.3) are simple `<div>` bars with
  inline `height` percentages, as in the mockup. No chart library needed.
- Tooltips (§7.8): auto-suppress after 1–2 encounters per key. Store seen keys
  in `moderator_ui_state.tooltip_seen[]`. Always show a `?` icon so the
  poderator can re-trigger.

---

## What to build first

Suggested order — each step is independently shippable:

1. **Migrations** (`00019`+) — `nudge_dismissals`, `moderator_ui_state`,
   `pulse_themes`, `cycle_config` extensions.
2. **All pods view** — replace the existing `moderator/page.tsx` stub with the
   full page: pod cards with health indicator, cross-pod nudge list, switcher.
3. **Per-pod view** — new `moderator/pods/[pod_id]/page.tsx`: status header,
   at-risk nudge, member roster with filter/search/sort, phase guidance, pod
   resources.
4. **Pulse review side panel** — per-member pulse history + individual
   aggregation block (§7.9.1). Opens from roster row.
5. **Pod-level pulse insights** (§7.9.2) — themes + completion trend on the
   per-pod page.
6. **Cross-pod pulse insights** (§7.9.3) — patterns + tool grid + engagement
   comparison on the All pods view.
7. **Nudge dismissal** — `POST /api/moderator/nudges/dismiss` + dismiss button
   on each nudge card.
8. **UI state persistence** — switcher last-view, roster filter/sort, tooltip
   suppression.
9. **Tooltip layer** — attach to pod-health indicator, trend arrow, status
   badges, nudge type, phase guidance header.
