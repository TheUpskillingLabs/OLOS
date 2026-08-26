# Open project registration to all pitches (2026-08-26)

One-time prod repair + policy change after the solution-voting failure on the
live cycle. Owner decision (member experience manager, 2026-08-26): abandon
solution voting, make **every submitted pitch** a registerable project,
participants join **one** project each, **max 5** per project, **3+ = viable**.

Companion SQL: [`open-project-registration-2026-08-26.sql`](open-project-registration-2026-08-26.sql).
Runs in Supabase Studio against prod. A maintainer runs this by hand —
sessions/agents must not run it (per [CONTRIBUTING.md](../../CONTRIBUTING.md),
maintainers apply prod DB changes manually).

## What went wrong (short version)

1. **Only ~5 ballots**: project voting is submitter-only by hard-coded gate
   (`app/api/pods/[pod_id]/project-votes/route.ts:116-129`), so the eligible
   pool was roughly the pitch submitters; the ballot is all-or-nothing and
   final; and ballot inserts go through the RLS user client — the
   `current_participant_id()` resolution path already documented as rejecting
   writes in prod for other routes (`app/api/problem-statements/route.ts:83-88`).
2. **Members blocked from voting**: the submitter-only gate above — intentional
   code, a policy fork the audit flagged as never ratified
   (`docs/audit/GAP_AUDIT.md`, owner decision §10-Q1).
3. **"Registration not open yet"**: window columns are timezone-naive
   timestamps that the app reads as **UTC instants**; the admin form takes
   **ET**. The gates need both bounds. Step 1 below captures what the live
   values actually were — record it for the post-mortem.

## Step 1 — diagnostics FIRST (read-only; record the output)

```sql
-- The live cycle and its stored schedule (naive columns = UTC instants).
SELECT id, name, status, mode FROM cycles ORDER BY id;

SELECT cycle_id,
       solution_voting_open, solution_voting_close,
       project_registration_open, project_registration_close,
       project_min, project_max, updated_at
FROM cycle_config;

-- The API gate's primary source — must end up agreeing with cycle_config.
SELECT cycle_id, phase_key, starts_at, ends_at
FROM cycle_phases ORDER BY cycle_id, position;

-- Ballot ceiling vs. actual turnout (for the post-mortem).
SELECT sp.cycle_id,
       count(DISTINCT sp.id)          AS pitches,
       count(DISTINCT pv.voter_id)    AS ballots
FROM solution_proposals sp
LEFT JOIN project_votes pv ON pv.cycle_id = sp.cycle_id
GROUP BY sp.cycle_id;
```

Also check Supabase logs (API → filter `project_votes`) for INSERT errors
during the voting window — confirms/rules out the silent ballot-loss theory.

## Step 2 — edit the two values in the SQL

- `cycle_id`: the live cycle from step 1. The script aborts if left at `0`.
- `registration_close_utc`: when registration should close, as a **naive UTC**
  timestamp. ET is UTC-4 in August/September (EDT):

  | You want (ET) | Write (naive UTC) |
  |---|---|
  | Aug 29, 11:59 PM | `2026-08-30T03:59:00` |
  | Sept 1, 11:59 PM | `2026-09-02T03:59:00` |
  | Sept 5, 11:59 PM | `2026-09-06T03:59:00` |

## Step 3 — run it, eyeball the verification output

The script is one transaction; the four VERIFY selects at the end must show:
(a) `pitches = projects = joinable`, (b) `config_open` and `phase_open` both
`true`, (c) `phase_closed` `true`, (d) sane project names (≤40 chars, from the
pitch title/description).

## Step 4 — deploy the code branch

The DB change alone is not enough — ship the paired code changes
(branch `claude/voting-registration-project-signup-orv37j`):

- The register route accepted only `cycle_enrollments.status = 'active'`
  (pod-derived); it now accepts `'registered'` too, or most of the cohort
  would be locked out of joining.
- Join/withdraw writes moved to the service client (same prod RLS failure
  mode that likely ate ballots), withdraw-then-rejoin no longer errors, and
  a project drops back to `forming` if withdrawals take it below 3.
- Migration `00101` adds a DB-level cap trigger so a join burst can't
  oversubscribe a 5-person project.

## Step 5 — smoke test

1. `/cycles/<id>/register-projects` lists every pitch, flat, with member
   counts `n / 5`.
2. A member account (including one with no pod) can Join; Join a second
   project is rejected; Withdraw works; the count updates.
3. Do **not** use the admin "advance phase" testing control on the live
   cycle — it overwrites the schedule with a 24-hour window and re-runs the
   vote-based project finalize.

## Revert (only if step 3's checks come back wrong)

```sql
-- Remove ONLY projects this script created (no one has joined yet):
DELETE FROM projects pr
WHERE pr.cycle_id = <cycle_id>
  AND NOT EXISTS (SELECT 1 FROM project_memberships pm WHERE pm.project_id = pr.id);

-- Restore cycle_config / cycle_phases values from the step-1 output you
-- recorded (that record is the rollback — this is why step 1 is mandatory).
```
