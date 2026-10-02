# Data strategy — reining in the pipelines

| | |
|---|---|
| **Status** | Proposal — extends `docs/audit/DATA_ARCHITECTURE.md` (the data constitution, still valid) with an operating strategy; sequenced in [`next-sprint.md`](next-sprint.md) |
| **Owner** | Lead architect; the `migrations` role for DDL |
| **Last verified** | 2026-09-15 against `main@226445a`; findings in [`2026-09-audit.md`](2026-09-audit.md) §4 |

`DATA_ARCHITECTURE.md` (July) got the **design** right: provenance-first, longitudinal,
versioned JSONB, governance columns, one write path per lifecycle, config as data. What
it did not cover — because the pipelines did not exist yet — is **operation**: how
schema reaches production, who writes each state, what runs on a schedule, how email
is accounted for, and how anyone measures anything. This document is that half. It is
a strategy, not a schema: the migrations it implies are named, sized, and sequenced in
the sprint plan.

---

## 1. Principles (added to the July six)

7. **The ledger is the truth about the truth.** `supabase/migrations/` is the schema's
   source of truth; `supabase_migrations.schema_migrations` on each database must agree
   with it, or no tooling can be trusted.
8. **Every state has exactly one vocabulary, one diagram, and a test.** A CHECK
   constraint, the TypeScript union, and the reference doc must list the same values.
9. **Emit, don't infer.** Metrics come from events written at the moment something
   happens, not from re-deriving history across ten tables. Where we cannot emit yet,
   compute in **views**, never in page code.
10. **One audit trail per channel.** Every outbound email writes `email_log`; every
    hand-run operation writes a log row or a vault workflow note; every owner/admin
    mutation writes its actions table.
11. **Aggregate for admins, sanctioned signals for shepherds, nothing for the crowd.**
    Admin metrics are aggregate by default. Poderators see only the signals the
    constitution sanctions (compliance, blocked-with-own-words, milestone status). The
    feed shows ceremonial events only. No activity telemetry is ever member-visible.
12. **Delete by design.** Every table that references a participant declares whether
    erasure cascades, anonymizes, or blocks — and the erasure RPC is tested against the
    FK graph, not maintained by memory.

---

## 2. The migration ledger (Sprint 0 — blocker)

**State (issue #361, verified by schema fingerprinting on 2026-08-21):** the repo chain
`00001`–`00100` is physically applied to both dev and prod, but the CLI ledger records
a mix of numeric and timestamp versions because `00086`–`00100` were applied out of
band. `supabase db push` would re-run applied migrations; `00099`'s backfill is
non-idempotent. Both databases also carry the July repair scripts
(`scripts/ops/*-migration-repair-2026-07-06.sql`).

**Strategy**

1. **Reconcile metadata only** (the SQL drafted in #361): make `schema_migrations` list
   `00001`…`00103` on dev, verify, then prod. Record the run in a vault workflow note
   (`workflows/reconcile-migration-ledger.md`) and in `docs/environments.md`.
2. **Then automate dev:** `supabase db push --linked` against dev on merge to `dev`
   (issue #77, half). CI already checks numbering; add `supabase db diff` as a dry-run
   check on PRs that touch migrations so a migration that does not apply cleanly fails
   before merge.
3. **Prod stays manual, but observable:** a CI job on `main` compares the file list to
   prod's ledger (read-only) and posts the "migrations pending on prod" list on the
   promotion PR. The promoting maintainer applies them and ticks them in the changelog
   section. Automating prod apply is a later decision (needs a staging DB seeded from a
   prod clone, which `implementation-plan.md` already recommends).
4. **Baseline snapshot** per `supabase/CLAUDE.md`'s consolidation policy: after the
   ledger is clean and the current cycle closes (post Oct 13), produce
   `00104_baseline_2026-10.sql` and archive `00001`–`00103`. Fresh installs get one
   file; deployed DBs are unaffected.

---

## 3. Lifecycle state machines as code and reference

### 3.1 Enrollment

Today `cycle_enrollments.status` admits seven values, four are live, two are dead
(`interested`, `completed` — no writers), one is reserved (`stepped_back`). Nine code
paths write it (audit §4.1). The reconciler already enforces "one writer per
transition" for `registered ⇄ active`; the exits are owned by the revocation paths.

**Strategy**

- Write `docs/reference/state-machines.md` (reference doc): one diagram per machine
  (enrollment, pod status, project status, cycle status, invitation status,
  lab status), the writer table, and the audit-row rule for each exit.
- Add a Vitest test that reads the CHECK vocabulary from the migration files and
  asserts equality with the TypeScript unions (`EnrollmentStatus` in the reconciler,
  `UserRoles.cycleEnrollments[].status`). Drift becomes a failing test, not a July
  surprise.
- Prune dead vocabulary in the next hardening migration: drop `interested` and
  `completed` from the CHECK (after `SELECT DISTINCT status` confirms zero rows on prod).
  Keep `stepped_back` reserved with a comment naming the Phase 4 route that will write it.
- Decide the at-risk ownership question (#361, #213, #362) as one ADR: who emails
  `at_risk` members, and whether `inactive` is written by cron, by admin sweep, or both.
  Until decided, the engagement exit is effectively **manual**, and the reference doc
  should say so.

### 3.2 Cycle, pod, project

`closeOutCycle()` (`lib/cycle/closeout.ts`) is the cascade; pods go `dissolved`,
projects graduate to sector governance. Record it in the reference doc; add the
`dissolved`-not-`closed` badge rule (feedback #12) so UI maps stop inventing states.

---

## 4. The activity event spine (Sprint 2 — the pivotal build)

`SOCIAL_LAYER_ANALYSIS.md` §8 B1 proposed `activity_events` for the feed. It is also
the **instrumentation spine** the metrics need, and the Ortelius north star's "the
product working is the labeling" idea in its simplest form. One table, one writer
helper, called from the ceremonial write paths that already exist:

```
activity_events(
  id, actor_participant_id, verb, object_type, object_id,
  cycle_id NULL, pod_id NULL, project_id NULL, lab_id NULL,
  visibility ('members' | 'staff'),   -- 'staff' rows never render in the feed
  payload jsonb (schema_version), created_at timestamptz
)
```

**Verbs, and who sees them**

| Verb | Written by | Feed (members) | Metrics (staff) |
|---|---|---|---|
| `account.created`, `lab.joined`, `waitlist.joined` | funnel | — | funnel |
| `cycle.pre_registered`, `cycle.registered`, `agreement.signed` | interest / agreement routes | ✔ (ceremonial) | funnel, pre-registration pipeline |
| `pod.joined`, `pod.left`, `project.joined`, `project.formed` | register routes | ✔ | activation |
| `log.filed` (kind), `log.shared` | learning-logs route | share only | engagement |
| `milestone.filed` | learning-logs route | — | engagement |
| `readiness.step_completed` (slack, github, intro, llm, survey_shared) | readiness routes (new) | — | pre-registration |
| `outreach.logged` | poderator outreach (new) | — | outreach → response |
| `email.sent` (kind) | every sender, via `email_log` (or mirrored) | — | reach |
| `member.stepped_back`, `enrollment.revoked` | revocation paths | **never** | retention (staff only) |

Constitution guardrails baked in: `visibility='staff'` rows are excluded by RLS from
member reads; no read-tracking verbs exist; step-backs and gate misses are never
member-visible. Retroactive backfill from existing rows (pods, agreements, projects) is
an owner decision (vault: `activity-event-retroactivity`).

Until the spine exists (Sprint 1), metrics are computed in views over the existing
tables (§5). The views are written so that switching their source to `activity_events`
later changes the view body, not the dashboard.

---

## 5. The metrics layer

### 5.1 Metrics dictionary (`docs/reference/metrics.md`, new)

One definition per metric, with the SQL that computes it and who may see it. Seed set:

| Metric | Definition | Grain | Audience |
|---|---|---|---|
| **Funnel** | visitors → accounts → active-lab members → cycle registered → pod active → project member → showcased | per cycle, per lab | admin |
| **Pre-registration pipeline** | `registered` on the `upcoming` cycle by week before kickoff; readiness steps completed; conversion to `active` after kickoff | per upcoming cycle | admin |
| **Activation rate** | `active` ÷ `registered` at `pod_registration_close` | per cycle, lab | admin |
| **Weekly log compliance** | members with a qualifying log in window ÷ members expected (`status='active'`, armed cycle) | per week, pod, lab | admin (aggregate), poderator (own pods) |
| **At-risk / behind counts** | `compliance-logic.ts` statuses, counted | per week, pod | admin, poderator |
| **Retention (cycle-over-cycle)** | share of cycle N `active` members who are `registered` or `active` in cycle N+1 | per cycle pair | admin |
| **Completion** | `active` at cycle close ÷ `active` at `pod_registration_close` | per cycle | admin |
| **Pod health** | `log-health.ts` bands; blocked count | per pod | poderator, admin |
| **Outreach → response** | members contacted (outreach log) who filed a log within 7 days ÷ contacted | per pod, per poderator | poderator (own), admin |
| **Reach** | emails sent by kind; open/click not tracked (no pixels — a decision to record) | per week | admin |
| **Contributor conversion** | alumni who follow / join a graduated project | per sector | admin |

Rule: **no metric exists until it is in this file.** The admin page renders the
dictionary's SQL, so page and definition cannot disagree.

### 5.2 Views (Sprint 1, one migration, no data change)

Plain SQL views in a `metrics` schema (or `v_` prefix), service-role read only,
computed from existing tables:

- `v_cycle_funnel(cycle_id, lab_id, stage, n)`
- `v_weekly_engagement(cycle_id, pod_id, week, expected, logged, behind, at_risk)`
- `v_participant_journey(participant_id, cycle_id, registered_at, activated_at, first_log_at, last_log_at, logs, milestones, project_id, exit_status, exit_at)` — the per-participant-per-cycle rollup `DATA_ARCHITECTURE.md` §5 asked for
- `v_cohort_retention(cycle_id, next_cycle_id, active_n, returned_n)`
- `v_preregistration_pipeline(cycle_id, week_offset, registered_cum, readiness_steps_avg)`

Materialize only if a view is slow at real cohort sizes (24–60 people; it will not be).

### 5.3 `/admin/insights` (Sprint 1)

One page, cycle selector, five blocks (funnel, weekly engagement, at-risk table,
retention, pre-registration pipeline), CSV export of any block, reading the views.
The moderator Insights page (#381) is the visual precedent: div-bars, no chart library.
Later: a Monday admin digest email built from the same views.

---

## 6. Email and outbound accounting

- **Every sender writes `email_log`** (`kind`, `to_email`, `subject`, `payload`,
  `sent_at`, plus a nullable `cycle_id`). Today only the compliance nudge does.
  Migrate the invitation `email_sent_at` and the reminders' "younger than 24h" checks
  to read `email_log`, so idempotency is one function (`alreadySentWithin(kind,
  participant, window)`).
- **`kind` vocabulary** is an enum in `lib/email/kinds.ts` and mirrored in the
  metrics dictionary.
- **No tracking pixels or click tracking** — record as an ADR (privacy posture; Resend
  can do it, we choose not to). "Reach" is sends, not opens.
- **Poderator outreach is logged, never sent.** The constitution says OLOS does not
  send on a poderator's behalf. An `outreach_log` (who contacted whom, channel, note)
  is a sanctioned signal: it lets a poderator see "did anyone reach out", and the
  outreach → response metric closes the loop. Members never see it.

---

## 7. Time: finish the one-calendar work

`cycle_phases` / `cycle_events` are the source of truth (Stage 1, `00086`). Remaining:

1. Stage 2 page sweep — repoint the ~22 UI files still reading `_open`/`_close` to
   `lib/cycles/schedule.ts` / `windows.ts`; then drop the mirror and the twelve legacy
   columns in one migration.
2. Retire `lib/cycles/anchor-events.ts` — the ceremony reads `cycle_events`; the public
   `events` rows for anchors are upserted from `cycle_events`, never hand-seeded again
   (`00034`/`00092` drift is the cautionary tale).
3. `advance-phase` stays a `testing:use` tool and says so in its response.
4. Cron hours pinned per lab timezone once a second lab is active
   (`metros.timezone` exists).

---

## 8. Hand-run operations

Keep the `scripts/ops/*.sql` + companion `.md` pattern, and add:

- A vault **workflow note** for every repeatable one (ledger reconciliation, cycle
  handover, prod migration apply, anchor-date repair).
- An **`ops_runs`** log (or reuse `owner_actions` with `entity_type='ops_script'`):
  script name, database, actor, `ran_at`, outcome. Three columns of discipline that
  answer "did the Aug-26 SQL run on prod, and who ran it" forever.
- The rule, stated in `scripts/ops/CLAUDE.md`: **a policy change made under live-cycle
  pressure gets an ADR within the week**, even if the SQL already ran.

---

## 9. Data catalog

`SCHEMA.md`'s table summary is already 80% of a catalog. Extend the summary (or a
companion `docs/reference/data-catalog.md`) with four columns per table:

| Column | Values |
|---|---|
| **PII class** | `none` · `contact` (email, phone) · `sensitive` (free text about a person, health-adjacent log fields) · `identity` (auth ids) |
| **Writers** | the routes / RPCs / crons that insert or update |
| **Erasure** | `cascade` · `anonymize` · `retain` (with the reason) — must match `delete_participant` / `reset_participant` |
| **Retention** | `indefinite` · `cycle + N` · `scrub after N days` (anonymous survey responses — Ortelius gap #7) |

`lib/entity-explorer/registry.ts` is the machine-readable allowlist for admin reads;
the catalog is its human twin. The erasure column is tested: a Vitest test walks the FK
graph from `participants` and fails if a table is missing from the RPC's list (#383's
`lab_leads` gap is exactly this class).

---

## 10. Governance guardrails (unchanged, restated as checks)

- Consent columns are the gate: `contact_consent` for any marketing/drip email;
  `photo_video_consent` for media; survey `consent_version` for research use. The
  pre-cycle drip (sprint workstream A3) **reads `contact_consent`** and skips `false`.
- Poderator visibility tiers (PRD §7.3) hold for every new surface; the outreach log is
  poderator/admin only.
- The moderator AI-summary pattern (copy-prompt, BYO-LLM, no in-app LLM) is the model
  for any future "insight" feature. LLM naming (`lib/llm/names.ts`) is the one ratified
  exception.
- Anonymous survey responses get a retention/scrub policy before `allow_anonymous`
  ships more widely.
- Metrics views exclude `is_test` and `is_staff` participants by default.

---

## 11. Sequence

| When | Work | Size |
|---|---|---|
| Sprint 0 | Ledger reconciliation (dev, prod); `environments.md` update; workflow note | s |
| Sprint 0 | State-machine reference doc + vocabulary test | s |
| Sprint 1 | Metrics dictionary + views migration + `/admin/insights` v1 | l |
| Sprint 1 | `email_log` for all senders; `alreadySentWithin` helper; pre-cycle drip reads it | m |
| Sprint 1 | `outreach_log` + poderator outreach tab | m |
| Sprint 1 | Cron auth fail-closed sweep; #213/#362 ADR | s |
| Sprint 2 | `activity_events` spine + writer helper; views repointed; feed reader (B2) | l |
| Sprint 2 | Time Stage 2 sweep; drop mirror columns; retire anchor constant | l |
| Sprint 2 | Data catalog columns + erasure FK test; dead-vocabulary prune | m |
| Post-cycle | Baseline migration snapshot | s |
