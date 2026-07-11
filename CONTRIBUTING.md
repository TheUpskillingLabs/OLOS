# Contributing to OLOS

Welcome. This guide gets you from a fresh clone to your first merged PR. Read it
once end-to-end; it's short.

For what OLOS is and the stack, see the [README](README.md). For how the code is
organized, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Prerequisites

- **Node 22** (`.nvmrc` pins it — run `nvm use`). CI runs on Node 22, so match it.
- **npm** (the repo uses `package-lock.json`).
- A **Google account** that will be added to the dev `participants` table (ask a
  maintainer) — that's how you sign in locally.
- Optionally the **Supabase CLI** if you want to run migrations from the terminal.

## Setup

```bash
git clone https://github.com/TheUpskillingLabs/OLOS.git
cd OLOS
nvm use
npm install
cp .env.local.example .env.development.local
# fill in the values — see below
npm run dev            # http://localhost:3000
```

### Environment variables

Copy the tracked template `.env.local.example` into **`.env.development.local`**
(this is the file `npm run dev` reads — all `.env*.local` files are git-ignored;
never commit one). The full variable list, the shared dev Supabase project, and
the prod-debug file (`.env.production.local`) are documented in
[docs/environments.md](docs/environments.md).

The real values (Supabase keys, Resend, etc.) live in **1Password — ask a
maintainer** for access. Local and dev intentionally share the same Supabase
project, so data you seed locally shows up on the dev preview immediately.

### Signing in locally

Start the app, open `http://localhost:3000/login`, and sign in with Google. If you
authenticate but land on `/register`, your email doesn't have a row in the dev
`participants` table yet — ask a maintainer to add one (see
[docs/environments.md](docs/environments.md)).

## Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run lint` | ESLint — must pass in CI |
| `npm run test` | Vitest unit tests — must pass in CI |
| `npm run build` | Production build; also type-checks (`tsc`) — must pass in CI |

Before opening a PR, run all three: `npm run lint && npm run test && npm run build`.

## Branch & PR workflow

All work happens on **`dev`**. `main` is production.

1. **Branch off `dev`:** `git checkout dev && git pull && git checkout -b your-feature`.
2. **Make focused commits.** Keep a PR to one logical change — small PRs get
   reviewed faster.
3. **Open a PR into `dev`** (not `main`). Fill in the PR template.
4. **CI must be green.** Every PR runs `lint` + `test` + `build` (see
   [`.github/workflows/ci.yml`](.github/workflows/ci.yml)). Red CI won't be merged.
5. **A maintainer reviews and squash-merges.** `dev` then auto-deploys to a Vercel
   preview.
6. **`dev` → `main`** (production) is promoted by a maintainer, not per-PR — see
   the "Merging Dev → Main" section of [docs/environments.md](docs/environments.md).

> Reviews route to the maintainers via [`.github/CODEOWNERS`](.github/CODEOWNERS).

### Working in parallel

Several people can work at once as long as branches stay segregated:

- **One feature per branch, off `dev`.** Name it for the work (`fix/linkedin-url-guard`,
  not `wip`). Don't stack unrelated changes.
- **Claim shared surfaces first.** Before you start, check whether an open issue/PR
  already touches your files. A few areas are collision-prone — coordinate (or take
  the whole area) rather than editing them from two branches at once:
  the shared form primitives (`app/components/ui/form.tsx`), and the
  enrollment/moderator/admin surface (`lib/enrollment/`, `lib/moderator/`,
  `app/api/admin/pods/`, `app/api/moderator/pods/`), which several issues touch together.
- **Claim your migration number.** Say so on the issue before you write
  `supabase/migrations/000NN_…`. Two branches grabbing the same number collide;
  `npm run check:migrations` (also enforced in CI) catches a duplicate before merge.
- **Rebase on `dev` before opening the PR**, and keep PRs small so reviews don't queue.
- **Never target or push `main`.** It's production; only a maintainer promotes `dev → main`.

### Branch protection (maintainers)

`dev` and `main` should be protected so the workflow above is enforced, not just
documented. Intended rules (GitHub → Settings → Branches):

- Require a pull request before merging (≥1 approving review).
- Require the **`ci`** status check to pass, with "require branches up to date."
- Require review from Code Owners.
- Restrict direct pushes (no bypassing the PR).

## Database migrations

The database schema lives in `supabase/migrations/`, numbered sequentially
(`00001_…`). **Never change the schema in Supabase Studio without also writing the
migration file** — the files are the source of truth ([SCHEMA.md](SCHEMA.md) is the
generated reference).

- **Never reuse a migration number** — `ls supabase/migrations/ | tail -1` first, and
  claim it on the issue if others are working in parallel. `npm run check:migrations`
  (run in CI) fails the build if two files share a numeric prefix.
- Full conventions (header comments, idempotency, RLS, `-- DOWN:` blocks) are in
  [`supabase/CLAUDE.md`](supabase/CLAUDE.md).
- Applying to dev vs prod is documented in
  [docs/environments.md](docs/environments.md) — **a maintainer applies migrations
  to prod manually after `dev → main`.** Don't run migrations against prod.
- Update [SCHEMA.md](SCHEMA.md) in the same PR when you change the schema.

## Testing

Tests use **Vitest** and live in `lib/**/*.test.ts` (see
[`vitest.config.ts`](vitest.config.ts)). They cover pure, mockable logic — cycle
math, reconcilers, validators, rate-limiting. Run `npm run test`. New pure helpers
in `lib/` should come with a `*.test.ts`; UI and DB-integration testing isn't set
up yet.

## Where to start

Work is planned in [docs/OLOS-roadmap.md](docs/OLOS-roadmap.md) (organized by
`§`-anchored sections that issues reference), and current status is tracked in
[docs/audit/PROGRESS.md](docs/audit/PROGRESS.md).

Good first contributions are labeled **`good first issue`** on the
[issue tracker](https://github.com/TheUpskillingLabs/OLOS/issues). Suggested labels
we use: `good first issue`, `bug`, `enhancement`, `docs`, `needs-triage`. If you're
not sure where to jump in, open an issue describing what you'd like to work on and a
maintainer will point you at something.

## Style & conventions

- Match the surrounding code — naming, structure, and comment density. There's no
  Prettier gate yet, so mirror the existing style; `npm run lint` catches the rest.
- Keep the design system as the single source for UI — see
  [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). User-facing copy follows the "The Labs"
  naming rule (never "TUL") and the voice notes in that doc.
- Area-specific rules live in the nearest `CLAUDE.md` (e.g.
  [`lib/auth/CLAUDE.md`](lib/auth/CLAUDE.md) before touching auth). Read it before
  editing that area.

## Licensing

This repository is **not yet licensed**. MIT is intended for Open-Cycle project code
(content under CC BY 4.0), pending legal review. Until a `LICENSE` file lands, treat
the code as all-rights-reserved and check with a maintainer before reusing it
outside the project.
