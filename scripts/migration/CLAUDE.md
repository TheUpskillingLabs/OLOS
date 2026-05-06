# scripts/migration/ — legacy spreadsheet → Postgres

Scope: this file applies to anything under [scripts/migration/](.) — the column-mapping CSV (W1-003), the Python migration script that consumes it (W1-004), and the prod cutover (W1-005).

Roadmap anchors: [§1.3](../../docs/OLOS-roadmap.md), [§1.4](../../docs/OLOS-roadmap.md), [§1.5](../../docs/OLOS-roadmap.md). Together these are three of the four nodes on Wave 1's critical path; if any slips, May 7 slips.

---

## Why this folder structure

| Path | Why here |
|---|---|
| `scripts/migration/CLAUDE.md` | CLAUDE.md is folder-scoped and inherits to every sibling. Three Wave-1 issues converge here; one root-level guidance file fits all of them. Mirrors the [supabase/CLAUDE.md](../../supabase/CLAUDE.md) precedent. |
| `scripts/migration/column_mapping.csv` | Path is dictated verbatim by the issue spec. Only one CSV is in scope; subfoldering one file is premature structure. Lives next to its consumer (`migrate.py`) so the relationship is local and visible. |
| `scripts/` (top-level) | Operational tooling — distinct from the Next.js app under `app/` and the Postgres migrations under `supabase/migrations/`. The architecture brief reserves this path for "operational scripts (migration, magic-link bulk gen)." |

---

## Stack reality vs. roadmap wording

[OLOS-architecture-brief.md](../../docs/OLOS-architecture-brief.md) describes a Python / FastAPI backend. **The shipped application stack is Next.js + Supabase Postgres** (see [supabase/CLAUDE.md](../../supabase/CLAUDE.md) for the full story).

This folder is the lone exception. The legacy-data migration is a **one-shot Python tool**, not application code:

- Runs once per environment (staging then prod), then never again.
- Needs `pandas` / `openpyxl` for spreadsheet reads — adding that to the Next.js dependency tree just to delete it after one use is the wrong tradeoff.
- Writes to Postgres via direct `psycopg` against the Supabase connection string — no Supabase JS client, no Next.js route.

So: Python here, TypeScript everywhere else. Don't generalise this exception into a "we have a Python backend" inference.

---

## What lives here

| File | Purpose | Issue |
|---|---|---|
| `column_mapping.csv` | Reviewable artifact mapping every legacy spreadsheet column to its destination SQL column or junction-table option | W1-003 (#41) |
| `migrate.py` *(future)* | Reads the .xlsx, applies `column_mapping.csv`, writes to Postgres | W1-004 |
| `requirements.txt` *(future)* | `pandas`, `openpyxl`, `psycopg[binary]`, `python-dotenv` | W1-004 |

---

## Source data: where the spreadsheet lives

| File | Purpose |
|---|---|
| [`docs/Upskiller Community Manager.xlsx`](../../docs/Upskiller%20Community%20Manager.xlsx) | The 9-sheet workbook itself — authoritative source for all migration work |
| [`docs/Upskiller Community Manager CSV.csv`](../../docs/Upskiller%20Community%20Manager%20CSV.csv) | Single-sheet CSV export of `Upskiller Registrations` only — convenient for grep / diff but not the migration input |

Both files contain real participant data including PII (names, emails, phone numbers, neighbourhood). Treat as sensitive: do not paste rows into logs or external tools, and the migration script must never log row contents.

---

## Test data strategy

Health-cycle data in this repo is **fixture data, not production data**. It exists for one reason: it's the only sheet with vote records, so the W1-004 script's votes-loading and pod-finalization passes have nothing else to exercise until Energy reaches its voting phase. Once Energy votes complete, Health's role as the unique vote-test source ends — but it remains useful as a regression fixture.

Three guardrails follow from "Health is for testing only" — all enforced in the W1-004 script, not relied on as operator discipline:

1. **Anonymize on load.** Hash emails and names for any row whose source sheet starts with `Health` (`Health Pod Registration`, `Health Voting & Pods`). Vote and membership *relationships* are preserved — same input email always hashes to the same `participant_id`, so foreign keys stay intact — but real identities do not land in staging Postgres. The hash function is keyed off a per-environment salt so the same Health email gets a different `participant_id` in two different staging environments.
2. **Connection-string guard.** Inspect the `SUPABASE_DB_URL` host before any pass runs. If it matches the production hostname pattern, refuse to load Health-tagged rows even if `--cycle=health` or `--cycle=all` was passed on the CLI. Belt and suspenders against operator error at 11pm.
3. **Frozen fixture snapshot.** Once W1-004 first passes end-to-end against the .xlsx as of today, freeze a copy as `docs/Upskiller Community Manager.fixture-snapshot.xlsx` and point the test suite at *that* file. The live workbook will keep accumulating registrations; the test fixture should not. Drift becomes a deliberate "refresh fixture" PR with diff review, rather than silent test-flake.

The mapping CSV doesn't need changes for any of this — the `staging fixture only` notes already give the script enough to dispatch on. These are W1-004 implementation requirements, recorded here so the next agent doesn't relitigate them.

**Why not synthetic fixtures instead?** More principled long-term, but pure overhead until W1-004 ships. Anonymization gets ~80% of the PII safety at ~10% of the synthetic-data cost, and real human input surfaces realistic edge cases (Unicode in names, near-duplicate emails, free-text option values that don't match `option_lists`) that synthetic data usually misses. Revisit after the cycle ends.

---

## DB readiness — cycle precondition

The schema is multi-cycle-ready: every cycle-scoped table (`cycle_enrollments`, `problem_statements`, `votes`, `pods`, `pulse_checks`, `moderator_assignments`, `solution_proposals`, `project_votes`, `projects`, `project_memberships`) carries a `cycle_id` FK. Multi-cycle is first-class — the schema doesn't need any changes to host both Energy & Climate and Health Systems data side-by-side.

What's missing is **data**, not schema. The local [seed.sql](../../supabase/seed.sql) inserts one placeholder cycle (`'Spring 2026 Build Cycle'`, id=1). Staging and prod do not see seed.sql. So before the migration script can run:

| Step | Where | Owner |
|---|---|---|
| Insert `cycles` row for `Energy & Climate` | Staging + prod | Operator (manual SQL or bootstrap migration) |
| Insert `cycle_config` row with phase windows | Staging + prod | Operator |
| Insert `cycles` row for `Health Systems` | **Staging only** (historical fixture) | Operator |
| Insert `cycle_config` row for Health Systems | **Staging only** | Operator |

The migration script must **verify** — not create — these rows. If the named cycle doesn't exist, abort with a message naming the missing cycle. Cycle setup is operator-side; the script's job is loading data into pre-existing cycle scaffolding.

This precondition isn't currently a discrete roadmap node — it's an implicit prereq that surfaces here. If it bloats §1.4, file as a new §1.4a.

---

## Active issue: ISSUE-W1-003 (#41) — column mapping CSV

**Goal:** produce a reviewable artifact that documents how every column in the workbook maps to a column or junction-table option in OLOS, so the migration script can be reviewed without anyone reading the spreadsheet.

**Unlocks:** §1.4 (the script consumes this CSV as its only mapping source — no hardcoded column lists). The whole critical path (§1.4 → §1.5 → §1.8) is gated on this.

### Per-sheet cycle scope

The CSV covers all six in-scope sheets, but the migration script applies different cycle scoping per sheet at run time. Per the roadmap [§1.5](../../docs/OLOS-roadmap.md): *"Active cycle only — historical Health Systems data stays in the workbook as test fixtures."*

| Sheet | Cycle | Loads to prod? | Loads to staging? |
|---|---|---|---|
| `Upskiller Registrations` | Cross-cycle (single participants table) | **Yes** — all rows; per-row cycle inferred from Timestamp + the active cycle's window | Yes |
| `Energy Pod Registration` | Energy & Climate (active) | **Yes** | Yes |
| `Health Pod Registration` | Health Systems (historical) | **No** — staging fixture only | Yes |
| `Problem Statement Submissions` | Health Systems (verify with operator — form may be reused for Energy) | **Verify** — load Energy rows if present, hold Health rows for staging | Yes |
| `Health Voting & Pods` | Health Systems (historical) | **No** — staging fixture only | Yes |
| `Mentor Registrations` | Cross-cycle (pending D3) | Pending D3 | Pending D3 |

The CSV's `notes` column flags Health-cycle sheets explicitly: rows from `Health Pod Registration` and `Health Voting & Pods` carry `notes` containing `staging fixture only`. The migration script's `--cycle` flag (or default-active behaviour) decides whether to skip those rows on a given run.

### Reconciliation against the issue's required column counts

The issue specifies row counts that don't all match what's in the .xlsx as of 2026-05-05. Verified by extracting row 1 of every sheet and (for the two voting/statement sheets) row 2 to handle merged section headers:

| Sheet | Issue says | Actual | Notes |
|---|---|---|---|
| `Upskiller Registrations` | 38 | **38** | ✓ |
| `Energy Pod Registration` | n/a | 5 | Active cycle |
| `Health Pod Registration` | n/a | 6 | Historical — staging fixture |
| `Problem Statement Submissions` | 25 | **20** | Authored 20; 5-row gap is either stale spec or the issue counted blank trailing cells. **Flag in PR body for operator confirmation.** |
| `Health Voting & Pods` | 25 | **19** (5 form-input + 14 derived sub-columns under merged section headers) | Authored 19; 6-row gap most plausibly = blank gap columns at positions 7/11/15/21 plus two unenumerated sub-columns. **Flag in PR body for operator confirmation.** |
| `Mentor Registrations` | n/a | 15 | All ship destination-blank with `notes = "pending D3"` |

Sheets the issue does not require (and that this CSV intentionally omits): `Management Dashboard`, `Slack Data`, `Health Pod Registration Summary`. Each is either rendered (UI) or computed (derived); none holds raw input data that needs migrating.

### How the migration script consumes this CSV

The CSV is a dispatch table for the W1-004 Python script. End-to-end:

1. **Load the workbook:** `pd.read_excel("docs/Upskiller Community Manager.xlsx", sheet_name=None, header=0)` returns a dict of DataFrames keyed by sheet name. `Health Voting & Pods` overrides with `header=[0,1]` because of the merged section headers (row 1 = section, row 2 = sub-column).
2. **Load the mapping:** read `column_mapping.csv` into a list of dicts.
3. **Verify cycles:** check `cycles` and `cycle_config` rows exist for each cycle the run will touch (see *DB readiness* above). Abort if not.
4. **Pass 1 — participants and enrollments:** filter mapping rows with `destination_table = 'participants'`. For each unique email in the source DataFrames, build a row by column lookup, apply each row's `transform`, and emit `INSERT ... ON CONFLICT (email) DO UPDATE`. Build an in-memory `email → participant_id` dict for downstream lookups. Same pass writes `cycle_enrollments`.
5. **Pass 2 — option memberships:** filter mapping rows where `transform` starts with `csv_split`. Split each cell, look up each value in `option_lists` keyed by `(list_name, value)`, emit `INSERT INTO participant_options` rows. **Halt on unmatched values** — see *Multi-select transforms* below.
6. **Pass 3 — problem statements:** sheet `Problem Statement Submissions`. Build `email → problem_statement_id` dict. Several columns target `problem_statements.context` / `theme_track`, which don't exist yet — stage into a temporary scratch column until [§2.2](../../docs/OLOS-roadmap.md#22--schema-amendments-problem-statement-context-jsonb--theme_track) ships, then backfill.
7. **Pass 4 — pods:** create one pod per shortlisted statement (operator-supplied shortlist; not in the spreadsheet). Build `pod_label → pod_id` dict for the seat lookups in pass 5.
8. **Pass 5 — pod memberships:** sheets `Energy Pod Registration` and `Health Pod Registration`. For each form row, up to three sub-rows (Seat 1/2/3 if filled). Resolve email → participant_id and label → pod_id. Emit `INSERT INTO pod_memberships`. **Skip Health rows** unless run mode is `staging`.
9. **Pass 6 — votes:** sheet `Health Voting & Pods`. For each row, up to three sub-rows (Vote 1/2/3 if filled). Resolve email → voter_id and statement label → problem_statement_id. Emit `INSERT INTO votes`. **Skip entirely** unless run mode is `staging`.
10. **All passes wrapped in one transaction.** `--commit` writes; default is dry-run that prints the SQL.

The CSV itself is never executed; it's a manifest. Adding a new transform means adding a Python handler AND a CSV row.

### CSV format

Six columns, exact header order, UTF-8, LF line endings, RFC 4180 quoting:

```
source_sheet,source_column,destination_table,destination_column,transform,notes
```

| Column | Meaning |
|---|---|
| `source_sheet` | Sheet name as it appears in the .xlsx tab bar (e.g. `Upskiller Registrations`). |
| `source_column` | Header cell text, **verbatim** including trailing whitespace, curly apostrophes, and embedded newlines. The migration script does `df[col]` lookups — string equality matters. For `Health Voting & Pods` rows under merged section headers, encoded as `"Section → Sub"`. |
| `destination_table` | Postgres table name, snake_case. `N/A` for derived columns. Empty for mentor rows pending D3. |
| `destination_column` | Postgres column name. For multi-select junction rows, `option_id` (the script joins the value → `option_lists.id` at write time). |
| `transform` | One of: `direct`, `trim`, `lower+trim`, `bool_yn`, `parse_date`, `int_scale_1_5`, `email_lookup`, `label_lookup → pods.id`, `statement_lookup`, `csv_split → participant_options(list_name='X')`, `jsonb_field('key')`, `prefix:'<label>: '`. Empty = `direct`. |
| `notes` | Free-text caveats. Specific tokens are load-bearing — see below. |

Embedded newlines inside `source_column` cells are preserved as literal LF, RFC-4180-quoted. **`awk -F,` will misparse these** — verification scripts must use a real CSV parser (Python's `csv` module).

**Load-bearing tokens in `notes`:**

- `added in ISSUE-W1-001` — flags the eight GAP fields that landed in [00011_extend_participants_legacy_fields.sql](../../supabase/migrations/00011_extend_participants_legacy_fields.sql): `phone_number`, `email_updates`, `comms_consent`, `availability_notes`, `commitment_notes`, `interest_areas`, `moderator_experience`, `notes`. Reviewers grep for this to verify §1.1 coverage. **Expect exactly 8 occurrences.**
- `computed by query` — derived spreadsheet columns. `destination_table = N/A`. The row exists in the CSV as evidence we considered the column rather than overlooking it.
- `staging fixture only` — Health-cycle data; do NOT load to prod.
- `pending D1` — pod-registration rows that need ranked-choice resolved before §1.4 runs.
- `pending D2` — vote rows that depend on the historical vote-budget reconciliation; affects test fixture validation only.
- `pending D3` — every row in `Mentor Registrations` ships with destination blank and this note.
- `§2.2` — fields whose destination column doesn't exist yet (`problem_statements.context`, `problem_statements.theme_track`). Migration script must stage these into temporary columns until §2.2 ships.

### Multi-select transforms

The legacy spreadsheet stores multi-selects as comma-separated strings in a single cell (e.g. `"ChatGPT, Claude, Cursor"`). OLOS stores them as N rows in `participant_options`. Encode the transform exactly:

```
csv_split → participant_options(list_name='ai_tools')
```

Six lists exist (verify against [00010_pulse_check_v2.sql](../../supabase/migrations/00010_pulse_check_v2.sql) + [00012_seed_option_lists.sql](../../supabase/migrations/00012_seed_option_lists.sql)):
`ai_tools` (61), `pulse_benefits` (7), `labs_goals` (6), `availability` (4), `work_style` (4), `group_strengths` (6).

The migration script's failure mode for unrecognised tokens is **abort, not skip** — log the unmatched value with row index, and stop. We'd rather halt and add the value (or fix the legacy data) than silently drop participant preferences. `ai_tools` was deliberately expanded in [00010](../../supabase/migrations/00010_pulse_check_v2.sql) from 7 → 61 values for autocomplete; legacy data may contain free-text additions that don't match. Plan for a manual reconciliation pass on `ai_tools` specifically.

### Two source columns → one destination column

`Upskiller Registrations` cols 32 ("What interests you about taking on a stewardship role?") and 37 ("Anything else you'd like us to know?") both target `participants.notes`. The CSV encodes each row with `transform = "prefix:'<label>: '"` so the migration script concatenates them as:

```
Stewardship interest: <col 32 text>

Other: <col 37 text>
```

This preserves provenance while fitting the single-column destination.

### Prose → enum normalization

Several form fields ship long-form prose in the spreadsheet (because that's what Google Forms exports) but the schema stores normalized enum values (because that's what the production form's `<select value="...">` actually submits). The migration script translates at load time. Three transforms encode this:

**`prose_lookup(commitment_map)`** — col 24 ("Participation expectations. Please confirm one:") → `participants.participation_commitment` (`VARCHAR(20) CHECK IN ('yes','uncertain')`):

| Source prose | Enum |
|---|---|
| `"I'm ready to participate consistently and follow through on commitments"` | `yes` |
| `"I'm interested, but my availability is uncertain right now"` | `uncertain` |

**`int_scale_1_5(familiarity_map)`** — col 18 ("How familiar are you with generative AI tools") → `participants.ai_tool_familiarity` (`SMALLINT`):

| Source label | Value |
|---|---|
| `"Never used"` | 1 |
| `"Hardly use"` | 2 |
| `"Use occasionally"` | 3 |
| `"Use often"` | 4 |
| `"Daily user"` | 5 |

**Form-only fields (not stored)** — col 21 ("How do you see yourself participating right now?") was considered for a new `participants.participation_expectations` column but rejected to avoid a one-column schema migration. The form keeps the question for participant clarity; the database doesn't store the answer. Tagged in the CSV with `destination_table = N/A`, `notes` containing `form-only`. If a future engagement-team need surfaces, revisit at the next schema-batch checkpoint (probably end of Wave 1) so the column lands as part of a larger migration.

### Derived columns (skip the destination)

Derived spreadsheet columns — `Vote Ranking`, `Pod Recruitment Kick Off → *`, `Individual Pod Membership → *`, `Flagged Voter → *`, `Unspent Seats`, `Pre-Filled Link`, `Submitted Problem?`, etc. — have no destination row in OLOS. Per the architecture brief: "Derived SQL queries — no storage needed."

For each: `destination_table = N/A`, `destination_column = N/A`, `transform =` empty, `notes = "computed by query (...)"` with a one-line description of the query. The row's purpose is reviewability — it proves we considered the column rather than overlooking it.

### Open decisions that affect this CSV

- **D1 (preserve `preference_rank`?)** — Pod Registration `Seat 1/2/3` rows ship with `notes` containing `preference_rank=N (pending D1)`. If D1 lands "preserve," §1.4 writes the rank into a new `pod_memberships.preference_rank SMALLINT` (schema change required). If D1 lands "flatten," the rank is dropped at script time without a CSV change.
- **D2 (vote-budget reconciliation)** — affects test data only, not prod. `Vote 1/2/3` rows ship as three rows with `vote_count = 1` regardless. D2 affects validation logic in §1.4, not the column mapping.
- **D3 (mentors)** — all `Mentor Registrations` rows ship destination-blank with `notes = "pending D3"`.

### Execution checklist (status)

- [x] Recover source materials — both `.xlsx` and `.csv` are in [docs/](../../docs/).
- [x] Extract real header rows from all 9 sheets to ground the mapping in actual column names.
- [x] Author `column_mapping.csv` rows for all six in-scope sheets (38 + 5 + 6 + 20 + 19 + 15 = 103 mapping rows + 1 header).
- [x] Tag every GAP-field row with `notes` containing `added in ISSUE-W1-001` — exactly 8 occurrences.
- [x] Tag every derived column with `destination_table = N/A`, `notes` containing `computed by query (...)`.
- [x] Tag every Health-cycle source-data row with `notes` containing `staging fixture only`.
- [x] Tag every `Mentor Registrations` row with destination columns blank + `notes = "pending D3"`.
- [ ] Open the CSV in Excel locally — confirm no quote-escaping breakage on the multi-line headers.
- [ ] Update [OLOS-roadmap.md §6](../../docs/OLOS-roadmap.md#6--wave-1-status-tracker) — set §1.3 to `in review` with PR link.
- [ ] PR body lists per-sheet row counts, calls out the Problem-Statement (20 vs 25) and Health-Voting (19 vs 25) deltas, and links back to this section.

### Out of scope (do not pull in)

- The Python migration script itself — that's W1-004, separate PR.
- Filling in mentor destination columns — gated on D3.
- Adding columns to the destination schema — if the mapping reveals a missing destination, file a follow-up issue rather than amending [00011](../../supabase/migrations/00011_extend_participants_legacy_fields.sql) here.
- Resolving D1 / D2 / D3 — flag affected rows; let decisions land separately.
- Loading data anywhere — this PR is paper. The CSV is reviewed; nothing is written to Postgres.
- Inserting `cycles` rows for Energy / Health — operator-side prereq, not script-side (see *DB readiness*).

### Verification

```bash
# Parses cleanly with a real CSV parser (awk will misparse the multi-line headers)
python3 -c "import csv; rows=list(csv.DictReader(open('scripts/migration/column_mapping.csv'))); print(f'{len(rows)} mapping rows')"

# Per-sheet counts
python3 -c "
import csv
from collections import Counter
rows = list(csv.DictReader(open('scripts/migration/column_mapping.csv')))
for sheet, n in sorted(Counter(r['source_sheet'] for r in rows).items()):
    print(f'  {n:3d}  {sheet}')
"

# GAP-field flagging — must equal 8
grep -c 'added in ISSUE-W1-001' scripts/migration/column_mapping.csv

# Health-cycle rows all carry the staging-fixture flag
python3 -c "
import csv
rows = [r for r in csv.DictReader(open('scripts/migration/column_mapping.csv'))
        if r['source_sheet'] in ('Health Pod Registration', 'Health Voting & Pods')]
mismatches = [r for r in rows if 'staging fixture only' not in r['notes']]
assert not mismatches, f'{len(mismatches)} Health rows missing staging-fixture flag'
print(f'{len(rows)} Health rows verified')
"

# Mentor rows all destination-blank
python3 -c "
import csv
rows = [r for r in csv.DictReader(open('scripts/migration/column_mapping.csv')) if r['source_sheet'] == 'Mentor Registrations']
assert all(r['destination_table'] == '' and 'pending D3' in r['notes'] for r in rows), 'mentor destination not blank'
print(f'{len(rows)} mentor rows verified')
"
```

Manual spot check (per issue test plan):

- Open the CSV in Excel. Confirm the multi-line `Problem Statement Submissions` and `Mentor Registrations` cells render in single rows with line breaks visible.
- Trace ten random non-empty cells from the source `.xlsx` to the destination column in this CSV. None should have no row.
- Code review by someone who has used the legacy spreadsheet for at least one cycle (per issue test plan).

---

## Looking ahead: ISSUE-W1-004 — Python migration script

When that issue opens, the script will live alongside the CSV in this folder. Architectural notes worth recording now so the next session doesn't relitigate. Items marked **[required]** are non-negotiable safety properties, not preferences.

- **Single source of mapping:** the script reads `column_mapping.csv` and dispatches by `transform`. No column names hardcoded in Python — adding a column is a CSV edit, not a code edit.
- **Idempotent:** `INSERT … ON CONFLICT (email) DO UPDATE` for `participants`; `ON CONFLICT DO NOTHING` for join tables. Re-running against staging is the QA loop.
- **Multi-line headers are real.** `pd.read_excel(...)` returns header strings with embedded `\n`. The CSV's `source_column` field matches that exactly — no normalization needed.
- **Health Voting & Pods needs `header=[0,1]`** because section headers in row 1 span sub-columns in row 2. The CSV expresses combined headers as `"Section → Sub"` for the section-spanned rows.
- **`--cycle` flag** drives prod vs staging behaviour. Default = active cycle (Energy & Climate). `--cycle=health` adds the Health-cycle sheets for staging fixture loading. `--cycle=all` loads both.
- **Cycle precondition check before pass 1.** Abort with a clear message if the named cycle row doesn't exist (see *DB readiness* above).
- **Connection string from `.env.local`** — never committed. Read `SUPABASE_DB_URL` (or equivalent — confirm against [.env.local.example](../../.env.local.example) when the script is written).
- **Fail loud on unmatched option_lists tokens** — see *Multi-select transforms* above.
- **Dry-run mode default.** The script prints the SQL it would emit; `--commit` actually writes. Defaulting to dry-run prevents accidental double-loads.
- **[required] Never log row contents.** PII risk — logs go to dashboards, dashboards leak. Log row indices and counts only.
- **[required] `--anonymize` flag for Health-cycle rows** — see *Test data strategy* above. Hashes emails and names while preserving relationships. Default ON whenever the script targets a non-prod connection string.
- **[required] Connection-string guard** — see *Test data strategy* above. Inspect `SUPABASE_DB_URL` host; refuse Health-tagged rows against prod regardless of CLI flags. The script must own this; do not delegate to operator discipline.
- **[required] Test against the frozen fixture snapshot, not the live .xlsx** — see *Test data strategy* above. The test fixture path is a separate file; refreshing it is a deliberate diff-reviewed PR.
