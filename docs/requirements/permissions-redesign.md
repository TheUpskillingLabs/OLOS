# Requirements — Authorization & Permissions Redesign

| | |
|---|---|
| **Status** | Draft — for review |
| **Author** | (you) |
| **Last updated** | 2026-06-17 |
| **Supersedes** | The PBAC model in `00009_permissions_model.sql` |
| **Related code** | `lib/auth/`, `supabase/migrations/00002`, `00009` |
| **Related docs** | [`local-labs.md`](./local-labs.md) (**prerequisite**), `lib/auth/CLAUDE.md`, `docs/personas.md` |
| **Pairs with** | This is **Change #2 of 2.** It depends on the `labs` entity from [`local-labs.md`](./local-labs.md) — the lab-admin tier scopes against `labs`. |

## Overview

OLOS authorization is being simplified from a granular permission model
(PBAC with role presets) to a **relationship-based model** where authority is a
**(role, scope) pair**. Roles:

- **admin** — held at one of three scopes: **super** (all labs), **lab** (one
  lab), or **cycle** (one cycle, which lives in a lab).
- **moderator** — scoped to a pod (`moderator_assignments`).
- **participant** — scoped to cycle/pod/project memberships.

Every check answers: *"Do you hold this role at a scope that covers this
entity?"* Scope hierarchy: `platform → lab → cycle → pod → project → membership`.

## Goals

- Three roles (admin scoped super/lab/cycle; moderator; participant).
- A single, obvious source of truth for each kind of authority; no drift.
- Keep the two-path enforcement the codebase already uses (AC-1).

## Non-goals

- Per-person custom permission grants (dropped — presets covered everyone).
- The `labs` entity + `lab_id` links themselves — see [`local-labs.md`](./local-labs.md).
- Changing the Google-OAuth sign-in flow or invitation delivery.

## Glossary

Authority is a **(role, scope)** pair. Admin is one role held at three scope
levels; moderator and participant are scoped by relationship rows.

| Term | Meaning |
|---|---|
| **super admin** | Platform-wide (all labs). The leadership team. Create labs/cycles, grant any admin, plus full powers everywhere. `role_assignments('admin','global', NULL)`. |
| **lab admin** | Admin of one lab. Sees all participants in their lab; runs that lab's cycles. Cannot touch other labs or platform config. `role_assignments('admin','lab', labId)`. |
| **cycle admin** | Admin of one cycle (within a lab; currently 2 people). Runs that cycle. `role_assignments('admin','cycle', cycleId)`. |
| **moderator** | Assigned to a (pod, cycle) via `moderator_assignments`. Authority over assigned pods only. |
| **participant** | Member of a cycle/pod/project (`cycle_enrollments`/`pod_memberships`/`project_memberships`). |

## The model

Authority is the union of:

1. `isSuperAdmin(user)` — a `role_assignments('admin','global')` row.
2. `isAdminOf(user, {labId})` — super admin **or** an `('admin','lab', labId)` row.
3. `isAdminOf(user, {cycleId, labId})` — super, **or** a `('admin','cycle', cycleId)`
   row, **or** lab admin of that cycle's lab. (The route already loads the cycle,
   so it passes the cycle's `lab_id`; no extra lookup.)
4. `isModeratorOf(user, {podId|cycleId})` — from `moderator_assignments`.
5. `isMemberOf(user, {cycleId|podId|projectId})` — from membership tables.

No permission strings, no role presets. Admin authority is one role recorded at
a scope; moderator/participant are relationship rows.

### Storage — `role_assignments` (admin tiers only)

    role_assignments(
      participant_id, role,
      scope_type,   -- 'global' | 'lab' | 'cycle'
      scope_id,     -- NULL for global, else the lab/cycle id
      granted_by, granted_at, revoked_at
    )
    UNIQUE (participant_id, role, scope_type, scope_id)   -- NULLS NOT DISTINCT

- super = `('admin','global', NULL)`; lab = `('admin','lab', L)`; cycle =
  `('admin','cycle', C)`.
- `scope_id` is intentionally **not** a foreign key (it points at labs *or*
  cycles depending on `scope_type`). A grant whose target was deleted simply
  matches nothing — harmless for authz — and a small cleanup (trigger or
  periodic job) prunes stale rows. This is the accepted trade for the
  flexible single-table shape.
- **Moderator and participant memberships stay in their existing tables** —
  they carry lifecycle state (assigned/removed, joined/left, enrollment status)
  that doesn't fit a generic grant row. `role_assignments` holds admin tiers
  only. The `(role, scope)` idea is the *mental* model, not one mega-table.

### Target `UserRoles` shape

    {
      userId: string;
      participantId: number | null;
      labId: number | null;        // participants.lab_id — the user's own lab
      isSuperAdmin: boolean;       // role_assignments ('admin','global')
      adminLabIds: number[];       // role_assignments ('admin','lab', L)
      adminCycleIds: number[];     // role_assignments ('admin','cycle', C)
      moderatorPodIds: number[];   // moderator_assignments
      moderatorCycleIds: number[]; // moderator_assignments.cycle_id
      cycleIds: number[];          // cycle_enrollments (status='active')
      podIds: number[];            // pod_memberships (inactive_at IS NULL)
      projectIds: number[];        // project_memberships (left_at IS NULL)
    }

### Check API (replaces the current helpers)

| Today | Becomes |
|---|---|
| `isAdmin(user)` on a cycle route | `isAdminOf(user, {cycleId, labId})` |
| `isAdmin(user)` on a lab route | `isAdminOf(user, {labId})` |
| `isAdmin(user)` / `isOwner(user)` on a platform route (create lab/cycle, grant admin) | `isSuperAdmin(user)` |
| `isModeratorForPod(user, podId)` | `isModeratorOf(user, {podId})` |
| `isActiveParticipant(user, cycleId)` | `isMemberOf(user, {cycleId})` |
| (none) | `isMemberOf(user, {podId})`, `isMemberOf(user, {projectId})` |

**Route gating keys off the route's scope:** `/api/cycles/[cycle_id]/*` →
`isAdminOf(user, {cycleId, labId})`; lab-management routes → `isAdminOf(user, {labId})`;
platform routes → `isSuperAdmin(user)`.

## Architecture constraints (cross-cutting)

- **AC-1 (two enforcement paths, named)** — There is no single enforcement
  layer, and that's fine: **service-role writes** (auth callback, role grants,
  invitation fulfillment — they bypass RLS by design) are guarded by the route
  wrapper; **session-client reads** are filtered by RLS. Rule of thumb: *if you
  add a service-role mutation, you must wrap it in a guard — the DB will not
  catch you.* AC-2 makes "forgetting the guard" hard. Full "RLS authoritative"
  was rejected: privileged paths can't be RLS-enforced, so it would mean writing
  every rule twice for a guarantee it can't fully deliver.
  **Standing exceptions (found on stress-test):** `registrations`,
  `registrations/short`, `auth/callback`, and both crons already do service-role
  writes guarded by **session / CRON_SECRET / invitation-state**, not by
  `withAdminAuth`. So the rule is really *"every service-role mutation is guarded by*
  ***something***" — not specifically a route wrapper. Keep those non-wrapper guards;
  they are correct (self-registration can't require admin).
- **AC-2 (one authz seam for decisions)** — Every authorization *decision*
  (route guards, write-gating, protected-page redirects) goes through a single
  module (`lib/auth/`): `isSuperAdmin(user)`, `isAdminOf(user, …)`,
  `isModeratorOf(user, …)`, `isMemberOf(user, …)`. *Display* (badge color,
  labels) goes through one read-only accessor, `primaryRole(user)` — not raw
  `user` field access. No authorization decision and no role identity is derived
  outside these two surfaces. Single grep target ⇒ a future tier/role is a
  one-module change.

## Functional requirements

### App layer (`lib/auth/`)

- **FR-1** `resolveUserRoles` reads `role_assignments` (→ `isSuperAdmin`,
  `adminLabIds`, `adminCycleIds`), `participants.lab_id` (→ `labId`),
  `moderator_assignments`, `cycle_enrollments`, `pod_memberships`,
  `project_memberships`. It no longer reads `participant_permissions`.
- **FR-2** Delete `permissions.ts` (`PERMISSIONS`, `PERMISSION_GROUPS`,
  `ROLE_PRESETS`, `permissionLabel`, `activePresets`, `Permission` type) and the
  `permissions[]`/`can()` surface on `UserRoles`.
- **FR-3** Replace `withAdminAuth`/`withOwnerAuth` with scope-aware guards:
  `withSuperAdminAuth` (platform), `withLabAdminAuth` (resolves `lab_id`),
  `withCycleAdminAuth` (resolves the cycle + its `lab_id`, checks `isAdminOf`).
- **FR-4** Migrate every call site of `can`/`isAdmin`/`isOwner`/
  `isActiveParticipant`/`isModeratorForPod` to the Check API above.

### Role management endpoints & UI

- **FR-5** Replace `/api/roles/{admin,developer,observer}`, `/api/permissions`,
  `/api/permissions/preset` with a single "set role" action that writes
  `role_assignments`. Granting super/lab admin → super admins only; granting
  cycle admin → super or that lab's own admin (D-6, decided).
- **FR-6** Replace the permission-checklist editor and preset pickers with a
  role selector: super admin / lab admin + lab / cycle admin + cycle /
  moderator + pod / participant.
- **FR-7** Invitations carry a `role` + scope (`lab_id`/`cycle_id`/`pod_id`),
  not a `permissions[]`/`role_preset` pair. Acceptance writes the appropriate
  `role_assignments` / `moderator_assignments` / membership row.

### Schema & DB layer

- **FR-8 (schema)** Create `role_assignments` (shape above). It replaces the
  admin-bearing use of `user_roles`.
- **FR-9 (RLS — coarse; decided on stress-test)** Replace `has_permission()` /
  `is_admin_or_owner()` with **`is_super_admin()` + membership predicates**
  (`is_moderator_of_pod(pod)`, `current_participant_id()` self-checks). **RLS stays
  coarse: "are you an admin at all / is this row yours."** Per-lab / per-cycle scope
  is **not** enforced in RLS — it lives in the app seam (`isAdminOf`, AC-2) and the
  shared lab-scope query helper (Doc A, L-1). This matches AC-1 (RLS is not the
  authoritative scope wall) and avoids writing every scope rule twice. Drop all
  `participant_permissions` references from policies (`00002`,`00009`).
  *(Rejected: full `is_lab_admin(lab)`/`is_admin_of_cycle(cycle)` per-policy
  predicates — ~2× the work, can't cover service-role paths anyway.)*
- **FR-10 (migration)** After Doc A's lab backfill: create `role_assignments`;
  backfill **super admin** rows for current global-equivalent holders
  (owners/developers/observers/`cycles:write`); seed the 2 **cycle admin** rows;
  then drop `participant_permissions` once D-4 passes.
  **Scope reality (from the audit):** this is the largest surface — auth is
  **dual-track today** (`user_roles` **and** `participant_permissions`, plus
  *synthetic* moderator/participant roles derived from FK tables), **61 RLS
  policies** (47 in `00002` + 14 in `00009`), and ~**66 call sites across ~27
  files**. Note `is_admin_or_owner()` was already redefined in `00009` to mean
  `has_permission('cycles:write')`. Two hazards to handle explicitly:
  **(a)** synthetic moderator/participant stay derived (don't materialize into
  `role_assignments`); **(b) in-flight `pending` invitations** carry
  `permissions[]`/`role_preset` — drain or translate them before dropping the old
  model (see FR-7).

## Acceptance criteria

- A participant with only memberships does exactly what they do today.
- A super admin retains full access across all labs; no platform route opens up.
- A **lab admin can manage their lab but not another** — verified on a
  lab-scoped route with a foreign `lab_id` (expect 403), and they can see only
  their lab's participants.
- A **cycle admin can manage their cycle but not another**, and a lab admin can
  manage every cycle in their lab.
- A moderator's pod-scoped powers are unchanged.
- No code references `participant_permissions`, `ROLE_PRESETS`, or a permission
  string; no role identity is derived outside the authz seam.

## Capability matrix

### super admin — all labs, unconditional
| Area | Capability |
|---|---|
| Platform | Create/delete labs and cycles, platform config/options |
| Roles | Grant/revoke any admin (super, lab, cycle) |
| Everything below | All lab- and cycle-admin powers, across every lab |

### lab admin — scoped to their lab
| Area | Capability (within their lab only) |
|---|---|
| Lab | Run the lab; see **all participants in the lab** |
| Cycles | Full cycle-admin powers over **every** cycle in the lab |
| Roles | Grant cycle admin within the lab (D-6) |
| Excluded | Other labs, create labs, platform config, grant lab/super admin |

### cycle admin — scoped to their cycle(s)
| Area | Capability (within their cycle only) |
|---|---|
| Cycle | Configure, advance phase, change status |
| Participants | Manage enrollments, revoke/reactivate access |
| Pods / Projects | Create/rename/manage; finalize |
| Invitations | Create, send, view (for this cycle) |
| Assignments | Assign/remove moderators in this cycle |
| Excluded | Other cycles, the lab itself, platform config |

### moderator — scoped to assigned (pod, cycle)
| Area | Capability |
|---|---|
| Assigned pod | View, rename, run its workflow; manage its project votes; finalize |
| Assigned pod's people | View members + pulse-check status; moderator dashboard |
| Excluded | Cycles, other pods, roles, lab/platform concerns |

### participant — scoped to memberships
| Area | Capability |
|---|---|
| Visibility | Cycles/pods/projects they belong to + dashboards |
| Cycle phase | Submit problem statements, vote (when active) |
| Pod / Project phase | Register, submit proposals, vote; one active project/cycle |
| Engagement | Complete own pulse checks |

Roles stack: any admin may also hold a `moderator_assignments` row or a
membership; authority is the union.

## Rollout

Pre-launch app (auth still blocked on ops, no test infra, a handful of bootstrap
rows in prod). **Rollout is hybrid (decided 2026-06-17):** develop/test against a
**reset dev DB**, but apply to **prod as forward-only migrations *with* backfill**
— prod is **not** reset, so the backfill below is real. Ship as **phased PRs** in
dependency order (`labs → timeline → pod-registration → auth`), not one big-bang PR;
this auth change lands **last** (largest surface). Sequenced after Doc A's `labs`
migration:

- New authz module (`isSuperAdmin`/`isAdminOf`/`isModeratorOf`/`isMemberOf`
  + `primaryRole`) + `resolveUserRoles` surfacing scope/memberships; migrate all
  consumers off old helpers/role-strings.
- New RLS: `is_super_admin()`/`is_lab_admin()`/`is_admin_of_cycle()`
  (+ moderator/member predicates); lab-scope reads; drop `participant_permissions`.
- Schema + data: create `role_assignments`; backfill super admins + seed the 2
  cycle admins.

Run D-4 first; verify on a reset DB; one PR (may be split from Doc A's PR if
that lands first).

## Decisions log

- **2026-06-17** — Drop per-person permissions; presets cover everyone. PBAC →
  relationship-based model.
- **2026-06-17** — Admin has **three scopes**: super (all labs) / lab / cycle.
  Super admin = the former global admin/leadership set.
- **2026-06-17** — Store admin scope in a generic **`role_assignments(role,
  scope_type, scope_id)`** table (chosen over nullable columns and per-scope
  tables). Admin tiers only; moderator/memberships stay in their own tables.
- **2026-06-17** — `owner`, `developer`, `observer` all migrate to admin
  (super-admin tier on backfill). `testing:use` becomes a plain admin power.
  **⚠ Caveat (added on stress-test):** `observer` is read-only today and the new
  3-role model has no read tier, so this mapping **escalates** a read-only auditor
  to platform-wide super admin. Accepted by the author; the D-4 audit is the
  safeguard, and it only fires if prod actually holds observer rows. Revisit if a
  read-only tier is wanted.
- **2026-06-17 (revised on stress-test)** — **Phased PRs**, not one big-bang.
  Dependency order `labs → timeline → pod-registration → auth`; auth lands last.
  Build against a reset **dev** DB; apply to **prod forward-only with backfill**.
- **2026-06-17** — Pod-moderator is a relationship row holdable by anyone (an
  admin or a base moderator can be assigned to a pod).
- **2026-06-17 (D-6)** — Super admins grant super/lab admin; a **lab admin may
  appoint cycle admins within their own lab**. Lab admins cannot grant lab/super.
- **2026-06-17 (D-5)** — **Per-pod moderation is sufficient**; `pod_id` stays
  NOT NULL (no cycle-wide moderator). 
- **2026-06-17 (D-4)** — **Run the pre-migration audit (below) before** the
  backfill/drop.

## Pre-migration audit (decided: run before backfill — D-4)

Confirm no production participant has a permission set that doesn't map to a
preset, and list who has read-only (observer) access (they gain write under
observer→admin):

      -- (a) role-shaped observers (will gain write)
      SELECT p.id, p.email, ur.granted_at
      FROM user_roles ur JOIN participants p ON p.id = ur.participant_id
      WHERE ur.role = 'observer' AND ur.revoked_at IS NULL;

      -- (b) permission-shaped observers: can read but NOT write, not moderators
      SELECT p.id, p.email
      FROM participants p
      WHERE EXISTS (SELECT 1 FROM participant_permissions pp
                    WHERE pp.participant_id = p.id
                      AND pp.permission = 'cycles:read' AND pp.revoked_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM participant_permissions pp
                    WHERE pp.participant_id = p.id
                      AND pp.permission = 'cycles:write' AND pp.revoked_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM moderator_assignments ma
                    WHERE ma.participant_id = p.id AND ma.removed_at IS NULL);

  Empty (a)+(b) ⇒ observer→admin is harmless. Non-empty ⇒ review before backfill.
