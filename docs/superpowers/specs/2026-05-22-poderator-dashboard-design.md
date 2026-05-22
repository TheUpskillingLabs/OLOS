# Poderator Dashboard — Implementation Design

| | |
|---|---|
| Date | 2026-05-22 |
| PRD | [`docs/PRD-moderator-dashboard.md`](../../PRD-moderator-dashboard.md) |
| CLAUDE.md | [`docs/poderator-dashboard/CLAUDE.md`](../../poderator-dashboard/CLAUDE.md) |
| Phase | 1 of 2 — core dashboard (Phase 2 = LLM aggregations) |

---

## Scope

Phase 1 ships a fully functional poderator dashboard excluding §7.9 (pulse-check aggregations). No aggregation UI renders in Phase 1 — no empty states, no placeholders. The `pulse_themes` table is created in migrations so Phase 2 can populate it without schema changes.

**In scope:**
- DB migrations 00019–00022
- All Pods view (`/moderator`) — replace existing stub
- Per-pod view (`/moderator/pods/[pod_id]`) — new page
- Pod status header, at-risk nudges, member roster, pulse review side panel, phase guidance, pod resources
- Nudge dismissal (API + button)
- UI state persistence (switcher last-view, roster filter/sort, tooltip suppression)
- Tooltip layer (auto-suppress after 1–2 encounters per key)

**Out of scope (Phase 2):**
- §7.9 pulse-check aggregations (individual, pod-level, cross-pod)
- LLM theme extraction pipeline
- `pulse_check_aggregates` materialized view

---

## Architecture

**Approach: Server-first (RSC + API routes)**

RSC pages fetch all initial data server-side via the Supabase server client. Interactive islands are Client Components that call API routes on demand. Client Components never access Supabase directly.

The pod switcher navigates between routes (route change = server re-render with correct auth-scoped data). Roster filters live in client React state and are persisted to `moderator_ui_state` via API on change.

### Pages

```
app/(dashboard)/moderator/
  page.tsx                          ← All Pods view (RSC) — replace stub
  pods/[pod_id]/page.tsx            ← Per-pod view (RSC) — new
  cycles/[cycle_id]/vote-progress/  ← untouched
```

### API routes

```
app/api/moderator/
  pods/route.ts                                         GET — all assigned pods
  pods/[pod_id]/route.ts                                GET — single pod detail
  pods/[pod_id]/pulse-responses/[participant_id]/route.ts  GET — side panel data
  pods/[pod_id]/insights/route.ts                       GET — scaffolded, returns {} (Phase 2)
  insights/route.ts                                     GET — scaffolded, returns {} (Phase 2)
  nudges/dismiss/route.ts                               POST — dismiss a nudge
  ui-state/route.ts                                     GET + PUT — switcher/filter/tooltip state
```

All routes use `withAuth` from `lib/auth/middleware.ts`. Pod-scoped routes verify `userRoles.moderatorPodIds.includes(pod_id)` unless the caller is an admin.

### DB migrations

| File | Table | Phase |
|---|---|---|
| `00019_nudge_dismissals.sql` | `nudge_dismissals` | 1 |
| `00020_moderator_ui_state.sql` | `moderator_ui_state` | 1 |
| `00021_pulse_themes.sql` | `pulse_themes` | 1 (populated Phase 2) |
| `00022_cycle_config_extensions.sql` | alter `cycle_config` | 1 |

---

## Components

### All Pods view (`/moderator`)

| Component | Type | Responsibility |
|---|---|---|
| `PodSwitcher` | Client | Tab/dropdown for All Pods + per-pod navigation. Receives `lastView` as prop from RSC page (already fetched server-side). Writes to `ui-state` API on change. Reflects selection in URL. |
| `NudgeList` | Server | Cross-pod at-risk nudge cards, each with a `NudgeDismissButton` (Client). Capped at 3 visible; "N more" affordance. |
| `PodSummaryGrid` | Server | Card per assigned pod: name, status, health indicator + trend arrow. Links to per-pod view. |

### Per-pod view (`/moderator/pods/[pod_id]`)

| Component | Type | Responsibility |
|---|---|---|
| `PodSwitcher` | Client | Same component as All Pods view. |
| `PodStatusHeader` | Server | Pod name, cycle name, pod status badge, current phase + timestamps + countdown, health indicator + trend arrow. Suppresses health indicator for `forming`/`inactive` pods. |
| `NudgeList` | Server | At-risk nudges scoped to this pod. Same component as All Pods view. |
| `MemberRoster` | Client | Filter (by pulse status), search (by name), sort (default: at-risk → late → pending → current). Persists state to `ui-state` API on change. Exposes inline Slack DM link and pulse review trigger per row. |
| `PulseReviewPanel` | Client | Sheet/drawer. Opens on roster row action without navigation. Fetches `GET …/pulse-responses/[participant_id]` on open. Displays per-week responses (last 4 weeks default). Navigation between members re-fetches without closing. |
| `PhaseGuidance` | Server | Plain-English phase description, deadlines, phase-specific signal block (varies by phase). |
| `PodResources` | Server | Slack, Drive, GitHub, Google Group deep links. "Missing — contact staff" affordance for unprovisioned resources. |

### Shared primitives

Check `app/components/ui` before building: Sheet/Drawer, Tooltip, Badge, StatusBadge (already exists).

### Tooltip auto-suppress

RSC page passes `tooltip_seen: string[]` from `moderator_ui_state` to Client Components as a prop. Client shows tooltip if key not in `tooltip_seen` (up to 2 times per key). On auto-suppress: `PUT /api/moderator/ui-state` with updated `tooltip_seen`. A `?` icon remains visible to re-trigger on demand.

Tooltip targets: pod-health indicator, trend arrow, engagement-status badges, at-risk nudge type, phase guidance section header.

---

## Data fetching

### All Pods page — server-side

- `moderator_assignments` (or all pods if admin) → pod IDs
- `pods + cycles` → pod name, status, cycle name, phase, timestamps
- `pulse_checks + cycle_config` → missed-pulse count per pod → health band + 3-week trend
- `nudge_dismissals` → filter dismissed nudges for this poderator
- `moderator_ui_state` → `tooltip_seen[]` passed to Client Components as prop

### Per-pod page — server-side

- `pods + cycles` → status header data
- `pod_memberships + participants + pulse_checks` → member roster with pulse status
- `cycle_enrollments` → inactive member filter
- `nudge_dismissals` → filter dismissed nudges
- `moderator_ui_state` → initial roster filter/sort + `tooltip_seen[]`
- `cycle_config` → band thresholds, at-risk miss threshold

### Client-side API calls (on demand)

- `GET …/pulse-responses/[participant_id]` — when pulse review panel opens
- `POST …/nudges/dismiss` — when poderator dismisses a nudge
- `PUT …/ui-state` — when filter/sort changes or tooltip is seen

---

## Auth

```ts
// RSC pages
const userRoles = await resolveUserRoles(serviceClient, user.id);
if (!isModerator(userRoles) && !isAdmin(userRoles)) redirect("/cycles");

// API routes (withAuth wrapper)
if (!isModerator(userRoles) && !isAdmin(userRoles)) return 403;
// Pod-scoped routes additionally:
if (!isAdmin(userRoles) && !userRoles.moderatorPodIds.includes(podId)) return 403;
```

Loss of assignment (`removed_at` set) takes effect immediately — next API call returns 403, next page navigation redirects.

---

## Edge cases

| Scenario | Behaviour |
|---|---|
| Lost assignment mid-session | Next API call → 403. Next navigation → redirect to `/cycles`. |
| Role stacking (poderator + participant) | Both nav links visible. No re-auth required. |
| Admin access | Sees all pods. `moderator_ui_state` applies (filter/sort/tooltip persistence). |
| Pulse review for non-assigned pod | `GET` returns 403. Panel shows error state. |
| `forming` / `inactive` pod | Health indicator suppressed; status explainer shown instead. No nudges. |
| Missing pod resource URL | "Missing — contact staff" affordance. No broken link. |
| No pod members | Roster shows `EmptyState`. No nudges possible. |
| `cycle_config` missing thresholds | Global defaults: warning ≥ 1, critical ≥ 3, at_risk_misses = 2. |
| Nudge re-triggers after dismissal | New `nudge_key` (includes epoch/occurrence). Requires new dismissal row. |
| More than 3 nudges | Cap at 3 visible; "N more" count affordance. |
| Member pulses after nudge fires | Nudge disappears on next page load. No real-time update needed. |
| First-time poderator (no ui-state row) | Multi-pod → `/moderator`. Single-pod → `/moderator/pods/[id]`. Row created on first PUT. |
| `last_view` points to unassigned pod | Fall back to default landing. No 403 on redirect. |
| `ui-state` PUT fails | Silent failure. Filters work locally; won't persist. No error toast. |

---

## Naming convention

| Layer | Term |
|---|---|
| User-facing UI (copy, titles, badges) | **Poderator** |
| Code, DB, API paths | **moderator** |

Never use "poderator" in code. Never expose "moderator" in UI copy.
