# `supabase/` — the database: migrations, local config, seed data

| | |
|---|---|
| **What this is** | The Postgres schema as a numbered chain of raw-SQL migrations, plus the local Supabase stack's config and a seed for `db reset`. |
| **Zone / owner** | `migrations` zone in the [file-ownership map](../docs/agent-teams.md#file-ownership-map-avoid-conflicts): owns `supabase/migrations/` and [`SCHEMA.md`](../SCHEMA.md). Claim the migration number first. |
| **Conventions** | agent conventions: [`CLAUDE.md`](CLAUDE.md) (filename, forward-only, additive, header comment, RLS, consolidation policy, renumber history). |
| **Last verified** | 2026-10-02 |

## What is here

| Path | What it does | Notes |
|---|---|---|
| `migrations/` | 103 files, `00001`–`00103`, applied in lexical order; the schema's source of truth. | No `archive/` yet (the consolidation policy in `CLAUDE.md` describes one). |
| `config.toml` | The **local** stack only: project id `olos`, Postgres 17, ports (API 54321, DB 54322, Studio 54323, Inbucket 54324), Google OAuth via `env(GOOGLE_CLIENT_ID)` / `env(GOOGLE_CLIENT_SECRET)`, seed from `./seed.sql`. | Not used by the hosted dev or prod projects. |
| `seed.sql` | Runs on `supabase db reset` locally: the `ai_tools` and `pulse_benefits` option lists, then a finished dummy cycle (config, 20 fake participants, enrollments, roles, statements, votes, 3 pods, proposals, 3 projects, pulse checks). | Dev and prod never see it. The other four option lists ship in `00012`. The ID-mapping comment near line 341 is stale (flagged in `CLAUDE.md`). |

### Ranges worth knowing

| Range | What it holds |
|---|---|
| `00001`–`00002` | Initial schema and the RLS policies every later table builds on. |
| `00009`, `00015` | Permissions model; role grants plus `ALTER DEFAULT PRIVILEGES`, which covers future tables. |
| `00010`, `00012` | `option_lists` seeds that ship to prod (not `seed.sql`). |
| `00028`, `00085` | Renumbered after collisions — see "Renumber history" in `CLAUDE.md`. |
| `00033`–`00036` | Public content, Luma sync, metros. |
| `00040`, `00087`, `00091` | Learning logs and the weekly gate. |
| `00057`–`00058` | `email_log` + consent; admin roles and erasure. |
| `00086`–`00100` | Applied out of band, so the ledger drifted (below). |
| `00096`–`00097` | The task system (`task_dismissals`, `custom_tasks`). |

### The latest ten (headers read 2026-10-02)

| File | One line |
|---|---|
| `00094_event_about.sql` | `events.about`: the full Luma "About" text, Luma-owned, overwritten on every sync. |
| `00095_event_location_address.sql` | Splits the venue label from the full postal address and the virtual join link. |
| `00096_task_dismissals.sql` | Per-member dismissals of dashboard tasks, keyed by occurrence (replaces localStorage). |
| `00097_custom_tasks.sql` | Admin-authored tasks from `/admin/tasks`, merged into the queue as `kind='custom'`. |
| `00098_simulation_sessions.sql` | Audit trail for the admin "View as" member-view simulation. |
| `00099_enrollment_registered_status.sql` | Adds the `registered` pre-pod enrollment status. **Backfill is not idempotent**; already on dev under its old name `00092`. |
| `00100_access_revocations_fresh_rows.sql` | Drops the `00030` idempotency index so a re-revocation writes a fresh audit row. |
| `00101_project_membership_cap_trigger.sql` | DB trigger enforcing `cycle_config.project_max` per project. |
| `00102_participant_bans.sql` | A ban that blocks sign-in, distinct from archive and delete. |
| `00103_admin_project_membership.sql` | Admin path to place and move people on projects (and their pods). |

### Next free number

`00104` is the next number on disk, but the hand-off brief
([§6.1–§6.2](../docs/roadmap/handoff-2026-09-28-onboarding-journeys.md#6-sequencing-the-shared-files-and-the-cross-lane-rulings))
has already assigned `00104` to lane S (`weekly_messages` audiences, #460), `00105` to
lane C (Cycle v2, epic #459), `00106` to lane P (the Poderator weekly goal, #461), and
`00107` to #470. Check those issues before taking `00108`, and claim yours on your issue.

## How it fits

Every API route and `lib/` module reads this schema through the client factories in
`lib/supabase/`; RLS from `00002` onward decides what each role sees. The ERD and
table summaries are in [`SCHEMA.md`](../SCHEMA.md); the folder's place in the tree is in
[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md#supabase--the-database); which
project is dev and which is prod is in [`docs/environments.md`](../docs/environments.md).

**Applying migrations — the ledger has drifted.** Per
[`docs/environments.md` "Ledger drift"](../docs/environments.md#-ledger-drift-verified-2026-08-21-open--issue-361):
the chain `00001`–`00103` is physically applied to both dev and prod, but
`supabase_migrations.schema_migrations` records a mix of numeric and timestamp versions
because `00086`–`00100` went in out of band. Until #404 reconciles it, **do not run
`supabase db push` against either project** (it would re-run applied migrations, and
`00099` is not idempotent). Apply a new migration by pasting the file into Studio → SQL
Editor, then insert the ledger row by hand following
[`scripts/ops/dev-migration-repair-2026-07-06.sql`](../scripts/ops/dev-migration-repair-2026-07-06.sql)
/ [`prod-…`](../scripts/ops/prod-migration-repair-2026-07-06.sql), and record each
prod apply under **Ops** in [`CHANGELOG.md`](../CHANGELOG.md). Automatic apply on merge
is #432 (dev) and #77 (both), after #404.

## Open issues in this area (snapshot 2026-10-02)

Live view: [label `area/backend`](https://github.com/TheUpskillingLabs/OLOS/issues?q=is%3Aopen+label%3Aarea%2Fbackend) ·
[label `area/ops`](https://github.com/TheUpskillingLabs/OLOS/issues?q=is%3Aopen+label%3Aarea%2Fops) ·
[all open issues](https://github.com/TheUpskillingLabs/OLOS/issues).

- [#404](https://github.com/TheUpskillingLabs/OLOS/issues/404) — Reconcile the `schema_migrations` ledger on dev and prod (metadata-only) — unblocks #77 (`priority/p1`)
- [#77](https://github.com/TheUpskillingLabs/OLOS/issues/77) — [ops] auto-apply Supabase migrations on merge to dev + main
- [#432](https://github.com/TheUpskillingLabs/OLOS/issues/432) — D2 — Apply migrations to dev automatically on merge to `dev` (the dev half of #77), once the ledger is reconciled (`priority/p2, size/s`)
- [#442](https://github.com/TheUpskillingLabs/OLOS/issues/442) — S2.9 — Baseline migration snapshot after the Summer cycle archives (`priority/p2, size/m`)
- [#427](https://github.com/TheUpskillingLabs/OLOS/issues/427) — C2 — Metrics views migration: `v_cycle_funnel`, `v_weekly_engagement`, `v_participant_journey`, `v_cohort_retention`, `v_preregistration_pipeline` (`priority/p1, size/m`)
- [#418](https://github.com/TheUpskillingLabs/OLOS/issues/418) — A7 — `v_preregistration_pipeline` view + the pipeline block on `/admin/insights` (`priority/p2, size/s`)
- [#421](https://github.com/TheUpskillingLabs/OLOS/issues/421) — B2 — `outreach_log`: record that a Poderator reached out (channel, note), visible to that pod's Poderators and admins only (`priority/p1, size/m`)
- [#416](https://github.com/TheUpskillingLabs/OLOS/issues/416) — A3 — Pre-cycle drip: `scheduled_messages` + admin form + daily cron, consent-gated, `email_log`-idempotent, dry-run by default (`priority/p1, size/l, persona/pre-registrant`)
- [#115](https://github.com/TheUpskillingLabs/OLOS/issues/115) — [ops][p2] Admin audit columns on pod_memberships (deferred from #110 Phase B) (`priority/p2, size/s`)
- [#125](https://github.com/TheUpskillingLabs/OLOS/issues/125) — [refactor][p3] Move 'reactivated' rows out of access_revocations (semantic cleanup) (`priority/p2, size/s`)
- [#433](https://github.com/TheUpskillingLabs/OLOS/issues/433) — D3 — Prune the dead enrollment vocabulary (`interested`, `completed`); keep `stepped_back` reserved with a comment (`priority/p2, size/s`)
- [#469](https://github.com/TheUpskillingLabs/OLOS/issues/469) — CV2 — Builder track: the `builder_join` window, `cycle_enrollments.tier` stamped at agreement, a ceremony that names only the events still ahead, the register-card copy, and the pod's "ready for builders" chip (`priority/p1, size/m`)
- [#434](https://github.com/TheUpskillingLabs/OLOS/issues/434) — S2.1 — `activity_events` spine: table, writer helper, ceremonial verbs from the existing write paths, `visibility` RLS (`priority/p1, size/l`)
- [#440](https://github.com/TheUpskillingLabs/OLOS/issues/440) — S2.7 — Data catalog (PII class, writers, erasure, retention per table) + the erasure FK-walk test (closes the #383 gap class) (`priority/p1, size/m`)
- [#408](https://github.com/TheUpskillingLabs/OLOS/issues/408) — State-machine reference (`docs/reference/state-machines.md`) + a test that the CHECK vocabularies equal the TypeScript unions (`priority/p1, size/s`)

This list is a snapshot; the live view above is the truth. Refreshed at each sprint
boundary ([`docs/roadmap/documentation-framework.md` §9.1](../docs/roadmap/documentation-framework.md#91-the-sprint-boundary-refresh-onboarding-is-part-of-the-update-process)).

## Before you change something

- **Claim the number on the issue first**, then `ls migrations/ | tail -1`. Never reuse a
  number. `npm run check:migrations` runs in CI, in `docs-check`, and in the `.claude`
  `TaskCompleted` hook; a duplicate goes red at PR-open.
- Follow [`CLAUDE.md`](CLAUDE.md): a header that says *why*, forward-only, additive by
  default, RLS in the same migration, no data writes beyond trivial lookup rows.
- Update [`SCHEMA.md`](../SCHEMA.md) in the same PR —
  [`docs-check`](../.github/workflows/docs-check.yml) fails otherwise (the
  `schema-doc-exempt` label needs a reason in the PR body). Add a `CHANGELOG.md` line.
- Tests: `npm run test` (Vitest) covers `lib/` logic, not SQL. `npm run verify:cycle`
  walks the cycle lifecycle against the **dev** schema with the service role;
  `node scripts/check-embeds.mjs` smoke-tests PostgREST embeds. See
  [`scripts/README.md`](../scripts/README.md).
- Constitution and copy: no activity-telemetry tables; nothing that shames a member who
  is behind; CHECK vocabularies that reach the UI use "Upskiller" and "Poderator", never
  course/class/student/lesson/module; no real participants' names in seed data (the repo
  is public).
- Workflow: branch off `dev`, one issue, one PR — [`CONTRIBUTING.md`](../CONTRIBUTING.md).
