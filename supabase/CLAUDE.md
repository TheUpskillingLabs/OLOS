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

## Active issue: ISSUE-W1-002 (#40) — seed `option_lists` per spec

Roadmap anchor: [§1.2](../docs/OLOS-roadmap.md). Unblocks §1.9 (pulse-check endpoint validates `tools_used` / `benefits` against these IDs) and §1.11 (registration form fetches options from `GET /api/options`). The schema for `option_lists` already exists at [migrations/00001_initial_schema.sql:108-116](migrations/00001_initial_schema.sql#L108-L116), including the `UNIQUE(list_name, value)` constraint we'll need for idempotency. The read endpoint is also already shipped at [app/api/options/route.ts](../app/api/options/route.ts) — verifying its output is the acceptance test, not new work.

### Why a dedicated migration, not seed.sql

The six lists ship to **production**. [seed.sql](seed.sql) only runs on `supabase db reset` against a local DB; staging and prod never see it. Leaving the rows there means prod has empty dropdowns. The issue also requires re-runnability (`ON CONFLICT DO NOTHING`), which is migration territory, not fixture territory.

The current [seed.sql:4-53](seed.sql#L4-L53) already contains an INSERT block for the six lists with `display_order 1..N`. **Move it** into the new migration (don't duplicate). seed.sql can keep its `participant_options` block (currently around line 302) because migrations apply before seed and the `SERIAL` ordering is deterministic — `ai_tools` IDs land at 1–7, `labs_goals` at 8–13, etc., exactly as the existing seed comment promises.

### File

Create `supabase/migrations/00012_seed_option_lists.sql` (next number after [00011_extend_participants_legacy_fields.sql](migrations/00011_extend_participants_legacy_fields.sql)). Header comment cites `ROADMAP §1.2 / ISSUE-W1-002` and the rationale (lists must seed on prod, must be idempotent).

### Data — copy verbatim from `TUL_MVP_Spec.md` §option_lists Seed Data

| `list_name` | `value`s, in order |
|---|---|
| `ai_tools` (7) | ChatGPT · Claude · Copilot · Gemini · Midjourney / DALL-E · Perplexity · Other |
| `labs_goals` (6) | Build a portfolio project · Learn AI tools in practice · Connect with collaborators · Explore a new career direction · Contribute to community impact · Sharpen technical skills |
| `availability` (4) | < 2 hrs/week · 2–5 hrs/week · 5–10 hrs/week · 10+ hrs/week |
| `work_style` (4) | Independent with check-ins · Collaborative throughout · Structured with clear milestones · Flexible and self-directed |
| `group_strengths` (6) | Project management · Technical development · Design / UX · Research · Communication / writing · Community engagement |
| `pulse_benefits` (6) | Applied AI tools to a real project · Learned a new skill or concept · Connected with a new collaborator · Received helpful feedback · Contributed meaningfully to my pod · Overcame a technical challenge |

Strings must match the spec **byte-for-byte** — these get rendered to participants. Watch for:
- En-dash (`–`, U+2013) in `2–5 hrs/week` and `5–10 hrs/week` — not a hyphen.
- Spaces around `/` in `Midjourney / DALL-E` and `Design / UX`.
- Lowercase in `< 2 hrs/week` and `10+ hrs/week`.

### Migration conventions for this file

- `display_order` in **increments of 10** (10, 20, 30…) per the issue, so a future "ChatGPT 4.5" between Claude and Copilot can slot in at 25 without renumbering.
- One INSERT statement per list (multi-row VALUES) for readability.
- `ON CONFLICT (list_name, value) DO NOTHING` on every INSERT for idempotency.
- Do not set `id` — let `SERIAL` assign.
- Do not set `active` — let the column default (`TRUE`) apply.
- No `-- DOWN:` block. `option_lists` rows are referenced by `participant_options` FKs; retirement happens via the spec's `PATCH /api/options/{id}` (`active = FALSE`), not rollback.

### Row count: 33, not 38

The issue's AC says "38 total rows (7 + 6 + 4 + 4 + 6 + 6 + extras as defined in spec)". The arithmetic 7+6+4+4+6+6 = **33**, and the spec defines exactly 33 — there are no "extras". The implementation note `"Seed values must match TUL_MVP_Spec.md exactly"` is the tiebreaker. Insert 33; flag the AC discrepancy in the PR description so the issue author can correct it.

### Execution checklist

- [ ] Create `supabase/migrations/00012_seed_option_lists.sql` with 33 rows across the six lists, `display_order` 10/20/30…, `ON CONFLICT (list_name, value) DO NOTHING`.
- [ ] Header comment cites `ROADMAP §1.2 / ISSUE-W1-002`.
- [ ] Remove the duplicate `option_lists` INSERT block from [seed.sql:4-53](seed.sql#L4-L53). Leave the `participant_options` block (line ~302) untouched — it depends on the IDs the migration produces.
- [ ] Spot-check [SCHEMA.md](../SCHEMA.md) — if it documents seed contents for `option_lists`, update; if it only describes columns, leave alone.
- [ ] PR body notes the 33-vs-38 discrepancy and links the spec section.

### Out of scope (do not pull in)

- Admin UI for editing options — `POST /api/options` already exists ([app/api/options/route.ts:31-49](../app/api/options/route.ts#L31-L49)); the form lives in §2.3.
- Mentor-specific lists — Wave 2, conditional on D3.
- Validation that `pulse_checks.survey_responses.tools_used[]` references real `option_lists.id`s with `list_name = 'ai_tools'` — that's §1.9.
- Renumbering pre-existing rows on a DB that's already been seeded from the old `1..N` ordering. Not worth a backfill; new rows get 10-spaced, old rows keep their numbers, ordering remains correct.

### Verification

- Apply against a clean DB: `SELECT list_name, COUNT(*) FROM option_lists GROUP BY list_name ORDER BY list_name` returns six rows summing to 33 (`ai_tools`=7, `availability`=4, `group_strengths`=6, `labs_goals`=6, `pulse_benefits`=6, `work_style`=4).
- Apply twice: row count unchanged, no errors.
- `curl http://localhost:3000/api/options` returns all six keys, each an array of `{id, value}` objects, ordered by `display_order`. Spot-check that the en-dash strings render as `2–5 hrs/week`, not `2-5 hrs/week`.

---

## Upcoming migrations on the roadmap

These will live in this folder when their issues open. Linked here so future sessions can plan ahead, not act ahead.

- §2.1 — move `pod_limit` from hardcoded constant into `cycle_config`. Will require coordinated API change in [app/api/pods/](../app/api/pods/).
- §2.2 — add `problem_statements.context JSONB` and `problem_statements.theme_track VARCHAR(100)` (with index).
- §2.8 — `mentors` table, conditional on D3.
