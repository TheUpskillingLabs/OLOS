# supabase/ — migrations & DB conventions

Scope: this file applies to anything under [supabase/](.) — migrations, seed data, RLS, helper functions.

---

## Stack reality vs. roadmap wording

[OLOS-architecture-brief.md](../docs/archive/OLOS-architecture-brief.md) (now archived) and several early issues describe a Python/FastAPI backend with Alembic migrations under `/api/db/migrations/`. **That stack does not exist in this repo.** The shipped stack is:

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

## Before writing a migration

The roadmap is the plan; [migrations/](migrations/) is the truth. They drift. Run these three checks before you touch a file:

1. **Read what shipped.** `ls migrations/` and skim any migration whose name touches your subject. A prior migration may have already done part — or all — of your issue's scope. The cost of finding out at code-review time is much higher than the 60 seconds it takes here.
2. **Shrink scope to what's actually missing.** If a prior migration absorbed part of your issue, don't redo that work. Update the roadmap entry (e.g. `§1.2`) to record what's already done and what's left, then write your migration to cover only the remainder. Document the divergence in the PR body so the next person reading the issue understands what changed.
3. **If you change a value the spec defines, close the loop.** The founding spec is now archived at [docs/archive/TUL_MVP_Spec.md](../docs/archive/TUL_MVP_Spec.md) — it's a historical record, don't edit it. When your migration ships values that contradict it (or any current doc), add a row to `OLOS-roadmap.md §5 Open Decisions` pointing at your migration as the new source of truth, and update the affected living doc (`SCHEMA.md`, `docs/ARCHITECTURE.md`) in the same PR. Never leave the record quietly stale. (See §1.2's `00010_pulse_check_v2.sql` situation for what happens when this is skipped: a downstream issue gets written from stale spec assumptions and the conflict surfaces only at PR time.)

---

## After writing a migration

1. Update [SCHEMA.md](../SCHEMA.md) — both the Mermaid ERD block for the affected table and the table summary if relevant. Schema docs drift fast; update in the same PR.
2. Run locally if a Supabase instance is up; otherwise call out in the PR that it has only been static-checked.
3. Reference the migration filename in the PR body.

---

## Migration consolidation policy

The `migrations/` chain accretes. Small, single-purpose migrations are convenient at the moment but become noise over time (the chain now runs through `00039_hq_lab_cycle_model.sql` — 39 files; the smallest is 60 bytes). Two countermeasures:

### 1. Batch at write-time

Before writing a one-line `ALTER`, look for a logically related migration that's still in-flight on a feature branch. If there is one, fold the change in rather than starting a new file. Test: "would a reviewer think these belong in one PR?" — if yes, one migration.

W1-001's [migrations/00011_extend_participants_legacy_fields.sql](migrations/00011_extend_participants_legacy_fields.sql) is the pattern to copy: eight columns added in one `ALTER TABLE`, one header comment explaining all eight. **Don't** ship eight migrations of one column each.

If a small change really has no natural home, weigh the value against the chain noise. A solo `ADD COLUMN` for a feature that's nice-to-have but not required is usually deferrable to the next feature that needs the table — at which point both ship together. (See the `participation_expectations` decision in the W1-003 thread, 2026-05-06: a one-column migration was rejected because the marginal engagement-team value didn't justify the chain entry. Logged in [scripts/migration/CLAUDE.md](../scripts/migration/CLAUDE.md) under *Prose → enum normalization* as a deferred candidate for the end-of-Wave-1 batch.)

### 2. Periodic baseline snapshot

At wave boundaries (end of W1, W2, W3 — i.e., after a `Pulse opens` / `Project submission opens` / `Voting opens` milestone has stabilized for at least a week with no follow-up hotfix migrations), produce a single `0NNNN_baseline_<date>.sql` from a clean DB with all migrations applied:

```bash
supabase db dump --schema public > supabase/migrations/00099_baseline_2026-XX-XX.sql
git mv supabase/migrations/000{01..NN}_*.sql supabase/migrations/archive/
```

Fresh installs use the baseline; deployed environments are unaffected (they've already applied the historical chain incrementally). The archive folder stays in the repo for git-blame and reproducing the history.

**Don't consolidate mid-wave.** In-flight PRs will collide on migration numbers, staging needs re-baselining, and any partially-applied chain on a developer's local DB will break. The right moment is when a wave's data shape stabilizes — usually a week after the wave's milestone PR merges.

---

## Renumber history

| Original | Renamed to | Date | Reason |
|---|---|---|---|
| `00015_pod_memberships_preference_rank.sql` | `00028_pod_memberships_preference_rank.sql` | 2026-06-02 | Filename collided with `00015_grant_role_privileges.sql`. `supabase_migrations.schema_migrations.version` is a PK, so `supabase db push --include-all` couldn't insert both. The preference-rank DDL was already applied to dev; renumbering the disk file plus a one-row repair on the remote brought tracking back in sync. See the renamed file's header for the repair SQL pointer. |

Going forward: **never reuse a migration number.** Before writing a new file, `ls supabase/migrations/ | tail -1` to confirm the next free number.

---

## Shipped: ISSUE-W1-002 (#40) — seed `option_lists` (00012)

**Resolved.** [migrations/00012_seed_option_lists.sql](migrations/00012_seed_option_lists.sql) (PR #58) shipped and applied the four lists `00010` didn't cover — `labs_goals`, `availability`, `work_style`, `group_strengths`, 20 rows — completing the six-list set; the execution checklist below is fully executed. Everything from here down to *Recently landed* is the historical work record, kept because it documents the seeding conventions (idempotent `ON CONFLICT`, `display_order` in increments of 10, byte-for-byte participant-facing strings) that any future `option_lists` change should copy.

Roadmap anchor: [§1.2](../docs/OLOS-roadmap.md). Unblocked §1.9 (pulse-check endpoint validates `tools_used` / `benefits` against these IDs) and §1.11 (registration form fetches options from `GET /api/options`). The schema for `option_lists` lives at [migrations/00001_initial_schema.sql:108-116](migrations/00001_initial_schema.sql#L108-L116), including the `UNIQUE(list_name, value)` constraint used for idempotency. The read endpoint is at [app/api/options/route.ts](../app/api/options/route.ts) — verifying its output was the acceptance test, not new work.

### Scope: 4 lists, not 6

[migrations/00010_pulse_check_v2.sql](migrations/00010_pulse_check_v2.sql) (PR #53) already shipped two of the six lists to staging/prod, with deliberate spec divergence:
- **`ai_tools`** expanded from spec's 7 values to 61 (Claude Code, Cursor, Windsurf, etc.) for autocomplete in the V2 pulse-check form.
- **`pulse_benefits`** reworded from spec's 6 generic values to 7 "Labs value-prop aligned" values. Original 6 are kept with `active = FALSE` so historical `pulse_checks.survey_responses` references still resolve.

This migration ships the four lists 00010 didn't touch — `labs_goals` (6), `availability` (4), `work_style` (4), `group_strengths` (6) — for **20 rows total**. The spec's values for these four are still product-correct, so `display_order` increments of 10 and verbatim strings apply.

The issue's AC mentions "33 rows" / "match spec exactly" / "38 + extras" — all three are stale relative to what `00010` already shipped. The actual delivery for W1-002 is now: every option_lists row that ships to participants lives in a migration, not in seed.sql. Combined with `00010`, that's true for all six lists once this migrates.

### Why a dedicated migration, not seed.sql

[seed.sql](seed.sql) only runs on `supabase db reset` against a local DB; staging and prod never see it. Leaving rows there means prod dropdowns are empty. The migration is also idempotent (`ON CONFLICT DO NOTHING`), which is migration territory, not fixture territory.

The four list blocks were removed from seed.sql in this PR; the `ai_tools` and `pulse_benefits` blocks stay because 00010 still co-owns them and both already have `ON CONFLICT DO NOTHING`. The `participant_options` block further down in seed.sql references `option_id` values that are now produced by 00010 and 00012 together — the existing comment about "ai_tools 1-7, labs_goals 8-13…" is **stale post-00010** (after 00010, IDs 1–7 are pulse_benefits, IDs 8–63 are ai_tools). Fixing that comment is out of scope for W1-002 — it pre-exists this PR. Flag it in the PR body so it can be picked up separately.

### Data — verbatim from [`TUL_MVP_Spec.md`](../docs/archive/TUL_MVP_Spec.md) §option_lists Seed Data (spec since archived)

| `list_name` | `value`s, in order |
|---|---|
| `labs_goals` (6) | Build a portfolio project · Learn AI tools in practice · Connect with collaborators · Explore a new career direction · Contribute to community impact · Sharpen technical skills |
| `availability` (4) | < 2 hrs/week · 2–5 hrs/week · 5–10 hrs/week · 10+ hrs/week |
| `work_style` (4) | Independent with check-ins · Collaborative throughout · Structured with clear milestones · Flexible and self-directed |
| `group_strengths` (6) | Project management · Technical development · Design / UX · Research · Communication / writing · Community engagement |

Strings must match the spec **byte-for-byte** — they render to participants. Watch for:
- En-dash (`–`, U+2013) in `2–5 hrs/week` and `5–10 hrs/week` — not a hyphen.
- Spaces around `/` in `Design / UX` and `Communication / writing`.
- Lowercase in `< 2 hrs/week` and `10+ hrs/week`.

### Migration conventions for this file

- `display_order` in **increments of 10** (10, 20, 30…), so a future insert can slot in at 25 without renumbering.
- One INSERT statement per list (multi-row VALUES) for readability.
- `ON CONFLICT (list_name, value) DO NOTHING` on every INSERT for idempotency.
- Do not set `id` — let `SERIAL` assign.
- Do not set `active` — let the column default (`TRUE`) apply.
- No `-- DOWN:` block. `option_lists` rows are referenced by `participant_options` FKs; retirement happens via the spec's `PATCH /api/options/{id}` (`active = FALSE`), not rollback.

### Execution checklist

- [x] Create `supabase/migrations/00012_seed_option_lists.sql` with 20 rows across the four lists, `display_order` 10/20/30…, `ON CONFLICT (list_name, value) DO NOTHING`.
- [x] Header comment cites `ROADMAP §1.2 / ISSUE-W1-002` and explains the 00010 absorption.
- [x] Remove the four covered list blocks from `seed.sql`; keep the `ai_tools` and `pulse_benefits` blocks (00010-owned).
- [x] Update [docs/OLOS-roadmap.md §1.2](../docs/OLOS-roadmap.md) to record 00010's absorption and the trimmed scope. Update §6 status tracker.
- [x] PR body explains the AC scope shift (33 → 20) and points at this CLAUDE.md section.

### Out of scope (do not pull in)

- Admin UI for editing options — `POST /api/options` already exists ([app/api/options/route.ts:31-49](../app/api/options/route.ts#L31-L49)); the form lives in §2.3.
- Mentor-specific lists — Wave 2, conditional on D3.
- Validation that `pulse_checks.survey_responses.tools_used[]` references real `option_lists.id`s with `list_name = 'ai_tools'` — that's §1.9.
- Re-seeding `ai_tools` or `pulse_benefits`. 00010 owns them; this migration must not duplicate.
- Fixing the stale `participant_options` ID-mapping comment in `seed.sql` (line ~368). Pre-existing post-00010, separate cleanup.

### Verification

- Apply against a clean DB: `SELECT list_name, COUNT(*) FROM option_lists WHERE active GROUP BY list_name ORDER BY list_name` returns six rows: `ai_tools`=61, `availability`=4, `group_strengths`=6, `labs_goals`=6, `pulse_benefits`=7, `work_style`=4 (88 total active).
- Apply 00012 twice: row count unchanged, no errors.
- `curl http://localhost:3000/api/options` returns all six keys, each an array of `{id, value}` objects, ordered by `display_order`. Spot-check en-dash renders as `2–5 hrs/week`, not `2-5 hrs/week`.

---

## Recently landed (July 2026)

The top of the chain is the labs model — read both headers before touching cycle/pod/project scoping:

- [00038_labs_lead_and_cycle_metro.sql](migrations/00038_labs_lead_and_cycle_metro.sql) — metro-scoped `labs_lead` role: `cycles.metro_slug`, plus the `user_roles.role` CHECK widened to include `developer` / `labs_lead`.
- [00039_hq_lab_cycle_model.sql](migrations/00039_hq_lab_cycle_model.sql) — HQ / Local-Lab / HQ-internal cycle taxonomy: `cycles.is_hq_internal`, and the lab boundary moved down to `pods.metro_slug` / `projects.metro_slug` for per-lab pod formation and lab-partitioned voting. Enforcement lives in [lib/auth/cycle-access.ts](../lib/auth/cycle-access.ts). Note 00039's header corrects 00038's "one cycle = one lab" assumption.

Before those, July also brought funnel registration + the Open Cycle Agreement (`00031`–`00032`), registration windows + cycle info (`00033`, with `00034` as a drift repair), and vote-lifecycle policies + configurable `pod_limit` (`00035`–`00037`). See [docs/OLOS-roadmap.md §8](../docs/OLOS-roadmap.md) for the full post-Wave-1 record.

## Upcoming migrations on the roadmap

These will live in this folder when their issues open. Linked here so future sessions can plan ahead, not act ahead.

- §2.1 — **shipped** as [migrations/00036_cycle_config_pod_limit.sql](migrations/00036_cycle_config_pod_limit.sql), with the register-route reads moved to `cycle_config.pod_limit`.
- §2.2 — add `problem_statements.context JSONB` and `problem_statements.theme_track VARCHAR(100)` (with index). Still open.
- §2.8 — `mentors` table, conditional on D3. Still open.
