# Poderator Dashboard — Implementation Design

| | |
|---|---|
| Date | 2026-05-22 |
| PRD | [`docs/PRD-moderator-dashboard.md`](../../PRD-moderator-dashboard.md) |
| CLAUDE.md | [`docs/poderator-dashboard/CLAUDE.md`](../../poderator-dashboard/CLAUDE.md) |
| Phase | Single phase — no internal LLM, no Phase 2 deferred work |

---

## Scope

The full poderator dashboard ships in one go. No LLM runs inside OLOS for this feature: all free-text analysis happens in the poderator's own AI tool, fed by an in-dashboard "Copy prompt + responses" block (§7.10.3). Pulse-check aggregations cover structured fields only (AI tool counts, pulse-completion rates).

**In scope:**
- DB migrations 00023–00026 (see DB migrations table below)
- All pods view (`/moderator`) — replace existing stub. Includes nudge list, pod summary cards (§7.10.1), members-needing-attention rollup (§7.10.2), cross-pod insights (§7.9.3), AI-assisted summary block (§7.10.3)
- Per-pod view (`/moderator/pods/[pod_id]`) — new page. Includes pod status header, at-risk nudges, member roster, pulse review side panel, pod-level insights (§7.9.2), AI-assisted summary block (§7.10.3), phase guidance, pod resources
- Nudge dismissal (API + button on every nudge)
- UI state persistence (switcher last-view, roster filter/sort, tooltip suppression)
- Tooltip layer (auto-suppress after 1–2 encounters per key)
- Member preview shape: `ai_experience_level` enum + `availability_snippet` on `participants` (§7.3.1)
- AI summary prompt string stored on `cycle_config` with global default

**Explicitly NOT in scope (no LLM in OLOS):**
- LLM theme extraction pipeline
- `pulse_themes` table
- `pulse_check_aggregates` materialized view
- Server-side LLM calls of any kind for this dashboard

---

## Architecture

**Approach: Server-first (RSC + API routes)**

RSC pages fetch all initial data server-side via the Supabase server client. Interactive islands are Client Components that call API routes on demand. Client Components never access Supabase directly.

The pod switcher navigates between routes (route change = server re-render with correct auth-scoped data). Roster filters live in client React state and are persisted to `moderator_ui_state` via API on change.

### Pages

```
app/(dashboard)/moderator/
  page.tsx                          ← All pods view (RSC) — replace stub
  pods/[pod_id]/page.tsx            ← Per-pod view (RSC) — new
  cycles/[cycle_id]/vote-progress/  ← untouched
```

### API routes

```
app/api/moderator/
  pods/route.ts                                         GET — all assigned pods
  pods/[pod_id]/route.ts                                GET — single pod detail
  pods/[pod_id]/pulse-responses/[participant_id]/route.ts  GET — side panel data
  pods/[pod_id]/insights/route.ts                       GET — pod-level structured aggregates (§7.9.2) + recent pulse comments for AI summary block
  insights/route.ts                                     GET — cross-pod structured aggregates (§7.9.3) + recent pulse comments for AI summary block
  nudges/dismiss/route.ts                               POST — dismiss a nudge
  ui-state/route.ts                                     GET + PUT — switcher/filter/tooltip state
```

All routes use `withAuth` from `lib/auth/middleware.ts`. Pod-scoped routes verify `userRoles.moderatorPodIds.includes(pod_id)` unless the caller is an admin.

### DB migrations

| File | Table / change |
|---|---|
| `00023_nudge_dismissals.sql` | new table `nudge_dismissals` |
| `00024_moderator_ui_state.sql` | new table `moderator_ui_state` |
| `00025_participants_ai_experience.sql` | alter `participants`: add `ai_experience_level` enum (`new`, `consumer`, `builder`, `shipper`) defaulting to `new`; add `availability_snippet text` |
| `00026_cycle_config_extensions.sql` | alter `cycle_config`: add pod-health band thresholds, at-risk miss threshold, default aggregation window, and `ai_summary_prompt text` (canonical prompt for §7.10.3) |

---

## Components

### All pods view (`/moderator`)

| Component | Type | Responsibility |
|---|---|---|
| `PodSwitcher` | Client | Tab/dropdown for All pods + per-pod navigation. Receives `lastView` as prop from RSC page (already fetched server-side). Writes to `ui-state` API on change. Reflects selection in URL. |
| `NudgeList` | Server | Cross-pod at-risk nudge cards, each with a `NudgeDismissButton` (Client). Capped at 3 visible; "N more" affordance. Per-poderator dismissal persisted via `nudge_dismissals`. |
| `PodSummaryGrid` | Server | Card per assigned pod (§7.10.1): name, status, cycle phase + week, headline pulse-health figure, three-week trend arrow. Links to per-pod view. Sorted: pods with non-zero at-risk count first, then alphabetical. Hidden for single-pod poderators. |
| `MembersNeedingAttentionRollup` | Server | Four-KPI block (§7.10.2): pulsing-this-week, at-risk, pulses-this-period, engagement-trend. Hidden for single-pod poderators. |
| `CrossPodInsights` | Server | §7.9.3 structured aggregates only: AI tool adoption by pod (grid) + engagement comparison (mini-trends). Suppressed entirely for single-pod poderators. |
| `AISummaryBlock` | Client | §7.10.3. Receives bundled pulse comments + canonical prompt string as props (assembled server-side). Renders preview of comments and "Copy prompt + responses" button. Clipboard copy is client-only; no API call. Same component shared with per-pod view. |

### Per-pod view (`/moderator/pods/[pod_id]`)

| Component | Type | Responsibility |
|---|---|---|
| `PodSwitcher` | Client | Same component as All pods view. |
| `PodStatusHeader` | Server | Pod name, cycle name, pod status badge, current phase + open and close timestamps + countdown, health indicator + trend arrow. Suppresses health indicator for `forming`/`inactive` pods. |
| `NudgeList` | Server | At-risk nudges scoped to this pod. Same component as All pods view. |
| `MemberRoster` | Client | Filter (by pulse status and by `ai_experience_level`), search (by name), sort (default: at-risk → late → pending → current; AI experience as alternate sort). Persists state to `ui-state` API on change. Exposes pulse-review and Slack DM affordances per row. |
| `PulseReviewPanel` | Client | Sheet/drawer. Opens on roster row action without navigation. Fetches `GET …/pulse-responses/[participant_id]` on open. Displays per-week responses (last 4 weeks default with "Show full cycle history" expand). Member N of M navigation re-fetches without closing. Footer shows read-only stance + Open Slack DM. |
| `PodInsights` | Server | §7.9.2 structured aggregates: top AI tools across the pod + pulse-completion trend (week-by-week). No themes. |
| `AISummaryBlock` | Client | §7.10.3. Same component as All pods view. Bundle is scoped to this pod's pulse comments. |
| `PhaseGuidance` | Server | Plain-English phase description, deadlines (close + next-open), phase-specific signal block (varies by phase — solution-proposal phase lists submitter identities). |
| `PodResources` | Server | Slack, Drive, GitHub, Google Group deep links. "Missing — contact staff" affordance for unprovisioned resources. |

### Shared primitives

Check `app/components/ui` before building: Sheet/Drawer, Tooltip, Badge, StatusBadge (already exists).

### Tooltip auto-suppress

RSC page passes `tooltip_seen: string[]` from `moderator_ui_state` to Client Components as a prop. Client shows tooltip if key not in `tooltip_seen` (up to 2 times per key). On auto-suppress: `PUT /api/moderator/ui-state` with updated `tooltip_seen`. A `?` icon remains visible to re-trigger on demand.

Tooltip targets: pod-health indicator, trend arrow, engagement-status badges, at-risk nudge type, phase guidance section header.

---

## Data fetching

### All pods page — server-side

- `moderator_assignments` (or all pods if admin) → pod IDs
- `pods + cycles` → pod name, status, cycle name, phase, timestamps
- `pulse_checks + cycle_config` → missed-pulse count per pod → health band + 3-week trend
- `pulse_checks` AI-tool selections → cross-pod AI tool adoption (§7.9.3)
- `pulse_checks` completion counts → engagement comparison + members-needing-attention KPIs
- `pulse_checks` free-text fields (last 4 weeks, members shown by initials only) → bundled into `AISummaryBlock` props alongside `cycle_config.ai_summary_prompt`
- `nudge_dismissals` → filter dismissed nudges for this poderator
- `moderator_ui_state` → `tooltip_seen[]` passed to Client Components as prop

### Per-pod page — server-side

- `pods + cycles` → status header data (incl. open + close timestamps for current phase)
- `pod_memberships + participants + pulse_checks` → member roster with pulse status. `participants.ai_experience_level` + `availability_snippet` join into the row preview
- `cycle_enrollments` → inactive member filter
- `pulse_checks` AI-tool selections → top tools for this pod (§7.9.2)
- `pulse_checks` completion counts → weekly completion trend
- `pulse_checks` free-text fields (last 4 weeks for this pod's members, shown by initials) → bundled into `AISummaryBlock` props
- `nudge_dismissals` → filter dismissed nudges
- `moderator_ui_state` → initial roster filter/sort + `tooltip_seen[]`
- `cycle_config` → band thresholds, at-risk miss threshold, AI summary prompt string

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
