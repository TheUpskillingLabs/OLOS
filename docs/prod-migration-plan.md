# OLOS — Dev → Production Migration Plan

> **Authored:** 2026-07-10 · **Revised:** 2026-07-10 (reset-and-rebuild approach)
> **Scope:** promote the `dev` branch (219 commits ahead of `main`) onto production —
> Vercel `olos` + Supabase `OLOS-prod` (`cdbgkgkjnomjnpicaxqe`).
> **Chosen strategy:** **Reset & Rebuild** — archive prod, reset it to the clean `dev`
> schema, restore only what's needed, point `main` at it. Chosen because the owner is
> willing to back up and reset prod, which removes the two hardest hazards of an
> in-place migration (see §1).
> **Locked decisions (2026-07-10):** **A1 — reset the existing prod project in place**
> (keep `auth`/`storage`, same keys/domain/env) · **Restore identities only** — bring back
> `participants` so members can still sign in, but **do not** restore the old role graph;
> seed just the bootstrap owner(s) and re-grant everything else via `/admin/access` after
> cutover. Still open: which account is the bootstrap owner (§7).
> **Overall readiness: 🟡 — straightforward once the owner is named and one rehearsal passes.**

---

## 0. Rehearsal results (2026-07-11) — the migration chain does NOT replay cleanly ⚠️

Ran the Phase 3 rehearsal on a throwaway Supabase branch (isolated DB, ~1.3¢/hr, deleted
after). **Headline: rebuilding prod by replaying the migration history fails**, which
changes the rebuild method below.

- Supabase's branch runner replayed dev's recorded migrations and **failed at
  `00054_participant_roles`** — it applied `00001–00053`, then errored.
- **Root cause:** `00054` reads `participants.role_intents`, but that column was **absent**
  after `00001–00053` in the replayed history — even though the worktree `00031` file adds
  it (`ADD COLUMN IF NOT EXISTS role_intents`). **The migration _files_ have drifted from
  the migration _history_ that actually built dev.** Verified the fix on the branch: adding
  `role_intents` makes `00054` apply cleanly (table created, RLS enabled).
- `00054` is one of a **cluster of migrations ported from another repo**
  ("generated from docs/DB_CHANGES_ONBOARDING.md / handoff-to-olos", ~`00054–00058`), so
  expect more ordering/assumption landmines in the tail — do not assume the rest replays.
- Confirmed clean: `auth` + `storage` schemas persist across a `DROP SCHEMA public`, and both
  storage-bucket inserts (`00029`, `00046`) are `ON CONFLICT`-guarded, so preserving
  `storage` is safe.

**Consequence — rebuild from a schema _baseline_, not the 77-migration chain.** Capture a
single schema snapshot from the known-good **dev** database (`supabase db dump`) and apply
_that_ to the reset prod DB. It matches dev exactly, has zero ordering fragility, and is the
"baseline snapshot" the repo's own [`supabase/CLAUDE.md`](../supabase/CLAUDE.md) already
prescribes at wave boundaries. The historical chain stays in the repo for git-blame; new
post-launch migrations continue from the baseline. Phases 2 & 4 below are revised for this.

---

## 1. Why reset-and-rebuild is the right call

The original plan (now **Appendix G**) migrated the live prod DB *in place*. That was
dominated by two dangerous, fiddly problems:

- **Migration-ledger drift** — prod records migrations under timestamp versions, disk
  uses zero-padded numbers, so `supabase db push` would re-apply or skip migrations and
  needed a delicate `migration repair` dance first.
- **A live auth-model rewrite** — `00064–00066` would rewrite authorization for real
  users, and `00066` hard-codes an owner email that isn't a prod owner.

**Resetting prod makes both vanish:**

| Hazard (in-place) | With a reset/rebuild |
|---|---|
| Ledger drift → repair required | ✅ **Gone.** A fresh DB gets the clean chain `00001–00077` straight from disk; ledger matches files exactly, forever. |
| `00066_reroot_owners` rewrites live authority | ✅ **Gone.** On an empty `participants` table, `00066` hits its built-in *"fresh DB → skip re-root"* path (verified in the migration source). We seed owners directly instead. |
| `00048_single_active_cycle` demotes a live cycle | ✅ **Gone.** No cycles exist at rebuild time → no-op. |
| `00036 DELETE FROM resources` etc. | ✅ **Safe by design** — these were written to run as part of a fresh chain. |
| Risk to the running cohort mid-flight | ✅ **Low.** We archive first; the live cohort ("Energy & Climate") ends **2026-07-14** anyway. |

What remains to do is ordinary launch hygiene: env vars, cron surface, security-advisor
fixes, observability, and a Node-version pin (all in §5 / appendices).

---

## 2. Verified current-state snapshot (read live, 2026-07-10)

| Fact | Value |
|---|---|
| `dev` ahead of `main` | **219 commits** |
| Prod Supabase | `OLOS-prod` `cdbgkgkjnomjnpicaxqe`, us-west-1, PG 17 |
| Dev/local Supabase (shared) | `OLOS-dev` `cethihabtddiujzayaxe`, us-east-2 |
| Vercel | project `olos` `prj_0sLydcGEVekxxRIpKAtG8NFUNfss`, team `team_IJrjetypUMpW7fmjwtQA2XDs`, domain `olos.theupskillinglabs.org` |
| **Prod data** | 54 participants · 44 enrollments · 10 user_roles · 4 pods · 47 pod_memberships · 11 solution_proposals · **0 votes** · 8 invitations |
| **Prod active cycle** | exactly 1 — "Energy & Climate" (id 3), 2026-04-14 → **2026-07-14** |
| New tables in prod? | **None** — prod is at the `~cycle_agreements` era; `dev` adds ~45 migrations of new tables |
| Prod owners (active) | adm2216@columbia.edu, amg@withlevy.com, brendan@withlevy.com, hq@theupskillinglabs.org, mjalan@gmail.com |
| Prod admins (active) | aaronaufdeutschland@gmail.com, emodde@gmail.com, jenkemp@gmail.com, sandramoscosomills@gmail.com |
| Disk migration chain (dev branch) | `00001_*…00077_*` (zero-padded, clean) |
| New required env vars (vs main) | `CRON_SECRET`, `SUPABASE_URL`, (+ `LUMA_API_KEY`/`_BASE` if Luma cron kept) |
| CI / tests | `.github/workflows/ci.yml` + 33 vitest files (on `dev` only) |
| Error tracking / uptime | **None** today |
| Node versions in play | main `.nvmrc=20` · dev `.nvmrc=22` (CI 22) · Vercel `24.x` |

---

## 3. Two decisions that shape the steps

A **full archive backup is taken regardless**, so nothing is ever truly lost. These two
choices only affect the *live* rebuilt DB and the infra:

### Decision A — reset target
- **A1 · Reset existing prod in place (recommended for config simplicity).** Drop &
  rebuild only the `public` schema on `cdbgkgkjnomjnpicaxqe`, **preserving the `auth` and
  `storage` schemas** so existing Google logins and avatar files survive. Same API keys,
  same domain, same Vercel env — near-zero config churn. Cost: a schema-drop on the live
  project (mitigated by archive + rehearsal).
- **A2 · Fresh new project (safest rollback).** Build `OLOS-prod-v2` clean, cut Vercel
  over, keep the old project paused as the archive. Cost: update Vercel keys + Supabase
  Auth URLs + the Google OAuth redirect URI; `auth.users` don't carry, so users re-link
  Google on first sign-in (seamless — the callback links by email).

### Decision B — restore scope → **CHOSEN: identities only**
Restore `participants` (email + `auth_user_id`) so members can still sign in, but **do not**
restore the old role graph (`user_roles` / `moderator_assignments` / `participant_permissions`).
Archive the closing cohort's pods/proposals/pulses. Because the post-unification code removed
the auto-owner bootstrap, a fresh DB has **no owner** — so we still deliberately seed the
**bootstrap owner(s)** (Phase 4.5); every other grant (admin, poderator, …) is re-issued
through the app's `/admin/access` console after cutover.

> Not chosen (kept for reference): *owners/admins only* (skip restoring members — they
> re-register/get re-invited), or *everything* (also transform + restore all cohort data —
> most work). This document is written for the locked path: **A1 + identities-only**;
> where the **A2 (fresh project)** variant changes a step, it's called out inline.

---

## 4. The Reset & Rebuild plan (defaults A1 + B1)

Each phase has a **gate** — don't advance until its checks pass.

### Phase 0 — Decide & freeze
| Step | Action | Validation |
|---|---|---|
| 0.1 | Confirm Decision A + Decision B (§3) and the **prod primary owner** for role-seeding | recorded here |
| 0.2 | Freeze `dev` merges (except Phase 1 hardening); post a maintenance notice for the cutover window | freeze announced |
| 0.3 | Confirm prod is currently serving (`get_project` showed `live:false`) — `curl -I https://olos.theupskillinglabs.org` | 200 response |

**Gate:** decisions locked; window agreed (recommend after the cohort closes, 2026-07-14).

### Phase 1 — Harden `dev` (ships with the code)
| Step | Action | Validation |
|---|---|---|
| 1.1 | Fix DB-security advisors on `dev` (Appendix C): `search_path` on the 3 SECURITY DEFINER fns; `REVOKE EXECUTE` on their RPCs from `anon`/`authenticated`; constrain `participants_insert WITH CHECK`; confirm RLS enabled + sane on **every** new table `00033–00077` | `get_advisors(security)` clean on dev |
| 1.2 | Add covering indexes for hot unindexed FKs; wrap `auth.<fn>()` in `(select …)` in flagged policies | `get_advisors(performance)` improved |
| 1.3 | Add observability (Appendix D): error tracking + uptime + Supabase alerts | test error visible |
| 1.4 | Pin Node to **22** in `.nvmrc` + Vercel project | CI + Vercel both on 22 |
| 1.5 | Make CI a required check on the `dev→main` PR | branch protection set |

**Gate:** dev advisors clean; CI green; observability live.

### Phase 2 — Archive prod ("save all the data")
| Step | Action | Validation |
|---|---|---|
| 2.1 | Full logical dump of prod (`pg_dump` of the whole DB **incl. `auth`**), stored securely **outside git** (contains PII) | dump file exists, size sane |
| 2.2 | Also export targeted CSVs of the tables you'll restore: `participants` (incl. `auth_user_id`), `user_roles`, `moderator_assignments`, `cycle_enrollments` | CSVs match row counts in §2 |
| 2.3 | **Test-restore** the dump into a throwaway Supabase branch/scratch project | restore succeeds; spot-check rows |

**Gate:** a *verified-restorable* archive exists. Do not proceed without this.

### Phase 3 — Capture & validate the schema baseline, then rehearse
> Partially done 2026-07-11 (§0): a branch rehearsal proved the **77-migration replay fails
> at `00054`** (files drifted from history). This phase now centers on producing a clean
> baseline and rehearsing *that*.

| Step | Action | Validation |
|---|---|---|
| 3.1 | On a **known-good dev** checkout, cut the schema baseline: `supabase db dump --schema public > baseline.sql` (plus a `--data-only` dump of lookup tables like `option_lists` the app needs non-empty) | `baseline.sql` created; grep confirms `participant_roles`, RLS, functions present |
| 3.2 | Create a throwaway Supabase branch; run the grants prelude (`DROP SCHEMA public CASCADE; CREATE …; GRANT …`); apply `baseline.sql`; then run the identity-restore + owner-seed (Phase 4.4–4.5) with synthetic rows | baseline applies with **zero** errors; a synthetic owner resolves via `is_owner()`; app smoke-test passes |
| 3.3 | Run `get_advisors(security)` + `(performance)` on the branch | no ERRORs; log WARNs for Appendix C |
| 3.4 | Fix any surprise on `dev`, re-cut the baseline, re-rehearse until zero manual patches | one clean dry-run |
| 3.5 | Delete the branch | branch removed |

**Gate:** `baseline.sql` applies cleanly end-to-end with zero manual patches, and a synthetic
owner + member both resolve. That validated file is the artifact Phase 4 uses.

### Phase 4 — Reset & rebuild prod (cutover)
| Step | Action (A1 · reset in place) | Validation | Rollback |
|---|---|---|---|
| 4.1 | Take a Supabase snapshot / note PITR timestamp (belt-and-suspenders atop the Phase 2 archive) | snapshot recorded | — |
| 4.2 | `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` then restore baseline grants (`GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role; GRANT ALL ON SCHEMA public TO postgres;`). **Leave `auth` + `storage` untouched.** | `\dn` shows public empty; auth.users intact | PITR restore |
| 4.3 | Apply the **validated `baseline.sql`** from Phase 3 to the fresh `public` schema — **not** the 77-migration replay (proven to fail at `00054`, §0). Then stamp the migration ledger to match the baseline so post-launch migrations continue cleanly | all dev tables/functions/policies present; `participant_roles` exists; tables empty | PITR restore |
| 4.4 | Restore **identities only**: `INSERT INTO participants (<columns present in new schema>) SELECT … FROM archive` preserving `id`, `auth_user_id`, `email`; reset the id sequence. **No** role/enrollment/pod data | prod participant count == restored set; a known member can sign in (lands role-less, e.g. on `/register`-completion or home) | re-run from archive |
| 4.5 | **Bootstrap owner(s) only:** insert the decided primary owner into `participant_roles (role='owner', granted_by=NULL)` (+ mirror `user_roles`); optionally seed a second co-owner. **All other roles (admin, poderator, …) are granted later via `/admin/access`** | owner can sign in and `/admin/access` loads; no other roles present | delete the seeded owner row |
| 4.6 | Set/confirm all prod env vars in Vercel **Production** scope (Appendix A) | `vercel env ls production` complete | — |
| 4.7 | Merge `dev → main` (`--no-ff`) → Vercel deploys Production | Vercel Production deploy READY | Vercel instant rollback |
| 4.8 | Confirm cron surface (Appendix B) + `CRON_SECRET`; curl each cron | 200 with secret, 401 without | fix `vercel.json`/env |

> **A2 · fresh project** replaces 4.2–4.3 with "create project → apply `baseline.sql`," adds
> "configure Auth Site URL + redirect allow-list + Google OAuth redirect URI + Resend," and
> in 4.4 restore participants with `auth_user_id = NULL` (users re-link on first sign-in), and
> in 4.6 update Vercel to the **new** project URL/anon/service keys.

> **B2 · owners/admins only** skips 4.4 (restore participants) — seed just the owner/admin
> accounts in 4.5; members re-register/get re-invited.

**Gate (go/no-go before 4.7):** DB rebuilt, ledger clean, a real owner + a real member can
both sign in on the clone/prod. If sign-in fails → stop, fix, or restore.

### Phase 5 — Verify & watch
| Step | Action | Validation |
|---|---|---|
| 5.1 | Smoke test all roles (owner, admin, poderator, member): sign-in, `/admin`, `/admin/access`, cycle/pod pages, pulse/log flows | no 500s; roles resolve |
| 5.2 | Run `get_advisors(security)` + `(performance)` on prod | no new ERROR / critical WARN |
| 5.3 | Watch error tracker + logs 24–48h; keep the archive; drop the snapshot once stable | error baseline steady |
| 5.4 | Update `docs/environments.md` (prod is now a clean chain; document the reset) | docs match reality |

---

## 5. Condensed cutover runbook

Pick a window **after 2026-07-14** (cohort closed) or a low-traffic hour. Two people:
operator + verifier. The Phase 2 archive and a green Phase 3 rehearsal are prerequisites.

```
T-0   Maintenance notice; confirm archive is verified-restorable.
T+0   Snapshot/PITR checkpoint on prod.                         [4.1]
T+5   DROP SCHEMA public CASCADE; CREATE; restore grants.       [4.2]
T+10  Apply validated baseline.sql to fresh public schema.      [4.3]
      ── GATE: 00066 logged 'fresh DB skip'; no errors. ──
T+20  Restore participants (id + auth_user_id + email) — no roles. [4.4]
T+30  Bootstrap the primary owner in participant_roles only.       [4.5]
      ── GO/NO-GO: owner AND a member can sign in. Fail → restore. ──
T+40  Confirm Vercel Production env vars.                       [4.6]
T+45  Merge dev→main; Vercel Production deploy READY.           [4.7]
T+55  Verify crons + smoke-test all 4 roles.                    [4.8/5.1]
T+70  Re-run advisors; begin 24–48h watch.                      [5.2/5.3]
```

**Abort:** any migration errors mid-chain, or an owner/member can't sign in →
PITR/snapshot restore (fast; prod is small) and, if already merged, Vercel rollback.

---

## 6. Risk register (reset approach)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Migration chain doesn't replay cleanly (proven: breaks at `00054`, §0) | **Confirmed** | High | Rebuild from a validated `baseline.sql`, not the chain (Phase 3/4.3) |
| More drifted/ported migrations (`00054–00058` cluster) hide further breaks | Med | Med | Baseline sidesteps replay entirely; Phase 3 rehearsal re-validates end-to-end |
| Archive not actually restorable | Low | High | Phase 2.3 test-restore is a gate |
| `DROP SCHEMA public` breaks baseline grants/extensions | Med | Med | Rehearse on a clone (Phase 3); restore grants explicitly; or use A2 (fresh project) to sidestep |
| Restored `participants` don't line up with `auth.users` → members locked out | Med | High | A1 preserves `auth`; verify a real member sign-in at the go/no-go gate |
| Missing `CRON_SECRET`/`SUPABASE_URL` in prod | Med | Med | Appendix A checklist (4.6); cron smoke test (4.8) |
| Cron surface change drops/adds jobs | Med | Med | Decision in Appendix B; verify Vercel cron list post-deploy |
| Security debt lands with the new tables | Med | Med | Phase 1 advisor fixes on dev first; re-run advisors in 5.2 |
| No observability post-cutover | High (today) | Med | Phase 1.3 before cutover |
| Losing archived cohort data matters later | Low | Low-Med | Full dump retained; can be re-imported into an `archive` schema if needed |

---

## 7. Open decisions for the owner

1. ~~Decision A~~ — **LOCKED: A1 (reset existing prod in place).**
2. ~~Decision B~~ — **LOCKED: identities only** (restore participants; bootstrap owner only; re-grant the rest via `/admin/access`).
3. **Bootstrap owner** — which account is seeded as the single rooted owner? *(still open — recommend `hq@theupskillinglabs.org` as the org apex, optionally with `brendan@withlevy.com` as a co-owner.)* — ______
4. **Cutover timing** — recommend after 2026-07-14 (cohort closed). — ______
5. **Cron surface** — retire `pulse-check-reminder` (route removed on dev)? schedule `revocation-check`? keep `sync-luma-events` (needs Luma keys)? — ______
6. **Feature gating** — any experimental surfaces to ship flag-off? — ______
7. **Observability tool** — Sentry vs Vercel monitoring vs other. — ______

---

## Appendix A — Production env var matrix

| Var | Scope | Required? | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production | ✅ | prod project URL (A2: the **new** project's URL) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production | ✅ | (A2: new anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | ✅ | server only (A2: new service key) |
| `SUPABASE_URL` | Production | ✅ **new** | non-public server var referenced on dev |
| `CRON_SECRET` | Production | ✅ **new** | every `/api/cron/*` checks `Bearer CRON_SECRET`; unset ⇒ crons 401 |
| `ANTHROPIC_API_KEY` | Production | ✅ | pod/project name generation |
| `OWNER_EMAILS` | Production | ✅ | legacy/admin paths (auto-owner bootstrap is removed post-unification) |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Production | ✅ | invitation email; `…@enroll.theupskillinglabs.org` |
| `NEXT_PUBLIC_APP_URL` | Production | ✅ | `https://olos.theupskillinglabs.org` |
| `LUMA_API_KEY` / `LUMA_API_BASE` | Production | ⚠ conditional | only if `sync-luma-events` cron kept |
| `ENTITY_EXPLORER_ENABLED` | Production | optional | leave unset (route 404s) unless wanted |

## Appendix B — Cron matrix (prod today vs dev target)

| Cron | Prod now | Dev `vercel.json` | Route on dev? | Action |
|---|---|---|---|---|
| `pulse-check-reminder` | scheduled | absent | **removed** | confirm intentional retirement |
| `revocation-check` | live | absent | present | decide: schedule or leave off |
| `learning-log-window`/`-reminder` | — | added | present | needs `CRON_SECRET` |
| `leadership-log-window`/`-reminder` | — | added | present | needs `CRON_SECRET` |
| `sync-luma-events` | — | added | present | needs Luma keys or drop |

## Appendix C — Prod DB security items (advisors, 2026-07-10; all WARN/INFO)

Fix on `dev` (they ship with the migrations), re-verify on the rehearsal clone + in 5.2:

- SECURITY DEFINER RPCs callable by `anon`/`authenticated`: `current_participant_id()`,
  `has_permission()`, `is_admin_or_owner()` → `REVOKE EXECUTE FROM anon, authenticated`
  (or `SECURITY INVOKER`) + set `search_path = ''`.
- `participants_insert WITH CHECK (true)` → constrain to own email/`auth_user_id`.
- Enable leaked-password protection.
- Perf: ~20 unindexed FKs (add covering indexes); ~8 `auth_rls_initplan` policies (wrap
  `auth.<fn>()` in `(select …)`); a few unused indexes; Auth DB connections → percentage-based.
- **Re-run advisors after the rebuild** — the ~45 new tables introduce findings not on prod today.

## Appendix D — Observability minimum (before cutover)

- Error tracking (Sentry or Vercel monitoring) in the App Router + API routes.
- External uptime check on `olos.theupskillinglabs.org`.
- Supabase project alerts (DB CPU, connections, auth errors).
- Confirm Vercel log retention / add a drain (today failures are `console.error` only).

## Appendix E — Known follow-ups (post-cutover, non-blocking)

- `delete_participant()` (00058) omits `lab_leads` / `project_roles` → GDPR erasure fails on
  FK for those participants; ship a small fix migration before relying on erasure.
- Retire transitional `user_roles` / `participant_permissions` + `00065` sync triggers as a
  separate, verified pass.
- Backfill `staff` / `tester` roles from `participants.is_staff` / `is_test`.
- Refresh the README (still create-next-app boilerplate).

## Appendix F — Auth-unification reference

`docs/AUTH_UNIFICATION_RUNBOOK.md` governs the `00064–00066` auth model. **In the reset
approach it runs against an empty DB, so `00066` self-skips the re-root** and we seed
owners directly (Phase 4.5) — the runbook's snapshot/verify dance is only needed for the
in-place alternative (Appendix G).

## Appendix G — Alternative: in-place migration (if the reset is rejected)

If prod must be migrated **without** a reset, use the original approach: repair the
migration ledger with `supabase migration repair` (align prod's timestamp versions to the
zero-padded disk versions for `00016–00032`, then `db push` `00033–00077`), and run the
auth unification strictly per `docs/AUTH_UNIFICATION_RUNBOOK.md` (snapshot → edit `00066`
owner email → apply → verify). This carries the ledger-drift and live-authority-rewrite
risks that the reset approach eliminates. Kept here for completeness; **not the chosen path.**
