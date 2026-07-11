# OLOS — Open Labs Operating System

The platform behind **The Upskilling Labs**: quarterly build cycles where
participants submit problem statements, vote, form **pods**, propose
solutions, vote again, and form **projects** — coordinated centrally by HQ and
run on the ground by **Local Labs** (DC, Baltimore, Philadelphia), each owning
its own pods and projects within shared cycles.

**Stack:** Next.js App Router monolith · Supabase (Postgres + Auth via Google
OAuth) · Resend for email · raw-SQL migrations.

## Getting started

```bash
npm install
cp .env.local.example .env.local   # Supabase keys, OWNER_EMAILS, RESEND_API_KEY
npm run dev                        # http://localhost:3000
```

> ⚠️ This repo pins a Next.js version with breaking changes — read the guides
> in `node_modules/next/dist/docs/` before writing code (see `AGENTS.md`).

Verification against the dev database (both scripts are namespaced and
self-cleaning, and refuse to run against prod):

```bash
node scripts/seed-cycle.mjs               # data-level lifecycle + access assertions
node scripts/verify-labs-lead-access.mjs  # authenticated HTTP e2e (needs `npm run dev` up)
```

## Documentation map

| Doc | What it is |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Current stack, domain model (HQ / Local Labs), authorization |
| [`SCHEMA.md`](SCHEMA.md) | Database reference (tables, ERDs, lifecycle) |
| [`docs/EVOLUTION.md`](docs/EVOLUTION.md) | How the app got here, era by era + archive index |
| [`docs/OLOS-roadmap.md`](docs/OLOS-roadmap.md) | Wave status tracker and open items |
| [`lib/auth/CLAUDE.md`](lib/auth/CLAUDE.md) | Auth, roles, permissions, invitations — read before touching auth |
| [`supabase/CLAUDE.md`](supabase/CLAUDE.md) | Migration conventions — read before writing a migration |
| [`docs/poderator-dashboard/CLAUDE.md`](docs/poderator-dashboard/CLAUDE.md) | Moderator dashboard build doc |
| [`docs/personas.md`](docs/personas.md) | Who uses this (Upskiller, Organizer/HQ, Labs Lead, Poderator) |
| [`docs/environments.md`](docs/environments.md) | Dev vs prod Supabase projects, safety rails |
| [`docs/archive/`](docs/archive/) | Superseded specs & planning docs, each with a banner — history, not guidance |

The founding spec lives at
[`docs/archive/TUL_MVP_Spec.md`](docs/archive/TUL_MVP_Spec.md); consult it for
original intent, never for current behavior.
