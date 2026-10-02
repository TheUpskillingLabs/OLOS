# `scripts/` — CI checkers, operator tooling, and one-off repairs

| | |
|---|---|
| **What this is** | Zero-dependency checkers that CI and the local `npm run check:*` commands call, the knowledge-repo publisher, and three sub-folders of operator scripts that run against a live database by hand. |
| **Zone / owner** | Not a zone in the [file-ownership map](../docs/agent-teams.md#file-ownership-map-avoid-conflicts); the checkers travel with the PR that needs them, and everything under `ops/`, `migration/`, `verify/` is maintainer-run. |
| **Conventions** | No top-level `CLAUDE.md`. Sub-folder conventions: [`ops/CLAUDE.md`](ops/CLAUDE.md), [`migration/CLAUDE.md`](migration/CLAUDE.md) (`verify/` has none). Their shared safety contract: dry-run by default with an explicit `--commit`; refuse or guard the prod host; never log names or emails. |
| **Last verified** | 2026-10-02 |

## What is here

Env vars are named only; values live in the gitignored `.env*.local` files described in
[`docs/environments.md`](../docs/environments.md#env-files).

| Path | What it does | How to run | Needs |
|---|---|---|---|
| `check-auth-rows.mjs` | Diagnoses why a person cannot sign in to **prod** by reading every row the auth callback depends on. | `node scripts/check-auth-rows.mjs [--email someone@example.com]` | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` from `.env.production.local`. |
| `check-doc-links.mjs` | Fails on any relative Markdown link whose target does not exist; skips `docs/archive/`. | `npm run check:docs` (every tracked `*.md`) or `node scripts/check-doc-links.mjs a.md b.md` | Nothing. Runs in `docs-check` on changed Markdown. |
| `check-embeds.mjs` | Smoke-tests the app's embed-heavy PostgREST selects against a live database (the PGRST201 class of failure that unit tests cannot catch). | `node scripts/check-embeds.mjs` | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`, else the process env. Not part of `npm test`. |
| `check-migration-numbers.mjs` | Fails if two files in `supabase/migrations/` share a numeric prefix. | `npm run check:migrations` | Nothing. Runs in `ci`, `docs-check`, and the `.claude` `TaskCompleted` hook. |
| `check-vault-frontmatter.mjs` | Validates `title`, `date`, `status`, `kind` in the frontmatter of `docs/vault/**`. | `npm run check:docs` (second half) | Nothing. Exits 0 while `docs/vault/` does not exist (true on 2026-10-02). |
| `publish-artifacts.mjs` | Copies the paths in [`docs/publish.manifest.json`](../docs/publish.manifest.json) into a checkout of the team knowledge repo, stamping provenance and rewriting links; `--prune-plan` lists files the sweep PR may delete from OLOS. Never commits or pushes. | `node scripts/publish-artifacts.mjs --out <dir> [--tag vYYYY.MM.DD] [--dry-run] [--force]` | Nothing; the workflow supplies the checkout and the token. |
| `migration/` | One-shot Python import of the legacy spreadsheet into Postgres: `migrate.py` driven by `column_mapping.csv` (118 mapping rows), deps in `requirements.txt`. | `python3 scripts/migration/migrate.py` (dry-run; `--commit` to write; `--cycle`, `--db-url`, `--no-anonymize`) | `SUPABASE_DB_URL` from `.env.local` (or `--db-url`); optional `OLOS_MIGRATE_SALT`. Conventions: [`migration/CLAUDE.md`](migration/CLAUDE.md). |
| `ops/` | Operator scripts plus dated one-off SQL and runbooks (`*-migration-repair-2026-07-06.sql` is the ledger-row pattern; anchor-date repairs; the 2026-08-26 registration reopen; demo seeds). | `npm run seed:test-cycle [-- --fake-participants N \| --cleanup <cycle_id>]` seeds a drivable TEST cycle on dev; `npx tsx --env-file=.env.local scripts/ops/send-bulk-invites.ts --cycle-id N [--commit --prod]` sends magic-link invites; `.sql` files are pasted into Studio. | `SUPABASE_SERVICE_ROLE_KEY` (seed falls back to `.env.development.local`, refuses prod); invites also need `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_APP_URL`, `OWNER_EMAILS`. Conventions: [`ops/CLAUDE.md`](ops/CLAUDE.md). |
| `verify/cycle-e2e.mjs` | Live end-to-end walk of the cycle lifecycle at the data layer on **dev** (cycle → enroll → statements → votes → pods → proposals → projects), cleaning up after itself; `--keep` leaves the rows for inspection. | `npm run verify:cycle [-- --keep]` | `SUPABASE_SERVICE_ROLE_KEY` (falls back to `.env.development.local`); URL defaults to dev, `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` override; prod is refused. |

## How it fits

The `check-*` scripts are the mechanical half of the documentation contract: `docs-check`
([`.github/workflows/docs-check.yml`](../.github/workflows/docs-check.yml)) and `ci`
([`ci.yml`](../.github/workflows/ci.yml)) call them through the `npm run check:docs` and
`check:migrations` entries in [`package.json`](../package.json). `publish-artifacts.mjs`
is the engine of the OLOS → knowledge-repo bridge
([`publish-artifacts.yml`](../.github/workflows/publish-artifacts.yml), design in
[`docs/roadmap/documentation-topology.md`](../docs/roadmap/documentation-topology.md)).
The live-database scripts mirror selection and activation rules from `lib/` inline
(`verify/cycle-e2e.mjs` says which), so they must change when those rules do. The folder's
place in the tree is in
[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md#scripts--operational-scripts); the
manual test plan the seed script serves is
[`docs/testing-plan-cycle-uat.md`](../docs/testing-plan-cycle-uat.md); the migration
ledger these repairs touch is explained in [`supabase/README.md`](../supabase/README.md).

## Open issues in this area (snapshot 2026-10-02)

Live view: [label `area/ops`](https://github.com/TheUpskillingLabs/OLOS/issues?q=is%3Aopen+label%3Aarea%2Fops) ·
[all open issues](https://github.com/TheUpskillingLabs/OLOS/issues).

- [#404](https://github.com/TheUpskillingLabs/OLOS/issues/404) — Reconcile the `schema_migrations` ledger on dev and prod (metadata-only) — unblocks #77 (`priority/p1`)
- [#410](https://github.com/TheUpskillingLabs/OLOS/issues/410) — Knowledge-repo bridge: the token, the first automated publish, the first sweep PR, and archiving `docs-archive` (`priority/p1, size/s`)
- [#411](https://github.com/TheUpskillingLabs/OLOS/issues/411) — Turn on the docs steward (secret or Claude Routine) and run the first weekly triage (`priority/p2`)
- [#77](https://github.com/TheUpskillingLabs/OLOS/issues/77) — [ops] auto-apply Supabase migrations on merge to dev + main
- [#432](https://github.com/TheUpskillingLabs/OLOS/issues/432) — D2 — Apply migrations to dev automatically on merge to `dev` (the dev half of #77), once the ledger is reconciled (`priority/p2, size/s`)
- [#442](https://github.com/TheUpskillingLabs/OLOS/issues/442) — S2.9 — Baseline migration snapshot after the Summer cycle archives (`priority/p2, size/m`)

This list is a snapshot; the live view above is the truth. Refreshed at each sprint
boundary ([`docs/roadmap/documentation-framework.md` §9.1](../docs/roadmap/documentation-framework.md#91-the-sprint-boundary-refresh-onboarding-is-part-of-the-update-process)).

## Before you change something

- The checkers have no unit tests of their own; after editing one, run it on a file you
  know is broken and one you know is clean, then `npm run check:docs` and
  `npm run check:migrations` on the whole repo.
- Anything that writes to a live database keeps the safety contract in
  [`ops/CLAUDE.md`](ops/CLAUDE.md): dry-run by default, explicit `--commit`, a guard on
  the prod host, idempotent re-runs, PII-free logs. Test on dev only
  ([`docs/environments.md`](../docs/environments.md#all-test-data-goes-in-dev)).
- A one-off SQL repair gets a dated filename and a header that says why; if it changes
  the schema it is a migration instead (claim the number on the issue first, see
  [`supabase/README.md`](../supabase/README.md)).
- Never print or commit a secret value; the `.env*.local` files are gitignored for a reason.
- No real participants' names or emails in scripts, fixtures, or examples (the repo is
  public); UI-facing strings follow the copy rules ("The Labs", "Upskiller",
  "Poderator"; never course/class/student/lesson/module).
- Workflow: branch off `dev`, one issue, one PR — [`CONTRIBUTING.md`](../CONTRIBUTING.md).
