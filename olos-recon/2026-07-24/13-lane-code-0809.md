# Lane: Code/Schema — incremental re-run 2026-07-25 → 2026-08-09

Read-only audit of TheUpskillingLabs/OLOS. All code read from `origin/dev` (tip `6b7af16`, merged 2026-08-03) via `git show` / `git diff b1abda1..origin/dev`; local working tree (pinned to old main) never used. Window contains **94 commits** on dev [FACT: `git log --oneline b1abda1..origin/dev | wc -l` = 94].

---

## 1. Migrations 00092–00100 (9 new; numbering continuous, no gaps)

[FACT: 6b7af16|supabase/migrations/ ls-tree — 00091 was the prior tip, 00092–00100 all present]

| # | One-line purpose |
|---|---|
| 00092_events_taxonomy_and_anchor_dates | Corrects 4 drifted anchor-event dates; recasts `hackathon-frame-sprint` → `civics-elections-hackathon` (Aug 15, American University, co-hosted); adds `events.kind` taxonomy `Anchor`/`Workshop` NOT NULL DEFAULT 'Workshop' + CHECK; migrates `saved_items` hearts to the new slug |
| 00093_event_visibility | `events.visibility` `public`/`members`; tightens anon RLS `events_public_read` to public-only, adds `events_member_read` for authenticated |
| 00094_event_about | `events.about` TEXT — full Luma "About" text, sync-owned, overwritten every tick |
| 00095_event_location_address | `location_address`, `meeting_url` (Luma-owned) + `sponsors`, `stats` JSONB (editorial, never synced) |
| 00096_task_dismissals | New `task_dismissals` table — per-member occurrence-keyed dismissals, replaces localStorage stores; RLS self-scoped |
| 00097_custom_tasks | New `custom_tasks` table — admin-authored member tasks; archive-only retirement; RLS live-rows-for-members / all-for-admin |
| 00098_simulation_sessions | New `simulation_sessions` audit table for "View as" |
| 00099_enrollment_registered_status | Adds `registered` enrollment status; backfills `inactive`→`registered`; default flips to `registered` |
| 00100_access_revocations_fresh_rows | **Drops** the 00030 idempotency unique index on `access_revocations`; adds plain `(participant_id, cycle_id)` index |

### 00098 — simulation_sessions (view-as audit surface)
[FACT: 6b7af16|supabase/migrations/00098_simulation_sessions.sql]
- Columns: `id BIGSERIAL`, `actor_participant_id INT REFERENCES participants(id)` (nullable), `target_participant_id INT NOT NULL REFERENCES participants(id)`, `started_at` default now(), `ended_at` nullable. Indexed both directions (actor-history, target-subject-access).
- **RLS enabled with zero policies** = service-role only (matches `testers`, 00042 pattern). No expiry column — expiry lives entirely in the signed cookie (1h TTL); header states "an un-stamped row grants nothing" — authorization is the cookie, not the table [FACT: file header, lines 12–16].
- No PII beyond participant ids + timestamps; it is itself a who-watched-whom surveillance trail, which is its purpose.
- Not destructive; `CREATE TABLE IF NOT EXISTS` idempotent.

### 00099 — enrollment registered status (the co-lead's enrollment state machine)
[FACT: 6b7af16|supabase/migrations/00099_enrollment_registered_status.sql]
- **Splits the status into a membership axis and a pod-activation axis**: new vocabulary `registered` (committed, no active pod — self-service resting state, can log) / `active` (has active pod, unchanged) / `inactive` (now the ONLY true engagement exit, always paired with an `access_revocations` audit row) / `revoked` (archive, unchanged). CHECK rebuilt to include all 7 values (keeps 00056's `interested`/`completed`).
- **Destructive at apply time**: `UPDATE cycle_enrollments SET status='registered', inactive_date=NULL WHERE status='inactive' AND NOT EXISTS (access_revocations row for participant+cycle)` — a data backfill that also NULLs `inactive_date` (lines 55–66). Default flips `'inactive'`→`'registered'`.
- **Operational landmine, stated in the header (lines 3–8)**: this SQL was **already applied to the dev DB on 2026-07-31 under the name `00092_enrollment_registered_status.sql`**; dev meanwhile spent 00092 on events, so the file was renumbered 00099 "for prod's benefit". Header warns: do NOT re-run on dev (backfill is not a no-op once genuine revocations land); **prod has not seen it yet**. So dev's applied-migrations ledger and the repo's file names have diverged for this migration [FACT: file header].
- Reconciler contract change codified: reconciler manages only `registered ⇄ active`, never writes `inactive`; `inactive` written solely by cron/admin sweep with audit row. Verified in code: `lib/enrollment/reconciler.ts` on dev makes exits sticky (`inactive`/`revoked` untouched unless `opts.recover`), target is `active`-or-`registered`, and the old `logRevocation` option is deleted [FACT: `git diff b1abda1..origin/dev -- lib/enrollment/reconciler.ts`]. Recovery paths: admin reactivate route and auto-recover-on-log in `app/api/learning-logs/route.ts` (both pass `recover: true`) [FACT: diff of app/api/learning-logs/route.ts; origin/dev:app/api/revocations/reactivate/[participant_id]/route.ts:61].
- Self-service registration now writes `registered` instead of `inactive` [FACT: diff of app/api/cycles/[cycle_id]/interest/route.ts].

### 00100 — access_revocations fresh rows (touches the co-lead's table + 00030 index)
[FACT: 6b7af16|supabase/migrations/00100_access_revocations_fresh_rows.sql:19]
- **`DROP INDEX IF EXISTS idx_access_revocations_unique_full`** — the 00030 idempotency guard (`UNIQUE (participant_id, cycle_id, reason) WHERE revocation_scope='full' AND reason<>'reactivated'`, created in `00030_revocation_warnings_and_idempotency.sql:81-87`) is gone. Replaced by a plain non-unique `(participant_id, cycle_id)` lookup index.
- Why "fresh rows": under the old index a member revoked → reactivated → revoked again could not get a second `missed_logs` audit row, so the trail ended on "reactivated" while the enrollment was actually inactive. Owner decision O2, 2026-08-01, recorded in `docs/testing/pr-313-findings.md` [FACT: file header cites it; doc exists on dev].
- New idempotency argument is **state-driven, not DB-enforced**: both writers (cron stage 2, admin sweep) insert only on the `active`→`inactive` transition, which removes the member from the iterated pool; a concurrent-run duplicate is declared "honest and harmless" [FACT: file lines 8–15]. The routes' 23505-swallowing was removed in the same commit (1ae38f1); insert errors now log loudly [FACT: origin/dev:app/api/revocations/check/[cycle_id]/route.ts:154-158].
- **Issue #125 interaction**: #125 (open, p2) asked to move `reason='reactivated'` rows out of `access_revocations` and *revert the index predicate to the clean form*. 00100 instead **deletes the index entirely** — the predicate half of #125 is mooted, but the semantic co-mingling is not: the reactivate route on dev still inserts `reason='reactivated'` rows into `access_revocations` [FACT: origin/dev:app/api/revocations/reactivate/[participant_id]/route.ts:68-73; FACT: issue #125 state=open via GitHub API]. Revocation-count reporting is now inflated by both reactivation markers AND legitimate repeat revocations [INFER: high].
- Destructive: DROP INDEX at apply time (metadata-destructive, no rows lost). Rollback documented as reference-only.

### Cross-cutting flags for 00092–00100
- **Destructive/apply-time data ops**: 00092 (multi-table `UPDATE events`/`cycle_events`/`saved_items` + a `DELETE FROM saved_items` cleanup of leftover old-slug hearts), 00099 (backfill UPDATE), 00100 (DROP INDEX). 00092's header explicitly declares 00034 no longer re-runnable (its rows violate the new `events_kind_check` and its slug upsert target was renamed) [FACT: 00092 header "ONE CONSEQUENCE TO KNOW ABOUT"].
- **Soft-delete conformance**: `custom_tasks` conforms (`archived_at`, "never deleted"); `task_dismissals` allows hard self-DELETE by design (un-dismiss); `simulation_sessions` append + stamp, no delete path. Events stay archive-not-delete.
- **RLS**: present on all three new tables (00096 policies self-scoped; 00097 admin-write/member-read-live; 00098 enabled-no-policies = service-role only). 00093 tightens events anon RLS. `participant_erasures` untouched this window — its never-enabled-in-chain RLS status is unchanged [FACT: no migration in 00092–00100 references it].
- **PII**: nothing new beyond simulation actor/target linkage; 00092 embeds a public venue address.

### SCHEMA.md freshness — **verdict: fresh, best-documented window yet**
`origin/dev:SCHEMA.md` documents all of it: the registered/active axis note (line 213), `task_dismissals`/`custom_tasks` in the ERD and table index (lines 275–308, 947–948), `simulation_sessions` (lines 725, 950), events `kind`/`visibility`/`about`/`location_address`/`meeting_url`/`sponsors`/`stats` (lines 683–699) [FACT: grep of origin/dev:SCHEMA.md]. One stale sentence: line 685 claims the hackathon "has a bespoke route at `app/(public)/events/civics-elections-hackathon/`" — that route was retired in #337 (5f7fda7) and does not exist on dev tip; only `events/[slug]` remains [FACT: ls-tree origin/dev 'app/(public)/events/']. 00100's index drop is not called out in SCHEMA.md's access_revocations row (line 914 still generic) [FACT: grep "00100" in SCHEMA.md = no hits].

---

## 2. API/auth surface diff (b1abda1 → 6b7af16)

88 paths changed under `app/api`/`lib`/`proxy.ts` [FACT: name-status]. **Added routes**: `admin/simulate` (+`/exit`), `admin/tasks` (+`[task_id]`), `admin/resources` (+`[id]`), `admin/events/[id]` (editorial PATCH), `admin/explore/export`, `moderator/pods/[pod_id]/explore/export`, `tasks/dismiss`. **Removed**: none. **Modified**: revocation-check cron (rewritten), revocations check/reactivate, learning-logs (recover-on-log), cycles interest/agreement/pods, permissions/preset (unscoped Moderator preset removed, 20b0673), pods/[pod_id]. `vercel.json`, `.github/`, `.claude/` — **zero changes** [FACT: empty name-status diff].

### (a) View-as simulation — the four invariants, verified in merged code
Implementation: `lib/auth/simulation.ts`, `lib/auth/simulation-cookie.ts`, `proxy.ts`, `lib/auth/middleware.ts`, `app/api/admin/simulate/{route,exit/route}.ts`, documented in `lib/auth/CLAUDE.md` (new "Member-view simulation" section) [FACT: a1c45dd merged #344, "view-as-member simulation (#312, rebased on dev)"].

1. **Read-only — HOLDS, two layers.** Edge: `proxy.ts` `simulationWriteBlock()` 403s every non-GET/HEAD/OPTIONS when the cookie is *present* (presence-only by design — fails restrictive), exempting only `/api/admin/simulate*`; matcher covers `/api/*` [FACT: origin/dev:proxy.ts lines 9–36, 126–128]. Authoritative: `withAuth` re-checks with signature verification via `simulationContext()` [FACT: origin/dev:lib/auth/middleware.ts, block after getUser]. Grep confirms **no Server Actions** (`"use server"` zero hits in app/lib), so all writes are `/api/*` [FACT: git grep]. *Caveat*: the block keys on method, so mutating GETs pass — the cron routes are mutating GETs (guarded by CRON_SECRET, not cookies) and `simulate/exit` is a mutating GET by design; residual risk ≈ nil [INFER: high].
2. **Non-escalation — HOLDS.** `loadSimulationTarget` rejects targets holding non-revoked `owner`/`admin`/`developer` in `participant_roles`, rejects never-signed-in targets; re-run inside `simulationContext()` on every request; actor's admin-ness re-resolved from Postgres each request; on prod project (`lib/env/project.ts`, ref-pinned `cdbgkgkjnomjnpicaxqe` or `VERCEL_ENV=production`) actor must be **owner** — checked both at POST and per-request [FACT: origin/dev:lib/auth/simulation.ts UNSIMULATABLE_ROLES, simulationContext; app/api/admin/simulate/route.ts POST].
3. **Real-user authority — HOLDS.** `effectiveUser()` is render-identity only; `guards.ts` gained an explicit doc-comment that every gate reads the real user, and `withAuth` passes the real caller's roles to handlers [FACT: diff lib/auth/guards.ts; middleware NOTE comment].
4. **Session binding — HOLDS.** Cookie payload carries actor auth id (`a`); `simulationContext()` nulls out unless `user.id === payload.a`, so a copied cookie is inert; HMAC-SHA256 keyed on `SUPABASE_SERVICE_ROLE_KEY`, `timingSafeEqual`, hard 1h `exp` [FACT: simulation.ts verifySimulation/simulationContext].
   - Known divergence (self-documented): `createClient()` still carries the actor's JWT, so RLS sees the admin — simulated view can show slightly *more* than the member sees, never less [FACT: simulation.ts header; lib/auth/CLAUDE.md].

### (b) vercel.json — **revocation-check STILL not scheduled**
Byte-identical to baseline: same 5 crons (learning-log-window Fri 21:00, learning-log-reminder daily, leadership-log-window Wed 13:00, leadership-log-reminder daily, sync-luma-events */6h). No revocation-check entry, no new events crons [FACT: origin/dev:vercel.json; empty diff]. Issue **#213 (p1) still open, untouched since 2026-07-11** [FACT: GitHub API, state=open, updated_at 2026-07-11]. This got *more* consequential this window: the rewritten cron is now the **sole automated writer of `inactive`** under the 00099 model — until scheduled, engagement exits happen only via the manual admin sweep (`POST /api/revocations/check/[cycle_id]`) [INFER: high].

### (c) CRON_SECRET — unchanged degradation
All 6 cron routes (5 scheduled + revocation-check) still compare `authHeader !== \`Bearer ${process.env.CRON_SECRET}\`` — unset secret still yields the guessable "Bearer undefined" gate [FACT: git grep CRON_SECRET origin/dev — e.g. app/api/cron/revocation-check/route.ts:105]. `.env.local.example` diff adds only `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY`; **CRON_SECRET still absent** [FACT: diff .env.local.example].

### (d) CODEOWNERS / branch protection
`.github/CODEOWNERS` unchanged: `* @brendanwhitaker @adm-2k @amguzzi` — still no inferno-gh [FACT: origin/dev:.github/CODEOWNERS]. No workflow/protection-adjacent files changed.

### (e) Phase-window gate coverage
`checkWindow` call sites in `app/api` are the **same 9 routes** on both endpoints of the window (problem-statements, votes, voting/finalize, pods register/project-votes/solution-proposals, projects register, cycles advance-phase, admin pod memberships) [FACT: git grep -l checkWindow on b1abda1 vs origin/dev]. No new member-facing cycle-action write endpoint shipped that lacks it: the new writes are admin-gated (`withAdminAuth`: events editorial, resources CMS, custom tasks, simulate) or non-cycle member writes (`tasks/dismiss`, `withAuth` + self-scoped RLS, deliberately window-free) [FACT: reads of each new route]. `checkWindow` itself: decision procedure unchanged (org-cycle reject; phases-first `[starts_at, ends_at)`; legacy pair inclusive fallback); only its static maps now come from the new registry (`lib/cycles/windows.ts`) [FACT: diff lib/auth/windows.ts].

### Revocation cron rewrite (inside the unscheduled route)
`app/api/cron/revocation-check/route.ts` was rewritten for the 00099 model: the `not_in_pod` revocation ladder is **deleted** (pod-less = `registered`, never enters the loop); the one signal is `missed_logs` — `consecutiveMissedLogWeeks` (new `lib/learning-logs/at-risk.ts`) reconstructs weekly windows from the cycle calendar, **floored** at the later of member pod-join/enrollment and the cohort's first-ever log (prevents revoking week-6 joiners on arrival and pre-ritual cohorts); skips cycles with `log_gate_paused` or no `log_due_at`; two-stage warn → 3-day grace → revoke; stage 2 writes `status='inactive'`+`inactive_date` directly (pod membership left intact; next qualifying log auto-recovers) and inserts the fresh audit row [FACT: full diff of the route]. PGRST201 fix: the `user_roles` embed now names `user_roles!user_roles_participant_id_fkey` (two FKs to participants) and query errors are surfaced instead of silently iterating nothing [FACT: fc52a1c, 1ae38f1].

---

## 3. Events/Luma rework (00092–00095 + code)

New model, in one pass [FACT: commits 77d7153 (#318), b288b35 (#323), 7125808 (#324), b3ae918 (#326), 7adfb9b (#329), 82ef7c4 (#331), c0d47a0 (#333), 66e8c97 (#335), 5f7fda7 (#337)]:
- **Luma is source of truth for ALL events**; the `events` table is a cache. Sync (6-hourly cron, unchanged schedule; manual `POST /api/admin/events/sync`) now fetches **per-event details** (the listing carries no descriptions), owns name/times/location fields/`img`/`luma_url`/`about`/`visibility`; local annotations (`slug`, `kind`, `anchor`, `cost`, `host`, `bring`, `body`, editorial) never overwritten. Anchor rows (`anchor-0N` api_ids) exempt from reconciliation-archiving.
- **Taxonomy**: `kind` = `Anchor`/`Workshop`, default load-bearing so 6-hourly imports are filterable on arrival; public /events leads with a 3-card featured anchor strip. Anchor dates corrected (they had drifted from `lib/cycles/anchor-events.ts` since 00034; documented in new `scripts/ops/anchor-date-drift-2026-07-29.md`); hackathon recast as the public Aug-15 AU event, old slugs 301-redirected in `next.config.ts`.
- **Visibility**: private Luma events (admin API key returns them) sync as `members` and route to signed-in surfaces — `/learning` agenda + detail pages for signed-in visitors; `app/(public)/events/[slug]/page.tsx:147` `notFound()`s members-events for anon, and metadata is suppressed (line 41). RLS tightened accordingly (defense-in-depth; app reads use service client).
- **About markdown**: `about` synced from Luma `description_md` every tick; rendered by new `lib/content/markdown.tsx` — a deliberately small parser (paragraphs, one-level lists, bold/italic/links, schedule blocks), everything through React escaping, **no `dangerouslySetInnerHTML`** [FACT: SCHEMA.md line 689 + lib/content/markdown.tsx].
- **No new public write surface**: RSVP route unchanged since baseline; the only new events write is the admin-only editorial PATCH (`withAdminAuth`, zod-whitelisted to `description`/`body`/`bring`; no POST/DELETE) [FACT: origin/dev:app/api/admin/events/[id]/route.ts]. Auth model for events otherwise unchanged.

---

## 4. Task system (#311 line)

`lib/tasks/` (assemble/tasks/keys/definitions/urgency/dismissals/preview + tests) + 00096/00097, merged as 713d126 (#342). **Canonical cycle-window registry = `lib/cycles/windows.ts`**: `CYCLE_WINDOWS` is the ONE definition of the six member cycle actions (key = cycle_config column stem = checkWindow field; phaseKey; routes; two label registers). Its `resolveWindowStates()` explicitly **byte-matches checkWindow's decision procedure** — cycle_phases row wins with close-exclusive `[starts_at, ends_at)`, legacy cycle_config pair fallback close-inclusive — and the module comment pins the inclusivity asymmetry as deliberate and test-covered (`lib/cycles/windows.test.ts`), warning not to "unify" without changing checkWindow in the same commit [FACT: origin/dev:lib/cycles/windows.ts header + resolveWindowStates]. `lib/auth/windows.ts` now *derives* its FIELD_TO_PHASE and closed-messages from the registry, so gate and display literally share one source [FACT: diff lib/auth/windows.ts]. Verdict: the task system reads phases/legacy columns **consistently** with the write gate; a member cannot see "open" and get a window-403 simultaneously [INFER: high, direct code correspondence]. Dismissal writes go through the user client so `task_dismissals` self-only RLS is the enforcement [FACT: app/api/tasks/dismiss/route.ts].

---

## 5. Unmerged branches (new/moved this window)

| Branch | vs dev | Last commit | Intent / live-data risk |
|---|---|---|---|
| `claude/close-underfilled-pods-fqq3g1` | +15 / -0 (based on **main**, not dev; 3 real commits + 12 inherited main merges) | 135e1ec 2026-08-04 | **Live data surgery.** `scripts/ops/close-underfilled-pods-2026-08-04.sql`: preview query + one atomic CTE that flips ACTIVE-cycle `forming` pods below `cycle_config.pod_min` to `dissolved`, stamps `pod_memberships.inactive_at` and `moderator_assignments.removed_at` (soft-delete-conformant, mirrors `closeOutCycle()`). Deliberately leaves `active` pods alone. **Does NOT touch `cycle_enrollments`** — displaced members' status is left to the reconciler/whatever runs next; the commit trail itself flags this: 61c31d7 logs feedback item #14 ("need an admin action/cron to dissolve forming pods… what happens to a displaced participant's `cycle_enrollments.status`?" — notes the revocation cron is "currently unscheduled") and says the instance was "handled with a manual one-off" — i.e. **this SQL (or its equivalent) appears to have been run against live data by hand** [FACT: 61c31d7 message + docs/feedback-running-list.md item 14; INFER: medium that the run actually happened — the feedback text says "handled this instance with a manual one-off"]. 135e1ec reworked it from temp-tables to two self-contained statements for the Supabase SQL editor. No PR merged; no admin/cron path exists on dev. |
| `claude/pod-voting-live-view-qcfekh` | +1 / -71 | 0255551 2026-07-27 | Docs-only: deliberation-layer PRD (phase between proposing and voting; builds on the Triangulator rubric in `lib/validations/votes.ts` and `voter_context`; names two shipped inconsistencies — the two ballots disagree on tally visibility, set-absolute allocation hides preference revision). "Proposal, not ratified. No schema claimed, no migration number." Zero live-data risk. Branch name no longer matches content [FACT: commit message]. |
| `claude/mobile-desktop-role-labels-j47g6f` | +1 / -82 | e3e351d 2026-07-27 | UI fix: persona pill wrongly claimed "Lab lead" for admins on `/lab/*` (requireLabLead admin bypass); extracts `derivePersona` to `lib/ui/persona.ts` with tests. No data risk; stale (82 behind). |
| `sync-main-into-dev-2` | +1 / -48 | d0af849 2026-07-31 | Merge-main-into-dev housekeeping after squash promotions. Superseded: dev tip already contains the equivalent rejoin via `sync-histories` (#330, 54e1f14/7461ea0). Safe to delete [INFER: high]. |

---

## 6. Docs delta

`git diff --name-status b1abda1..origin/dev -- docs '*.md'` — 11 files [FACT]:
- **New**: `docs/work-day-improvements.md` (PR #306 — yes, merged; includes cycle-gate flow entries 11–16 and pod lightning talks), `docs/proposals/luma-driven-event-pages.md`, `docs/hackathon-luma-about.md`, `docs/requirements/moderator-insights-logs.md`, `docs/testing/pr-313-findings.md` + `pr-313-full-test-runbook.md` (source of the O2 fresh-rows decision), `scripts/ops/anchor-date-drift-2026-07-29.md`, `app/components/tasks/CLAUDE.md`.
- **Updated**: `SCHEMA.md` (thoroughly — see §1 verdict), `lib/auth/CLAUDE.md` (new simulation section + registered status in the UserRoles shape), `docs/requirements/cycle-timeline.md` (hackathon date/Phase-4 split, 8884f0a).
- **Unchanged**: `docs/environments.md`, `supabase/CLAUDE.md`, `docs/OLOS-roadmap.md` [FACT: absent from diff].
- **Ghost-branch material still unmerged**: no `EVOLUTION.md`, `prod-migration-plan`, or `VIBE_SCAN` anywhere in origin/dev's tree [FACT: `git ls-tree -r origin/dev | grep -iE "EVOLUTION|VIBE_SCAN|prod-migration-plan"` = empty]. Note #213's body still cites `docs/EVOLUTION.md` — a doc that does not exist on dev [FACT: issue body vs ls-tree].

---

## Gaps

- **Dev-DB ledger vs repo**: 00099's out-of-band application to dev (as "00092") on 2026-07-31 is asserted only by the migration header; the actual `supabase_migrations` ledger on the dev database was not inspected (no DB access in this audit). Same for whether 00100/00092-events have been applied to dev or prod.
- **Whether the close-underfilled-pods SQL was actually executed against prod/dev** is inferred from the feedback note ("handled this instance with a manual one-off"), not from any execution log.
- Issues checked live via GitHub API: #213 (open, p1) and #125 (open) only; other issue movement (e.g. #311/#312/#313 closure state) not re-verified this pass.
- `simulation.test.ts` and `windows.test.ts` were located but not executed (read-only audit; no test run).
- Vercel dashboard-side cron/env configuration (whether CRON_SECRET is actually set in the deployment) is unverifiable from the repo — the code-side degradation is the only [FACT] here.
- The claim that `resolveWindowStates` "byte-matches" checkWindow was verified by side-by-side reading of both functions, not by property-based testing.
