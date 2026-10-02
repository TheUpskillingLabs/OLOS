# OLOS

**OLOS is the build-cycle operating system for [The Upskilling Labs](https://theupskillinglabs.org).**
It runs the public member experience, the participant onboarding funnel, and the
signed-in app that walks members through a Build Cycle — from field observations
to formed pods to shipped projects — plus the Poderator and Admin surfaces that
keep a cycle moving. It replaces a battery of Google Forms and reconciliation
spreadsheets with one tool.

> **Naming:** the brand is **"The Upskilling Labs"**, shortened only to **"The Labs"** —
> never "TUL". This holds in all user-facing copy.

## Start here (updated at every sprint boundary)

| You want to… | Read |
|---|---|
| **Join the team** (volunteer, developer, success, programs) | [`ONBOARDING.md`](ONBOARDING.md) — day-one checklist, where everything lives, how to pick up a ticket, who to ask |
| **Know what we are building right now** | [`docs/roadmap/next-sprint.md`](docs/roadmap/next-sprint.md) — the current sprint, dates, and the issue map (§10); the [issue tracker](https://github.com/TheUpskillingLabs/OLOS/issues) is the live view |
| **Build one of the planned pieces** | [`docs/roadmap/handoff-2026-09-28-onboarding-journeys.md`](docs/roadmap/handoff-2026-09-28-onboarding-journeys.md) — the hand-off brief: what exists today, what is decided, six lanes with acceptance criteria |
| **Find any document and know whether to trust it** | [`docs/README.md`](docs/README.md) — the doc map: every document, its kind, its status |
| **See what shipped, when** | [`CHANGELOG.md`](CHANGELOG.md) |
| **See what a past work session did** | [`docs/sessions/`](docs/sessions/) (this sprint) and the private knowledge repo (everything earlier) |
| **Set up and open a pull request** | [`CONTRIBUTING.md`](CONTRIBUTING.md), then the PR template |

Agents (Claude Code, Codex, Cursor, …) get the same orientation from [`AGENTS.md`](AGENTS.md).

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

Every folder below has a `README.md` for human readers: what is in it, how it fits, the
rules that apply, and the open issues against it (a dated snapshot plus the live link;
refreshed at each sprint boundary). Agent conventions live in the `CLAUDE.md` next to it.

| Path | What it is | Folder README |
|---|---|---|
| `app/` | Next.js App Router — route groups `(public)`, `(dashboard)`, `(auth)`, `(survey)`, the `api/` route handlers, the public cohort page `c/`, and shared `components/` | [`app/README.md`](app/README.md) · [`(public)`](app/(public)/README.md) · [`(dashboard)`](app/(dashboard)/README.md) · [`(auth)`](app/(auth)/README.md) · [`api/`](app/api/README.md) · [`components/`](app/components/README.md) |
| `lib/` | Server + shared logic (auth, content, cycle, enrollment, learning-logs, participants, moderator, integrations, email, supabase clients, validations) | [`lib/README.md`](lib/README.md) · [`lib/auth/CLAUDE.md`](lib/auth/CLAUDE.md) |
| `proxy.ts` | Edge middleware — the auth gate + public-path allowlist | described in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| `supabase/` | SQL migrations — the source of truth for the database schema; `config.toml`, `seed.sql` | [`supabase/README.md`](supabase/README.md) · [`supabase/CLAUDE.md`](supabase/CLAUDE.md) |
| `scripts/` | Operational, migration, verification, and docs-tooling scripts | [`scripts/README.md`](scripts/README.md) |
| `docs/` | Architecture, environments, the roadmap (`docs/roadmap/`), PRDs, requirements, audits, session reports, legal copy | [`docs/README.md`](docs/README.md) (the doc map) · [`docs/roadmap/README.md`](docs/roadmap/README.md) |
| `.github/` | CI, the docs checks, the weekly docs steward, the knowledge-repo publisher; issue and PR templates; `CODEOWNERS` | [`.github/README.md`](.github/README.md) |
| `.claude/` | Claude Code agent roles, the session-start hook, settings | [`.claude/README.md`](.claude/README.md) · [`docs/agent-teams.md`](docs/agent-teams.md) |
| `public/` | Static assets | — |

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
- **[docs/roadmap/README.md](docs/roadmap/README.md)** — what's being built, in what order (the April plan in `docs/OLOS-roadmap.md` is historical)

Deeper, area-specific context lives in the `CLAUDE.md` files next to the code they
describe (e.g. [`lib/auth/CLAUDE.md`](lib/auth/CLAUDE.md), [`supabase/CLAUDE.md`](supabase/CLAUDE.md)).

## License

Not yet licensed. MIT is intended for Open-Cycle project code (content under
CC BY 4.0), pending legal review — until then treat this repository as
all-rights-reserved. See [CONTRIBUTING.md](CONTRIBUTING.md#licensing).
