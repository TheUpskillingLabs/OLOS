# OLOS Architecture

The current, shipped architecture. Supersedes the
[April 2026 architecture brief](archive/OLOS-architecture-brief.md), which
described an intended Python/FastAPI split that was never built. For how the
system got this shape, see [`EVOLUTION.md`](EVOLUTION.md).

## The stack, actually

| Layer | Reality |
|---|---|
| App | **Next.js App Router monolith** (see `package.json` for the pinned version — it has breaking changes vs. older Next.js; read `node_modules/next/dist/docs/` before writing code, per `AGENTS.md`) |
| Backend | Route handlers under `app/api/**/route.ts` (~68 endpoints). No separate service, no Python, no hand-rolled JWT |
| Database | Supabase Postgres. Raw-SQL migrations in `supabase/migrations/` (through `00039`), conventions in [`supabase/CLAUDE.md`](../supabase/CLAUDE.md), reference in [`SCHEMA.md`](../SCHEMA.md) |
| Auth | Supabase Auth (Google OAuth) via `@supabase/ssr` cookie sessions. OAuth lands at `GET /api/auth/callback`; roles/permissions resolved **per request** from Postgres (`resolveUserRoles`), never baked into a token |
| Email | Invitation magic links via the **Resend HTTP API** (not Supabase SMTP — ratified in #64) |
| UI | Light "warm-paper" design system: token layer in `app/globals.css` + shared components in `app/components/ui/` (the dark v1 system is [archived](archive/DESIGN_SYSTEM.md)) |
| Edge | `proxy.ts` middleware redirects unauthenticated non-public page requests to `/login`; API routes enforce auth themselves |

## Domain model: HQ, Local Labs, and the cycle → pod → project primitive

The core hierarchy is unchanged since the founding spec: **cycles** contain
problem statements → votes → **pods** → solution proposals → votes →
**projects**, with pulse checks as the participation heartbeat and
`cycle_config` holding every threshold and stage window (stages fall on
different days).

> **Pulse-check caveat:** pulse checks are what *this codebase* enforces (the
> dashboard gate and the `pulse-check-reminder` cron). Per
> [issue #179](https://github.com/TheUpskillingLabs/OLOS/issues/179), the
> product direction retires Pulse in favor of a **Learning Log** ritual —
> built outside this repo's migration chain (`learning_logs` /
> `leadership_logs` tables and `cycle_config` log columns exist in the dev DB
> but in no repo migration, and no `learning_log` code exists on this branch
> or `main`). Treat Pulse as live-here / retiring-globally until #179's
> harvest lands in this repo.

What the spec didn't have is the **org model** layered on top (migrations
`00038`/`00039`):

- **HQ** centrally coordinates the platform. **Local Labs** are metro chapters
  (`dc`, `baltimore`, `philadelphia` — registry in `lib/metros.ts`; a
  participant's lab is `participants.metro_slug`, captured from ZIP at
  registration or set by an admin).
- **Three kinds of cycle**, encoded on `cycles`:

  | Kind | `metro_slug` | `is_hq_internal` | Meaning |
  |---|---|---|---|
  | HQ-open | `NULL` | `false` | Shared build cycle; every lab participates |
  | Local-lab | set | `false` | One lab's own cycle, run by its labs lead |
  | HQ-internal | any | `true` | HQ org structure expressed as a cycle (standing teams as "pods"); hidden from labs leads |

- **The lab boundary lives on the pod/project**, not the cycle:
  `pods.metro_slug` and `projects.metro_slug` (a project inherits its pod's
  lab at finalization). Inside a shared HQ-open cycle, each lab owns its own
  pods and projects.
- **Per-lab formation**: in an HQ-open cycle, participants see and vote on
  only their own lab's problem statements (`/api/problem-statements/[cycle_id]`
  scopes the list; `/api/votes` rejects cross-lab votes), and
  `/api/voting/finalize/[cycle_id]` tallies and forms pods **per lab**,
  stamping each pod with its lab. A labs lead finalizes only their own lab;
  HQ finalizes all labs. Local-lab cycles are single-lab by construction.

## Authorization

Two layers, resolved fresh on every request (no stateful tokens):

1. **Granular permissions** — `participant_permissions` rows (e.g.
   `pods:write`, `cycles:write`) checked via `can()`; roles like `admin` or
   `labs_lead` are presets that expand to permission grants at invite time.
   Route wrappers: `withAuth` / `withAdminAuth` / `withOwnerAuth` /
   `withPermissionAuth(permission)` in `lib/auth/middleware.ts`.
2. **Lab scoping** — `lib/auth/cycle-access.ts` is the single enforcement
   point for the HQ/lab model:
   - `canSeeCycle` — HQ sees all; a labs lead sees HQ-open + their own lab's
     cycles (never other labs' or HQ-internal ones).
   - `canManageEntity` + `requirePodManagement` / `requireProjectManagement` —
     pod/project lifecycle actions require the entity's `metro_slug` to match
     the caller's lab (full admins bypass).
   - `canConfigureCycle` + `requireCycleConfig` — a labs lead creates and
     configures **only their own lab's cycles** (create forces their metro);
     HQ (`cycles:write`) configures everything.

   Rule of thumb: **HQ = `cycles:write` (global). Labs lead = `pods:write` +
   a metro (scoped).** Page-level hiding is cosmetic; every lifecycle route
   re-enforces the boundary server-side.

Full auth detail (sign-in flow, invitations, deviations from the founding
spec): [`lib/auth/CLAUDE.md`](../lib/auth/CLAUDE.md).

## Enrollment lifecycle

`cycle_enrollments.status` (`inactive`/`active`/`revoked`) is derived from
pod-membership reality through one path:
`lib/enrollment/reconciler.ts::reconcileEnrollmentActivation` — the single
source of truth that ended the fragmented-mutation era (#110). The two-stage
revocation cron (`warn → revoke`, migration `00030`) lives at
`app/api/cron/revocation-check` (**not yet scheduled**).

## RLS and the service client

Tables are RLS-protected; most admin/lifecycle writes are
`is_admin_or_owner()`-gated at the database. Routes that authorize labs leads
or moderators in application code (via the guards above) perform their writes
through the **service-role client** (`createServiceClient()`), with the
authorization check always in the handler *before* the write. The cookie-bound
client is used wherever RLS should be the second line of defense (e.g.
participant self-edits).

## Key modules

| Path | Owns |
|---|---|
| `lib/auth/` | Role/permission resolution, route guards, invitations, **cycle-access (HQ/lab scoping)** |
| `lib/cycles/` | Stage windows (`stages.ts`), status vocabulary (`status.ts`), registration-open resolution (`registration.ts` — currently metro-blind; see EVOLUTION.md open items) |
| `lib/enrollment/` | The reconciler |
| `lib/metros.ts` | Metro registry + ZIP → metro assignment |
| `lib/llm/names.ts` | AI naming for newly formed pods/projects |
| `app/(dashboard)/admin/` | HQ + labs-lead admin surfaces (cycle lifecycle, participants, invitations) |
| `app/(dashboard)/moderator/` | Poderator dashboard ([build doc](poderator-dashboard/CLAUDE.md)) |
| `scripts/seed-cycle.mjs`, `scripts/verify-labs-lead-access.mjs` | Self-cleaning verification: data-level assertions + authenticated HTTP end-to-end against dev |

## Environments

Dev and prod are separate Supabase projects; details and safety rails in
[`environments.md`](environments.md). The verification scripts refuse to run
against prod.
