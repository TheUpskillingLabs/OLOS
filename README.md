# OLOS

**OLOS is the build-cycle operating system for [The Upskilling Labs](https://theupskillinglabs.org).**
It runs the public member experience, the participant onboarding funnel, and the
signed-in app that walks members through a Build Cycle — from field observations
to formed pods to shipped projects — plus the Poderator and Admin surfaces that
keep a cycle moving. It replaces a battery of Google Forms and reconciliation
spreadsheets with one tool.

> **Naming:** the brand is **"The Upskilling Labs"**, shortened only to **"The Labs"** —
> never "TUL". This holds in all user-facing copy.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) · React 19 · TypeScript 5 |
| Styling | Tailwind CSS v4 + a token-based design system (see [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md)) |
| Data / Auth | Supabase (Postgres + Auth + Storage), Google OAuth |
| Email | Resend (HTTP API) |
| Tests | Vitest |
| Hosting | Vercel (`dev` → preview, `main` → prod) + Vercel Cron |

There is **no separate backend service** — server logic lives in Next.js route
handlers (`app/api/**`) and server components, talking to Supabase.

## Get running

New here? Start with **[CONTRIBUTING.md](CONTRIBUTING.md)** — it has the full setup,
the branch/PR workflow, and how to pick up your first task. The short version:

```bash
nvm use                 # Node 22 (see .nvmrc)
npm install
cp .env.local.example .env.development.local   # then fill in the values (see CONTRIBUTING)
npm run dev             # http://localhost:3000
```

Environment setup, the shared dev Supabase project, and login are documented in
[`docs/environments.md`](docs/environments.md).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the local dev server |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `npm run build` | Production build (also type-checks) |

## Repo layout

| Path | What it is |
|---|---|
| `app/` | Next.js App Router — route groups `(public)`, `(dashboard)`, `(auth)`, the `api/` route handlers, and shared `components/` |
| `lib/` | Server + shared logic (auth, content, cycle, enrollment, learning-logs, participants, moderator, integrations, email, supabase clients, validations) |
| `proxy.ts` | Edge middleware — the auth gate + public-path allowlist |
| `supabase/migrations/` | SQL migrations — the source of truth for the database schema |
| `scripts/` | Operational + migration scripts (see the `CLAUDE.md` in each) |
| `docs/` | Architecture, roadmap, environments, PRDs, and audit docs |
| `public/` | Static assets |

## Branch & PR model

Work happens on `dev`. Branch off `dev`, open a PR **into `dev`**, and CI
(`lint` + `test` + `build`) must pass before merge. `dev` auto-deploys to a Vercel
preview; `main` is production and is promoted from `dev` by a maintainer. Details
in [CONTRIBUTING.md](CONTRIBUTING.md) and [`docs/environments.md`](docs/environments.md).

## Where to read next

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — setup, workflow, conventions, where to start
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — how the codebase is organized
- **[SCHEMA.md](SCHEMA.md)** — database schema reference (ERDs + table summary)
- **[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)** — the design system (tokens, components, voice)
- **[docs/OLOS-roadmap.md](docs/OLOS-roadmap.md)** — what's being built, in what order

Deeper, area-specific context lives in the `CLAUDE.md` files next to the code they
describe (e.g. [`lib/auth/CLAUDE.md`](lib/auth/CLAUDE.md), [`supabase/CLAUDE.md`](supabase/CLAUDE.md)).

## License

Not yet licensed. MIT is intended for Open-Cycle project code (content under
CC BY 4.0), pending legal review — until then treat this repository as
all-rights-reserved. See [CONTRIBUTING.md](CONTRIBUTING.md#licensing).
