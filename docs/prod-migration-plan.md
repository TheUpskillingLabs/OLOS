# OLOS — Dev → Production Migration Plan

> **Authored:** 2026-07-10 · **Author:** release-engineering analysis session
> **Scope:** promote the `dev` branch (219 commits ahead of `main`) onto the **live**
> production system — Vercel `olos` + Supabase `OLOS-prod` (`cdbgkgkjnomjnpicaxqe`).
> **Overall readiness: 🔴 NOT-YET (execute the hardening + rehearsal phases first).**
> This is **not a greenfield launch.** Prod is live with 54 real participants and a
> cohort ("Energy & Climate", id=3) that **ends 2026-07-14**. Treat every step as
> surgery on a running system.

---

## 1. Executive summary

`dev` has been built ~219 commits past `main` and is the intended production target
(public landing + content CMS, events/library/labs, directory, survey intake,
spotlights, announcements, follows, sectors, org-cycles, GDPR erasure/consent, and a
**unified authorization model**). The code is coherent and shippable as a unit, and
`dev` already carries the CI, tests, and migration-guard tooling that `main` lacks.

The promotion is blocked less by *code* than by **three live-system hazards**:

1. **Migration-ledger drift.** The same migrations are recorded under *different
   version strings* on prod (timestamped) vs. disk (zero-padded), because migrations
   were applied to prod ad-hoc via MCP (which timestamps) rather than `db push`. A
   naïve `supabase db push` to prod would **re-apply or skip** migrations. This must
   be *repaired* before any new migration is pushed. **This is the crux.**
2. **A fresh auth-model rewrite against real users.** Prod has none of the new tables;
   the `00064–00066` auth-unification will run for the first time against prod's real
   `user_roles`, and `00066` currently hard-codes an owner email (`hello@brendanwhitaker.com`)
   that **is not a prod owner.** Run as-is it would misfire. The team's own
   [`AUTH_UNIFICATION_RUNBOOK.md`](./AUTH_UNIFICATION_RUNBOOK.md) governs this step.
3. **Config & safety-net gaps.** New required env vars (`CRON_SECRET`, `SUPABASE_URL`,
   Luma keys) that silently break auth/crons if missing; a wholesale change to the cron
   surface; a Node-version mismatch; and **no error tracking / uptime monitoring** on a
   live app.

**Recommendation:** big-bang the *code* (dev→main is hard to partially disentangle),
but **sequence the database carefully, rehearse the whole thing on a throwaway Supabase
branch cloned from prod, and cut over *after* the current cohort closes (post-2026-07-14)**
to avoid disrupting a cohort in its final week. Estimated ~1–2 focused engineering days
of hardening + one rehearsal + a ~2-hour cutover window.

---

## 2. Verified current-state snapshot

Everything below was read directly from the live systems on 2026-07-10 (read-only).

| Fact | Value | Source |
|---|---|---|
| `dev` ahead of `main` | **219 commits** | `git rev-list --count origin/main..origin/dev` |
| Prod Supabase | `OLOS-prod` `cdbgkgkjnomjnpicaxqe`, us-**west**-1, PG 17 | `list_projects` |
| Dev/local Supabase (shared) | `OLOS-dev` `cethihabtddiujzayaxe`, us-**east**-2 | `list_projects` + `docs/environments.md` |
| Vercel project | `olos` `prj_0sLydcGEVekxxRIpKAtG8NFUNfss`, team `team_IJrjetypUMpW7fmjwtQA2XDs` | `list_projects` |
| Prod domain | `olos.theupskillinglabs.org` (attached; project `live:false`, latest deploy `target:null`) | `get_project` |
| **Prod data** | 54 participants · 44 enrollments · 10 user_roles · 4 pods · 47 pod_memberships · 11 solution_proposals · 0 votes · 8 invitations | `execute_sql` (prod) |
| **Prod active cycles** | **exactly 1** — "Energy & Climate" (id 3), active, 2026-04-14 → **2026-07-14** | `execute_sql` (prod) |
| Prod migration ledger | `00001–00015` then **timestamps** `20260521185024…20260703222414` (ends at `cycle_agreements`) | `list_migrations` (prod) |
| Dev migration ledger | `00001–00067` then timestamps `20260708…20260710161304` | `list_migrations` (dev) |
| Disk (dev branch) | **77 files** `00001_*…00077_*` (zero-padded) | `ls supabase/migrations` |
| New tables in prod? | **None** of `participant_roles / follows / announcements / resources / metros / events / …` exist yet | `execute_sql` (prod `pg_tables`) |
| Prod owners (active) | adm2216@columbia.edu, amg@withlevy.com, brendan@withlevy.com, hq@theupskillinglabs.org, mjalan@gmail.com (all `granted_by NULL`) | `execute_sql` (prod) |
| Prod admins (active) | aaronaufdeutschland@gmail.com, emodde@gmail.com, jenkemp@gmail.com, sandramoscosomills@gmail.com | `execute_sql` (prod) |
| Node versions in play | `main` `.nvmrc=20` · `dev` `.nvmrc=22` (CI node 22) · Vercel project `24.x` | files + `get_project` |
| CI | `.github/workflows/ci.yml` on **dev only** (check:migrations → lint → tsc → vitest → build) | dev worktree |
| Tests | 33 vitest files (auth/roles, enrollment reconciler, rate-limit, voting, cycle guards, …) | dev worktree |
| Error tracking / uptime | **None** (no Sentry; errors are `console.error` only) | grep dev |
| Legal | `PRIVACY_POLICY` / `TERMS_OF_SERVICE` / `CODE_OF_CONDUCT` + public pages `/(public)/privacy|terms|code-of-conduct` + footer | dev worktree |

---

## 3. Readiness scorecard

| Dimension | RAG | One-line justification |
|---|---|---|
| Code / release scoping | 🟡 | Coherent target; big-bang is the only practical shape, but needs a "gate-off experimental surfaces" pass. |
| **DB migration reconciliation** | 🔴 | Ledger drift means `db push` is unsafe until repaired; the crux of the whole migration. |
| **Auth-unification on live data** | 🔴 | `00064–66` rewrite authority for real users; `00066` hard-codes a non-prod owner; needs the runbook + snapshot + owner decision. |
| DB security / RLS | 🟡 | Prod advisors are all WARN (no RLS-off ERRORs); but ~45 new tables land on promotion and must be advisor-clean first. |
| App security / secrets | 🔴 | New **required** env vars (`CRON_SECRET`, `SUPABASE_URL`) silently break auth/crons if unset in prod. |
| Infra / deploy config | 🟡 | Node mismatch; cron surface changes wholesale; prod-serving state (`live:false`) needs confirming. |
| CI/CD / testing | 🟢→🟡 | Good CI + 33 tests on dev; but CI doesn't gate prod and migrations are applied by hand. |
| Observability / rollback | 🔴 | No error tracking or uptime monitoring on a live app; DB rollback relies on snapshots/PITR only. |
| Compliance / PII | 🟡 | Legal pages wired; consent/erasure shipped but `delete_participant()` has a known FK gap (see §9). |

---

## 4. Blockers (must clear before cutover)

| # | Blocker | Fix (summary) | §ref |
|---|---|---|---|
| **B1** | Migration-ledger drift (prod timestamped vs disk zero-padded) | `supabase migration repair` to realign prod's ledger **before** any push | §5 |
| **B2** | `00066_reroot_owners` hard-codes `hello@brendanwhitaker.com` (not a prod owner) | Decide prod primary owner; edit `00066`; snapshot per auth runbook | §6, §8 |
| **B3** | New **required** prod env vars missing | Set `CRON_SECRET`, `SUPABASE_URL` (+ Luma keys or disable Luma cron) in Vercel **Production** scope | §7, Appendix A |
| **B4** | Cron surface changes wholesale (pulse-check-reminder route removed; revocation-check unscheduled; 5 new crons) | Decide intended cron set; ensure `CRON_SECRET`; verify `vercel.json` | §7, Appendix B |
| **B5** | No pre-cutover snapshot / PITR checkpoint | Confirm PITR available (plan tier) **and** take an explicit snapshot before any DDL | §6 |
| **B6** | Security debt lands on promotion (RLS on new tables, SECURITY DEFINER RPCs, `participants_insert WITH CHECK(true)`, function `search_path`) | Fix on `dev` first; re-run advisors on a prod-clone after migrating; must be clean | §Appendix C |
| **B7** | Supabase prod Auth URL config + Google OAuth prod client for `olos.theupskillinglabs.org` | Confirm Site URL + redirect allow-list + Google client (may already exist — verify) | §7 |
| **B8** (strong) | No observability on a live app | Add error tracking (Sentry/Vercel) + an uptime check + Supabase alerts before/at cutover | §Appendix D |
| **B9** | Node version mismatch (20 / 22 / 24) | Pin one (recommend **22**, matching dev + CI) across `.nvmrc` + Vercel | §7 |

---

## 5. The crux — migration-ledger reconciliation

### 5.1 What's wrong

`supabase` tracks applied migrations in `supabase_migrations.schema_migrations.version`.
That version comes from **the filename's numeric prefix** when you `supabase db push`,
but from **a generated timestamp** when a migration is applied via the MCP
`apply_migration` tool (or Studio). Prod was built largely via MCP, so:

| Logical migration | Disk file (dev branch) | Prod ledger version | Dev ledger version |
|---|---|---|---|
| `initial_schema … grant_role_privileges` | `00001`–`00015` | `00001`–`00015` ✅ match | `00001`–`00015` |
| `short_form_registration` | `00016` | `20260522040043` ⚠ | `00016` |
| `add_nominations_if_missing` | `00017` | `20260521185024` ⚠ (also **out of order**) | `00017` |
| … through `cycle_agreements` | `00018`–`00032` | timestamps `2026052x…20260703222414` ⚠ | `00018`–`00032` |
| `public_content … project_follow_unification` | `00033`–`00077` | **absent** (not yet in prod) | `00033`–`00067` + timestamps |

So prod has **the content** of `00001–00032` but under mismatched version labels for
`00016–00032`, and is **missing `00033–00077` entirely** (confirmed: none of the new
tables exist in prod). `dev` even drifts from itself (`00068_pods_local.sql` on disk ↔
`20260708204135_pods_local` in the dev ledger).

**Why a naïve push is dangerous:** `supabase db push` compares disk versions
(`00016…`) against the remote ledger. It won't find `00016–00032` there (they're
timestamped), so it will try to **re-run** them. Several are not safely idempotent
(e.g. inserts, policy/constraint changes), so the push could error mid-chain or
duplicate data — on prod.

### 5.2 The safe repair (do this on a rehearsal clone first — §6 Phase 2)

```bash
supabase link --project-ref cdbgkgkjnomjnpicaxqe      # link CLI to PROD (guard the password)
supabase migration list --linked                       # see the mismatch: 16–32 show as remote-only timestamps
```

Realign the ledger **without re-running SQL** — mark the zero-padded versions applied
and drop the timestamp duplicates for the already-applied `00016–00032`:

```bash
# Mark the real (disk) versions as applied (content is already in the DB):
supabase migration repair --status applied 00016 00017 00018 00019 00020 \
  00021 00022 00023 00024 00025 00026 00027 00028 00029 00030 00031 00032

# Remove the timestamp duplicates that MCP inserted for those same migrations:
supabase migration repair --status reverted 20260521185024 20260522040043 20260522040047 \
  20260531122024 20260604005310 20260604005314 20260604005317 20260604005320 \
  20260604005322 20260604041556 20260604041606 20260604041615 20260604041647 \
  20260604041655 20260604074708 20260703222356 20260703222414
```

```bash
supabase migration list --linked   # EXPECT: 00001–00032 = applied, 00033–00077 = pending
```

> The exact timestamp list above is from the current prod ledger; re-read it with
> `list_migrations` immediately before running and reconcile 1:1 (there are 17 timestamp
> rows for the 17 migrations `00016–00032`).

Only after the list shows a clean `00001–00032 applied / 00033–00077 pending` do you
proceed to apply the new chain (§6 Phase 4). Do the **auth-unification tranche
(`00064–00066`) via the [auth runbook](./AUTH_UNIFICATION_RUNBOOK.md), not a blind push.**

---

## 6. Phased plan

Each phase has a **gate**: do not enter the next phase until the prior one's checks pass.

### Phase 0 — Decide & freeze  *(pre-cutover)*

| Step | Action | Validation | Rollback |
|---|---|---|---|
| 0.1 | Resolve all **Open Decisions** (§8): cutover timing, prod primary owner, cron set, feature gating, Node target, observability tool | All decisions recorded in this doc | n/a |
| 0.2 | Freeze `dev` (no new merges except hardening from Phase 1) | Announce freeze; branch protection on `dev` | Lift freeze |
| 0.3 | Confirm prod is actually serving today (`live:false` is suspicious) — check last `main` deploy + that `olos.theupskillinglabs.org` responds | `curl -I https://olos.theupskillinglabs.org` 200; Vercel shows a Production deploy | n/a |

**Gate:** decisions locked; freeze in effect.

### Phase 1 — Harden `dev` (land fixes on dev, verify on shared dev DB)  *(pre-cutover)*

| Step | Action | Validation | Rollback |
|---|---|---|---|
| 1.1 | Fix DB security items on `dev` (B6): set `search_path` on `current_participant_id`/`has_permission`/`is_admin_or_owner`; `REVOKE EXECUTE` on those SECURITY DEFINER RPCs from `anon`/`authenticated`; constrain `participants_insert` `WITH CHECK`; confirm **RLS enabled + sane policies on every new table** `00033–00077` | `get_advisors(security)` on dev clean of new WARNs; `pg_policies` review | revert migration |
| 1.2 | Add covering indexes for hot unindexed FKs; wrap `auth.<fn>()` in `(select …)` in flagged RLS policies (perf) | `get_advisors(performance)` improved | revert |
| 1.3 | Ensure cron auth + env: all `/api/cron/*` check `Bearer CRON_SECRET` (verified present); decide Luma cron fate | `verify:cycle` + manual cron curl with/without secret | n/a |
| 1.4 | Add observability (B8): Sentry or Vercel monitoring + uptime check | errors visible in dashboard from a test throw | remove |
| 1.5 | Pin Node to 22 in `.nvmrc` and Vercel project settings (B9) | CI + Vercel build both on 22 | revert |
| 1.6 | Make CI a required check on the `dev→main` PR | branch protection shows CI required | n/a |

**Gate:** dev advisors clean of new issues; CI green; observability live on the dev deploy.

### Phase 2 — Reconciliation **rehearsal** on a prod clone  *(pre-cutover, highest-value de-risk)*

| Step | Action | Validation | Rollback |
|---|---|---|---|
| 2.1 | Create a Supabase **branch** off prod (clones schema+data) *or* restore a prod snapshot into a scratch project | branch exists | delete branch |
| 2.2 | Run the **full §5.2 repair** against the clone | `migration list` shows `00001–00032 applied / 00033–00077 pending` | delete branch |
| 2.3 | Run the **entire cutover DB sequence** (Phase 4.2–4.5) against the clone, including the edited `00066` and the auth-runbook verification queries | all runbook verification queries pass; advisors clean; app smoke-test against the clone | delete branch |
| 2.4 | Record every surprise; fix on `dev`; re-rehearse until clean | a clean dry-run with zero manual patches | — |

**Gate:** one fully clean end-to-end rehearsal with no ad-hoc fixes. **Delete the branch** (it may hold a copy of real PII).

### Phase 3 — Pre-cutover prep  *(pre-cutover)*

| Step | Action | Validation | Rollback |
|---|---|---|---|
| 3.1 | Set **all** prod env vars in Vercel *Production* scope (Appendix A) | `vercel env ls production` shows every required key | n/a |
| 3.2 | Confirm Supabase prod Auth: Site URL + redirect allow-list include `https://olos.theupskillinglabs.org/api/auth/callback`; Google OAuth prod client set (B7) | test Google sign-in on a Vercel preview pointed at prod | n/a |
| 3.3 | Confirm Resend sending domain (`enroll.theupskillinglabs.org`) valid for prod; enable Supabase leaked-password protection | Resend domain "verified"; advisor WARN cleared | n/a |
| 3.4 | Edit `00066` primary-owner email to the **decided** prod owner; re-run `npm run check:migrations` + `npm test` | tests green; `00066` targets the right email | revert edit |
| 3.5 | Confirm PITR/backup coverage on prod; note the restore point | Supabase dashboard shows PITR window / a fresh backup | n/a |
| 3.6 | Schedule cutover **after** the Energy & Climate cohort closes (post 2026-07-14) or in a low-traffic window; notify admins | calendar hold; comms sent | reschedule |

**Gate:** env + auth + backups confirmed; `00066` edited; cutover window agreed.

### Phase 4 — Cutover  *(during-cutover — see §7 runbook for timing)*

| Step | Action | Validation | Rollback |
|---|---|---|---|
| 4.1 | **Snapshot prod** (auth runbook Step 1 tables + note PITR timestamp) | snapshot tables exist | — |
| 4.2 | Apply the **§5.2 ledger repair** to prod | `migration list` → `00033–00077 pending` | ledger-only; re-repair |
| 4.3 | Apply migrations `00033–00063` (feature/content tables; prod lacks them → additive, low risk). **Verify `00048` first:** prod has exactly 1 active cycle → reconcile is a no-op (confirmed) | each applies; app still responds | PITR restore to 4.1 |
| 4.4 | Apply **auth unification `00064–00066`** strictly per [`AUTH_UNIFICATION_RUNBOOK.md`](./AUTH_UNIFICATION_RUNBOOK.md) §Apply + run **all** its Verification queries | runbook verifications all pass (1 rooted owner; 0 admins lost; 0 orphan grants; poderator/lab-lead deltas 0) | runbook §Rollback (restore from snapshot) |
| 4.5 | Apply remaining `00067–00077` (+ any timestamp-named) | each applies; `migration list` fully in sync | PITR restore |
| 4.6 | Merge `dev → main` (`--no-ff`), let Vercel deploy Production | Vercel shows a new **Production** deploy READY | Vercel instant rollback to prior deploy |
| 4.7 | Verify cron surface in Vercel matches the decision; crons return 200 with `CRON_SECRET` | manual curl of each cron | fix `vercel.json` / env |

**Gate (go/no-go before 4.6):** every DB verification green; if any auth-runbook check fails → **abort** and restore from snapshot; do not merge to main.

### Phase 5 — Post-cutover verification & watch  *(post-cutover)*

| Step | Action | Validation |
|---|---|---|
| 5.1 | Smoke test as owner, admin, poderator, regular participant (sign in, `/admin`, `/admin/access`, cycle page, pod page, pulse/log flows) | no 500s; roles resolve correctly |
| 5.2 | Run `get_advisors(security)` + `(performance)` on prod | no new ERROR/critical WARN |
| 5.3 | Watch error tracker + logs for 24–48h; keep snapshot tables until stable, then drop | error rate baseline; no auth regressions |
| 5.4 | Update `docs/environments.md` (branch→env, prod migration process) + close the loop on stale docs | docs reflect reality |

### Rollback / abort summary

- **Code:** Vercel instant rollback to the previous Production deployment (seconds).
- **DB (auth tranche):** restore authority graph from the snapshot per the auth runbook §Rollback (schema additions are backward-compatible and may stay).
- **DB (any tranche):** PITR restore to the pre-cutover checkpoint (Phase 4.1). Because migrations are forward-only, **the snapshot + PITR are the only real net** — this is why Phase 2 rehearsal and Phase 4.1 snapshot are non-negotiable.

---

## 7. Cutover runbook (condensed, ordered)

Pick a window **after 2026-07-14** (cohort closed) or a genuinely low-traffic hour.
Have two people: an operator and a verifier.

```
T-0    Announce start; confirm no active cohort activity in flight.
T+0    Snapshot prod (auth-runbook Step 1) + record PITR timestamp.      [Phase 4.1]
T+5    supabase migration repair (§5.2) → migration list shows clean.     [Phase 4.2]
T+10   Apply 00033–00063 (db push, stopping before 00064).               [Phase 4.3]
       ── GATE: app still responds; 00048 no-op confirmed. ──
T+25   Auth runbook: apply 00064, 00065, edited 00066; run ALL verifies. [Phase 4.4]
       ── GO/NO-GO: any verify fails → ABORT + snapshot restore. ──
T+40   Apply 00067–00077; migration list fully in sync.                  [Phase 4.5]
T+45   Merge dev→main; Vercel deploys Production; wait READY.            [Phase 4.6]
T+55   Verify crons (curl w/ CRON_SECRET) + smoke test all 4 roles.      [Phase 4.7/5.1]
T+70   Re-run advisors; begin 24–48h watch.                              [Phase 5.2/5.3]
```

**Abort criteria:** any auth-runbook verification query returns a non-expected value; a
migration errors mid-chain; smoke test shows an owner/admin locked out. Abort =
Vercel rollback (if already merged) + PITR/snapshot restore + regroup. Because prod is
small (54 users), a full PITR restore is fast and low-blast-radius.

---

## 8. Open decisions (owner must resolve before Phase 4)

1. **Cutover timing.** Recommend **after the Energy & Climate cohort ends (2026-07-14)**
   to avoid disrupting a cohort in its final week. Alternative: a low-traffic window now,
   accepting higher live-cohort risk. — *Decision:* ______
2. **Prod primary owner** (for `00066`). Prod owners today: `adm2216@columbia.edu`,
   `amg@withlevy.com`, `brendan@withlevy.com`, `hq@theupskillinglabs.org`,
   `mjalan@gmail.com`. Dev roots at `hello@brendanwhitaker.com` (**not a prod owner**).
   Pick the rooted apex (likely `hq@theupskillinglabs.org` or `brendan@withlevy.com`)
   and which others stay co-owners vs. demote to admin. — *Decision:* ______
3. **Cron surface.** `pulse-check-reminder` route is gone on `dev`; `revocation-check`
   exists but is unscheduled in `dev/vercel.json`; 5 new crons (learning/leadership/luma)
   are added. Confirm the intended prod cron set; Luma sync needs `LUMA_API_KEY`/`_BASE`
   or should be dropped. — *Decision:* ______
4. **Feature gating for launch.** Confirm whether any experimental surfaces should ship
   flag-off (e.g. entity-explorer via `ENTITY_EXPLORER_ENABLED`, sensemaker/agent-teams
   if reachable). — *Decision:* ______
5. **Observability tool** (Sentry vs. Vercel monitoring vs. other). — *Decision:* ______
6. **Node target** — recommend **22** everywhere. — *Decision:* ______
7. **Rehearsal appetite** — strongly recommend the Phase 2 Supabase-branch rehearsal
   before touching prod. — *Decision:* ______

---

## 9. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `db push` re-applies `00016–00032` on prod | High (if unrepaired) | High (errors/dupes on prod) | §5.2 repair **before** any push; rehearse in Phase 2 |
| Auth backfill misses a current admin/owner → lockout | Med | High | Auth runbook snapshot + verification queries #1–4; keep `participant_permissions` union safety net; rehearse |
| `00066` targets wrong/absent owner email | High (as-written) | High | Decision #2 + edit `00066` in Phase 3.4; verify "exactly 1 rooted owner" |
| Missing `CRON_SECRET`/`SUPABASE_URL` in prod | Med | Med-High (crons 401; server clients misconfigure) | Appendix A checklist in Phase 3.1; smoke crons in 4.7 |
| Cron surface change drops/adds jobs unexpectedly | Med | Med (missed reminders / spurious runs) | Decision #3; verify Vercel cron list post-deploy |
| Promotion mid-cohort disrupts live participants | Med | Med-High | Cut over after 2026-07-14 (Decision #1) |
| A `00033–00077` migration is destructive to prod data | Low | High | Audited: `00036 DELETE FROM resources` (new table, fresh-apply safe), `00048` no-op (1 active cycle), `00077` follow-unify (new tables). Re-verify in rehearsal |
| No error visibility post-cutover | High (today) | Med | B8 observability before cutover |
| Region split (app us-? / dev DB us-east-2 / prod DB us-west-1) adds latency | Low | Low | Note; align Vercel function region to prod DB if latency observed |

---

## Appendix A — Production env var matrix

| Var | Scope | Required? | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production | ✅ | prod project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production | ✅ | prod anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | ✅ | prod service-role (server only) |
| `SUPABASE_URL` | Production | ✅ **new** | non-public server var referenced on `dev`; set to prod URL |
| `CRON_SECRET` | Production | ✅ **new** | every `/api/cron/*` checks `Bearer CRON_SECRET`; unset ⇒ all crons 401 |
| `ANTHROPIC_API_KEY` | Production | ✅ | pod/project name generation |
| `OWNER_EMAILS` | Production | ✅ | note: auto-owner bootstrap is **removed** post-unification; used for legacy/admin paths |
| `RESEND_API_KEY` | Production | ✅ | invitation email |
| `RESEND_FROM_EMAIL` | Production | ✅ | `…@enroll.theupskillinglabs.org` (verified domain) |
| `NEXT_PUBLIC_APP_URL` | Production | ✅ | `https://olos.theupskillinglabs.org` (magic-link/base) |
| `LUMA_API_KEY` / `LUMA_API_BASE` | Production | ⚠ conditional | required only if `sync-luma-events` cron is kept |
| `ENTITY_EXPLORER_ENABLED` | Production | optional | leave unset (route 404s) unless the admin browser is wanted |
| `VERCEL_ENV` | — | auto | provided by Vercel |

## Appendix B — Cron matrix (prod today vs dev target)

| Cron | Prod now | Dev `vercel.json` | Route on dev? | Action |
|---|---|---|---|---|
| `pulse-check-reminder` | scheduled | **absent** | **route removed** | confirm intentional retirement (Decision #3) |
| `revocation-check` | live (per launch-plan) | **absent** | present | decide: schedule or leave disabled |
| `learning-log-window` / `-reminder` | — | added | present | needs `CRON_SECRET` |
| `leadership-log-window` / `-reminder` | — | added | present | needs `CRON_SECRET` |
| `sync-luma-events` | — | added (`0 */6 * * *`) | present | needs `LUMA_API_KEY`/`_BASE` or drop |

## Appendix C — Prod DB security items (from advisors, 2026-07-10)

All current prod advisors are **WARN/INFO** (no RLS-disabled ERRORs). Fix on `dev`, re-verify on the rehearsal clone after migrating:

- **SECURITY DEFINER RPCs callable by `anon`/`authenticated`:** `current_participant_id()`, `has_permission()`, `is_admin_or_owner()` → `REVOKE EXECUTE FROM anon, authenticated` (or `SECURITY INVOKER`); also set `search_path = ''` on each. [linter 0011/0028/0029]
- **`participants_insert` `WITH CHECK (true)`** → constrain to own email/auth_user_id. [0024]
- **Leaked-password protection disabled** → enable (cheap; OAuth-only today). 
- **Performance:** ~20 unindexed FKs (add covering indexes); ~8 `auth_rls_initplan` policies (wrap `auth.<fn>()` in `(select …)`); a few unused indexes; switch Auth DB connections to percentage-based. [0001/0003/0005]
- **Re-run advisors after the new tables land** — 45 new tables/migrations will introduce their own findings not visible on prod today.

## Appendix D — Observability minimum (before cutover)

- **Error tracking:** Sentry (or Vercel's built-in) wired into the App Router + API routes.
- **Uptime:** an external check on `https://olos.theupskillinglabs.org` + `/api/...` health.
- **Supabase:** enable project alerts (DB CPU, connection saturation, auth errors).
- **Log retention:** confirm Vercel log retention or add a drain; today failures are `console.error` only (e.g. `proxy.ts`).

## Appendix E — Known follow-ups (post-cutover, non-blocking)

From `AUTH_UNIFICATION_RUNBOOK.md` and this analysis:

- `delete_participant()` (00058) omits `lab_leads` / `project_roles` → GDPR erasure will fail on FK for those participants. Ship a small fix migration before relying on erasure in prod.
- Retire transitional `user_roles` / `participant_permissions` + `00065` sync triggers as a separate, separately-verified pass.
- Backfill `staff` / `tester` roles from `participants.is_staff` / `is_test` flags.
- Migration-chain baseline snapshot at the next wave boundary (per `supabase/CLAUDE.md`).
- README is still create-next-app boilerplate; refresh with real ops docs.
