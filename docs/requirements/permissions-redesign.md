# Requirements — Finish the Authorization Unification

| | |
|---|---|
| **Status** | Draft — for review (**re-baselined 2026-07-12**; original 2026-06-17 proposal largely shipped via the 00054–00066 unification — see [`pr231-evaluation.md`](./pr231-evaluation.md)) |
| **Baseline** | `participant_roles` is the authority source of truth (migrations `00054`, `00058`, `00064`, `00065`, `00066`; `lib/auth/roles.ts`, `lib/auth/grants.ts`, `lib/auth/CLAUDE.md`) |
| **Related code** | `lib/auth/`, `app/api/invitations/*`, `app/api/auth/callback/route.ts`, `supabase/migrations/00009` (legacy PBAC), RLS policies across `00017`–`00074` |
| **Related docs** | [`local-labs.md`](./local-labs.md) (superseded record of the metros model), `docs/personas.md` |

## Overview

The June 2026 version of this doc proposed replacing the PBAC model
(permission strings + role presets) with a **relationship-based (role, scope)**
model. That destination **substantially shipped** in July, under different
names than proposed:

- **`participant_roles`** — one table recording `(participant, role)` with
  typed scope columns `cycle_id` / `pod_id` / `lab_id` / `project_id`, plus
  provenance (`granted_by`) and history (`revoked_at`). Wider role vocabulary
  than the June 3-role model: `owner, admin, developer, observer, poderator,
  lab_lead, co_lead, member, dri, contributor, staff, tester, upskiller,
  volunteer, mentor, events` (`00064`).
- **One source of truth for app AND database.** `resolveUserRoles` and the DB
  RLS helpers `is_admin()` / `is_owner()` read the same table (`00058`,
  `00064`), so app and DB cannot disagree about who is admin/owner.
- **Scope-aware seams** exist: `lib/auth/lab.ts` (`requireLabAccess`,
  `labForCycle`, `labForPod`), `lib/auth/moderator.ts`
  (`requireModeratorForPod`), `lib/auth/projects.ts` (`isProjectDri`,
  `isProjectMember`).
- **Governed grants**: all role writes go through `lib/auth/grants.ts`
  (`canGrant`/`grantRole`/`revokeRole` with scope attenuation), backed by the
  DB `guard_owner_grant` trigger and the rooted owner tree (`00066`).

**What this doc now covers is the unfinished half:** the legacy PBAC surfaces
that are still alive alongside the unified model. Until they are drained, the
system is split-brained — two places to update, two ways to drift.

## Current state (as-is, July 2026) — what's still legacy

1. **Invitations still speak PBAC.** `invitations` rows carry `permissions
   TEXT[]` + `role_preset` (+ `cycle_id`/`pod_id`/`pod_role`). On acceptance,
   `fulfillInvitation` (`lib/auth/invitations.ts`) upserts
   `participant_permissions` rows and writes legacy `user_roles` — new people
   enter through the old door, and forward-sync triggers (`00065`) mirror them
   into `participant_roles` after the fact.
2. **Granular capabilities still read `participant_permissions`.**
   `resolveUserRoles` unions role-derived capabilities
   (`capabilitiesForRoles`, `lib/auth/permissions.ts`) with legacy per-person
   rows. The role→capability derivation exists but the legacy table is still
   load-bearing.
3. **RLS is split-brained.** Newer policies use `is_admin()`/`is_owner()`
   (read `participant_roles`); an older family still uses `has_permission()`
   and `is_admin_or_owner()` (read `participant_permissions`; note `00009`
   redefined `is_admin_or_owner()` as `has_permission('cycles:write')`).
   The legacy family appears in ~15 migrations (`00017`, `00020`, `00021`,
   `00023`, `00024`, `00029`, `00062`, `00070`–`00074`, …).
4. **`user_roles` is written but never read** for authority (audit-trail
   writes on invite fulfillment; deleted by `delete_participant`).

## Goals

- One authority model end to end: `participant_roles` + the grants path, with
  no legacy write or read paths left.
- Invitations express **who you'll be** (role + scope), not a permission list.
- One RLS helper family; drop the PBAC helpers and tables.
- No behavior change for existing users at each step (verified by comparing
  resolved capabilities before/after).

## Non-goals

- Redesigning the role vocabulary or the grants/attenuation rules — they
  shipped and work.
- A separate cycle-scoped admin tier. Under the single-HQ-open-cycle model
  (`00067`) cycle-admin ≈ global admin, and `lab_lead` covers sub-cohorts.
  Revisit only if genuinely parallel cycles return.
- Changing the Google-OAuth sign-in flow or invitation delivery (Resend).

## Functional requirements (in build order)

### FR-1 — Invitations carry (role, scope)

- Replace `permissions[]` + `role_preset` on `invitations` with `role`
  (values from the `participant_roles` CHECK) + the existing scope columns
  (`cycle_id`, `pod_id`; add `lab_id` if lab_lead invites are wanted). Keep
  `pod_role` semantics (`00060`: co_lead/member) — they map onto `role`.
- `fulfillInvitation` writes through the **grants path** (`grantRole`) and the
  membership/enrollment reconciler — no direct `participant_permissions` or
  `user_roles` writes.
- The invitation create/send UI offers a role selector (role + scope picker),
  not a permission checklist or preset picker.
- **In-flight `pending` invitations are a migration hazard**: translate
  existing rows (`role_preset`→role; drop `permissions[]` after confirming
  every pending row's permission set matches its preset) or drain them before
  the cutover.

### FR-2 — Drain `participant_permissions`

- Make `capabilitiesForRoles` the only source of `permissions[]` on
  `UserRoles`; stop unioning legacy rows once an audit confirms no live
  participant holds a permission their roles don't imply
  (see Pre-drain audit below).
- Stop all writers: invitation fulfillment (FR-1), any admin permission-editor
  endpoints/UI (`/api/permissions`, checklist editor) get removed or rebuilt
  on roles; remove the `00065` forward-sync triggers.

### FR-3 — Unify RLS

- Migrate every policy using `has_permission()` / `is_admin_or_owner()` onto
  `is_admin()` / `is_owner()` / `current_participant_id()` (+ membership
  predicates), one migration that re-creates the affected policies.
- Then drop `has_permission()`, `is_admin_or_owner()`, and finally the
  `participant_permissions` and `user_roles` tables (after FR-1/FR-2 have
  removed all writers/readers; update `delete_participant` accordingly).

### FR-4 — Single seam hygiene (carryover, still worth enforcing)

- Every authorization *decision* goes through `lib/auth/` (`isAdmin`,
  `isOwner`, `requireLabAccess`, `requireModeratorForPod`, `isProjectDri`,
  membership checks); no route re-derives authority from raw tables.
- Service-role mutations are each guarded by *something* (route wrapper,
  session identity, CRON_SECRET, invitation-state) — the standing exceptions
  (`registrations`, `registrations/short`, `auth/callback`, crons) are
  legitimate and stay.

## Pre-drain audit (run before FR-2/FR-3 cutovers)

Confirm no production participant has a live `participant_permissions` set
that their `participant_roles` don't already imply:

    SELECT p.id, p.email, pp.permission
    FROM participant_permissions pp
    JOIN participants p ON p.id = pp.participant_id
    WHERE pp.revoked_at IS NULL
      AND pp.permission NOT IN (
        SELECT cap FROM (
          -- expand capabilitiesForRoles for the participant's active roles
          SELECT unnest(role_capabilities(pr.role)) AS cap
          FROM participant_roles pr
          WHERE pr.participant_id = p.id AND pr.revoked_at IS NULL
        ) caps
      );

(Implement `role_capabilities` as a fixture mirroring
`lib/auth/permissions.ts#ROLE_CAPABILITIES`, or run the equivalent check in a
script against prod.) Non-empty ⇒ someone would lose a capability; grant the
covering role (or add the capability to a role) before draining.

## Acceptance criteria

- A participant with only memberships does exactly what they do today.
- Accepting an invitation produces `participant_roles` (+ membership/
  enrollment) rows only; no new `participant_permissions` or `user_roles`
  rows anywhere.
- `resolveUserRoles` produces identical `permissions[]` for every live
  participant before and after the drain (snapshot comparison).
- No migration or code references `has_permission`, `is_admin_or_owner`,
  `ROLE_PRESETS`, or `participant_permissions` when done.
- Grants/attenuation behavior unchanged (`lib/auth/grants.ts` tests pass).

## Decisions log

- **2026-06-17** — (original) PBAC → relationship-based (role, scope) model.
  **Destination shipped 2026-07 as `participant_roles` + grants path**
  (different names: no `role_assignments`, no `isSuperAdmin`/`with*AdminAuth`;
  typed scope columns instead of polymorphic `scope_type`/`scope_id`).
- **2026-06-17** — observer→admin backfill concern. **Moot** — `00065` ran the
  actual backfill (role-preserving; observers stayed observers).
- **2026-07-12** — Re-scoped this doc to the remaining work: invitations →
  (role, scope); drain `participant_permissions`; unify RLS; then drop legacy
  tables. Cycle-admin tier explicitly not pursued (single-HQ-cycle model).

## Open decisions

- **P-1** — Does any *pending* invitation carry a permission set that doesn't
  match its preset? (Determines translate-vs-drain in FR-1.)
- **P-2** — Keep `observer` as a read-only role with its own capability set in
  `ROLE_CAPABILITIES`, or retire it? (It has a capability mapping today;
  retiring is a separate product call.)
- **P-3** — Order of FR-3 vs FR-2 completion: RLS unification can land before
  the table drop but after writers stop; confirm no external tooling reads
  `user_roles`/`participant_permissions` (scripts under `scripts/ops/`).
