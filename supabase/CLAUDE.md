# supabase/ — migrations & DB conventions

Scope: this file applies to anything under [supabase/](.) — migrations, seed data, RLS, helper functions.

---

## Stack reality vs. roadmap wording

[OLOS-architecture-brief.md](../docs/OLOS-architecture-brief.md) and several issues describe a Python/FastAPI backend with Alembic migrations under `/api/db/migrations/`. **That stack does not exist in this repo.** The shipped stack is:

- Next.js App Router (frontend + API routes under [app/api/](../app/api/))
- Supabase Postgres, with raw-SQL migrations under [supabase/migrations/](migrations/)
- No Alembic, no `/api/db/`

When an issue says "Alembic migration under `/api/db/migrations/`", translate it to "raw-SQL migration under `supabase/migrations/`" using the conventions below. Do not introduce Alembic.

---

## Migration conventions

- **Filename:** `NNNNN_short_snake_case_description.sql`. `NNNNN` is the next zero-padded integer after the highest-numbered file currently in [migrations/](migrations/). Check before naming — don't assume.
- **Forward-only.** Supabase CLI applies files in lexical order; there is no separate down file. If a migration must be reversible, include the rollback as a commented `-- DOWN:` block at the bottom of the same file. Real rollbacks ship as a new forward migration.
- **Additive by default.** Prefer `ADD COLUMN`, `CREATE INDEX CONCURRENTLY` (where safe), new helper functions, etc. Destructive changes (`DROP COLUMN`, type narrowing, `NOT NULL` without default on a populated table) need an explicit backfill plan in the migration's header comment.
- **Header comment.** First lines explain *why*, not *what* — the SQL already shows what. Reference the issue or roadmap anchor (e.g. `-- ROADMAP §1.1 / ISSUE-W1-001`).
- **Defaults for new NOT NULL columns.** Every legacy row must satisfy the constraint. If no safe default exists, split into: (1) add nullable, (2) backfill, (3) set NOT NULL — across separate migrations.
- **RLS.** New tables need policies in the same migration or an immediate follow-up. Existing tables: confirm policies still cover new columns (column-level grants are rare here, so usually fine — but check [00002_rls_policies.sql](migrations/00002_rls_policies.sql) if in doubt).
- **No data writes** in schema migrations except trivial seed/lookup rows. Bulk data lives in [seed.sql](seed.sql) or one-off scripts.

## After writing a migration

1. Update [SCHEMA.md](../SCHEMA.md) — both the Mermaid ERD block for the affected table and the table summary if relevant. Schema docs drift fast; update in the same PR.
2. Run locally if a Supabase instance is up; otherwise call out in the PR that it has only been static-checked.
3. Reference the migration filename in the PR body.

---

## Active issue: ISSUE-W1-001 (#39) — extend `participants` for legacy field parity

Roadmap anchor: [§1.1](../docs/OLOS-roadmap.md). Unblocks §1.3, §1.4, §1.9, §1.13. Decision D4 is resolved: **single migration**, all eight columns at once.

### Columns to add

Add to `participants` (definition lives at [migrations/00001_initial_schema.sql:54-106](migrations/00001_initial_schema.sql#L54-L106)):

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `phone_number` | `VARCHAR(50)` | yes | — | free-form; legacy rows lack format normalization |
| `email_updates` | `BOOLEAN` | yes | — | nullable because legacy form wording shifted mid-cycle |
| `comms_consent` | `BOOLEAN` | no | `TRUE` | every legacy row had "I agree" before submission, so backfill is safe |
| `availability_notes` | `TEXT` | yes | — | |
| `commitment_notes` | `TEXT` | yes | — | |
| `interest_areas` | `TEXT` | yes | — | free-text for now; may later normalize to an `option_lists` entry |
| `moderator_experience` | `TEXT` | yes | — | |
| `notes` | `TEXT` | yes | — | staff-facing scratchpad |

### Execution checklist

- [ ] Create `supabase/migrations/00011_extend_participants_legacy_fields.sql` with all eight `ADD COLUMN` statements in one migration (per D4). (Originally drafted as `00010_*` but renumbered after `main` shipped `00010_pulse_check_v2.sql` via PR #53.)
- [ ] Header comment cites `ROADMAP §1.1 / ISSUE-W1-001` and the rationale for `comms_consent` defaulting to `TRUE`.
- [ ] Append a commented `-- DOWN:` block with `ALTER TABLE participants DROP COLUMN ...` for each new column.
- [ ] Update [SCHEMA.md](../SCHEMA.md) `participants` ERD block (lines ~80–108) to list the new columns.
- [ ] Verify no existing RLS policy in [00002_rls_policies.sql](migrations/00002_rls_policies.sql) needs to change — current policies are row-level, not column-level, so additions inherit.

### Out of scope (do not pull in)

- The registration form does not yet write these columns at the API/UI layer. That is downstream work in §1.4 / Wave 2.
- `pod_limit` move to `cycle_config` — that is §2.1.
- `mentors` table — pending decision D3.

### Verification

- Apply against a clean staging DB: should run with no errors.
- Apply against a DB with existing `participants` rows: `comms_consent` defaults to `TRUE`, all other new columns are `NULL`. Confirm with `\d participants`.
- Rollback test: copy the `-- DOWN:` block into a scratch query, run, confirm columns gone, then re-apply the up migration.

---

## Upcoming migrations on the roadmap

These will live in this folder when their issues open. Linked here so future sessions can plan ahead, not act ahead.

- §1.2 — seed `option_lists` (six lists). Lives in [seed.sql](seed.sql) or a dedicated migration; decide based on whether values should be re-seedable.
- §2.1 — move `pod_limit` from hardcoded constant into `cycle_config`. Will require coordinated API change in [app/api/pods/](../app/api/pods/).
- §2.2 — add `problem_statements.context JSONB` and `problem_statements.theme_track VARCHAR(100)` (with index).
- §2.8 — `mentors` table, conditional on D3.
