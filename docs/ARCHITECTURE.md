# OLOS Architecture

The 10-minute orientation to how the codebase is organized. Read this after the
[README](../README.md), then dip into the per-area references (linked throughout)
only for the part you're touching.

> This supersedes the old `OLOS-architecture-brief.md`, which described a
> Python/FastAPI backend that was never built. **OLOS is a single Next.js app** —
> there is no separate backend service.

---

## The shape of it

OLOS is a **Next.js 16 App Router** application backed by **Supabase** (Postgres +
Auth + Storage). Everything runs in one deployment:

- **Server logic** lives in route handlers (`app/api/**/route.ts`) and React Server
  Components — not a separate API service. They talk to Supabase directly.
- **The database** is Postgres on Supabase. Schema is defined by SQL migrations in
  `supabase/migrations/` (the source of truth); [`SCHEMA.md`](../SCHEMA.md) is the
  generated human reference (ERDs + table summary).
- **Auth** is Supabase Auth + Google OAuth. An edge middleware (`proxy.ts`) gates
  every request.
- **Hosting** is Vercel: the `dev` branch auto-deploys to a preview, `main` is
  production. Scheduled jobs run via Vercel Cron (`vercel.json`).

---

## Directory map

### `app/` — the App Router

Route groups (the parenthesized folders don't appear in URLs; they just group
routes and let each group share a layout):

| Group | What lives here |
|---|---|
| `app/(public)/` | Browse-free public pages — landing, `/events`, `/library`, `/local-labs`, `/about`, `/build-cycles`, `/stories` (Upskiller Spotlights) |
| `app/(auth)/` | `/login`, `/register` — the sign-in + onboarding funnel |
| `app/(dashboard)/` | The signed-in app — `/dashboard`, `/cycles`, `/pods/[id]`, `/projects/[id]`, `/learning`, `/directory`, `/profile`, plus the `/moderator` (Poderator) and `/admin` persona surfaces |
| `app/api/` | ~76 route handlers (`route.ts`) — the server endpoints for every mutation and cron |
| `app/components/` | Shared React components (chrome, content teasers, flow engine, etc.) |
| `app/@authmodal/` | A parallel route slot for the auth modal |

Root files: `app/layout.tsx` (root layout), `app/page.tsx` (landing),
`app/globals.css` (the design-system CSS), and branded `not-found.tsx` /
`error.tsx`.

### `proxy.ts` — the auth gate

Edge middleware that runs on every request. It checks the Supabase session and
redirects unauthenticated users to `/login`, **except** for an allowlist of public
paths (`publicPaths` — the landing, content pages, `/stories`, all of `/api/`,
etc.). When you add a new public page, add it to that allowlist. It also forwards
the pathname to server components via an `x-pathname` header.

### `lib/` — server + shared logic

Grouped by domain. The important ones:

| Path | Responsibility |
|---|---|
| `lib/auth/` | Sign-in, role resolution, invitations, session helpers — **read [`lib/auth/CLAUDE.md`](../lib/auth/CLAUDE.md) before touching auth** |
| `lib/supabase/` | Supabase client factories (browser, server, service-role) |
| `lib/content/` | Public content queries + spotlights (events, resources, metros, stories) |
| `lib/cycle/` + `lib/cycles/` | Cycle lifecycle, the active/recruiting-cycle resolvers, milestone + week math |
| `lib/enrollment/` | Cycle enrollment + the reconciler |
| `lib/participants/` | Participant records, handles, placeholder-name gating |
| `lib/learning-logs/` | The weekly Learning Log + its due/gate logic |
| `lib/moderator/` | Poderator-dashboard data (health bands, nudges) |
| `lib/integrations/` | External resource provisioning (Slack, Drive, GitHub, Groups) |
| `lib/email/` | Resend HTTP dispatch + templates |
| `lib/llm/` | Anthropic API calls (e.g. pod/project name generation) |
| `lib/validations/` | Zod schemas shared by API routes and forms |

### `supabase/` — the database

`supabase/migrations/` holds the numbered SQL migrations (currently through
`00052`). `supabase/config.toml` configures the local stack; `supabase/seed.sql`
seeds a starter cycle on `db reset`. See [`supabase/CLAUDE.md`](../supabase/CLAUDE.md)
for migration conventions (numbering, idempotency, RLS, consolidation policy).

### `scripts/` — operational scripts

One-off operator + data-migration scripts (bulk invites, auth-row checks, legacy
spreadsheet import). Each subfolder has its own `CLAUDE.md` with a safety contract —
[`scripts/ops/CLAUDE.md`](../scripts/ops/CLAUDE.md),
[`scripts/migration/CLAUDE.md`](../scripts/migration/CLAUDE.md).

---

## Core domain concepts

### Cycle → Pod → Project

The central hierarchy. A **Build Cycle** is a ~12-week cohort with a theme. Within
a cycle, members form **Pods** (seeded by top-voted problem statements) and then
**Projects** (seeded by top-voted solution proposals). Hierarchy is strict: a
project belongs to a pod, which belongs to a cycle. Cycles belong to **sectors**,
and at most one cycle is active at a time.

### Formation phases

A cycle moves through formation phases — problem observations → problem statements
→ pod voting → pod registration → solution proposals → project voting → project
registration. Phase windows are config-driven (`cycle_config`) and enforced
server-side. The current state is documented in [`SCHEMA.md`](../SCHEMA.md) and the
sector/lifecycle model in [`docs/SECTOR_MODEL.md`](SECTOR_MODEL.md).

### The Learning Log & its weekly gate

The Learning Log is the weekly practice ritual (health check + reflection + an
optional public share). It has a **hard weekly gate**: a Friday cron stamps a
due-date into `cycle_config`, and an active member with no log since that stamp is
locked to their dashboard until they file one. Logic in `lib/learning-logs/`.

### Roles

Roles stack (a Poderator who is also a participant gets both permission sets):

- **Owner / Admin** — global, granted in the DB. The `/admin` surface.
- **Poderator** — a shepherd for assigned pod(s) in a cycle. The `/moderator`
  routes (rendered copy says "Poderator", never "moderator"). See
  [`docs/poderator-dashboard/CLAUDE.md`](poderator-dashboard/CLAUDE.md).
- **Participant** — derived from an active `cycle_enrollments` row.
- **Observer** — read-only.

### Public content

Events (`/events`), the Learning Library (`/library`), Local Labs / metros
(`/local-labs`), and Upskiller Spotlights (`/stories`) render from content tables
via shared teaser components. These surfaces browse free (no auth) and stay
empty-until-real — content appears only when genuinely published.

### Scheduled jobs

Three Vercel crons (`vercel.json`): the Learning-Log window (Fri 21:00), the
Learning-Log reminder (daily 09:00), and a Luma events sync (every 6h). Each is a
route under `app/api/cron/`.

---

## Where to go deeper

- [`SCHEMA.md`](../SCHEMA.md) — every table, with ERDs
- [`DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) — tokens, components, and the copy voice
- [`docs/environments.md`](environments.md) — local/dev/prod, env vars, deploy
- [`docs/OLOS-roadmap.md`](OLOS-roadmap.md) — planned work, `§`-anchored
- The `CLAUDE.md` next to any area you're editing — these are the densest,
  most current per-area references (they're written for AI agents, but they're the
  real source of truth for conventions in that folder).
