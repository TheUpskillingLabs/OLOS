# Lane G — Build, CI, and Deploy Health

Run date: 2026-07-24 · Cutoff (LAST_ACTIVE_DATE): 2026-06-18 · BASELINE = `1d3615f` (`git rev-list -1 --before=2026-06-18 origin/dev`, 2026-06-17) [FACT: 1d3615f]

**Headline: the entire CI/test apparatus post-dates the co-lead's departure.** When adm-2k left (2026-06-18) the repo had no CI, no test runner, and no migration-number guard. All of it was bootstrapped 2026-07-04–07-09 [FACT: 17742d9, bd87972 #180, a0c0061; ci.yml:1-3 says "the repo previously had no test runner and no CI at all"].

---

## 1. Workflows

- **Exactly one workflow has ever existed**: `.github/workflows/ci.yml` [FACT: `git log --all --diff-filter=A -- ".github/workflows/*"` returns only ci.yml]. Identical blob on dev and main (`03871d3`) [FACT: ls-tree].
- Created 2026-07-04 "chore: bootstrap Vitest + CI" [FACT: 17742d9]; GitHub workflow object created 2026-07-04 [FACT: workflow id 307003848].
- Triggers: `pull_request` + `push` on `dev` and `main`. Single job `ci` (ubuntu, Node 22): `npm ci` → `check:migrations` → `lint` → `tsc --noEmit` → `vitest run` → `next build`. Needs no secrets — Supabase-reading pages are force-dynamic [FACT: ci.yml:1-27].
- Changes since cutoff = its whole history: 17742d9 (07-04), bd87972 migration-collision guard (#180, 07-06), a5942ea (07-08), a0c0061 (07-09) [FACT: git log -- .github/workflows/].

## 2. Run history (GitHub Actions API)

426 total runs in CI's ~3-week life. Analyzed the newest **240 runs (#187–#426, 2026-07-11 → 2026-07-23)** [FACT: actions_list, ci.yml]:

- **209 success / 31 failure (12.9%)**; **zero re-run attempts** (every run attempt=1 — failures were fixed forward with new commits, not rerun; no flaky-rerun pattern) [FACT: aggregated API data].
- Push-to-dev failures: 7/75; push-to-main failures: 2/23 in the window [FACT: same].
- **Dominant failure cause: duplicate migration numbers**, caught by `check:migrations`. Run #286 log: "Duplicate migration numbers … 00068: 00068_pods_local.sql, 00068_service_role_admin_paths.sql" [FACT: job 86871615878, run 29266115851].
- **2026-07-13 was a red day on both long-lived branches:**
  - `main` red: runs #267/#268 failed on HQ's direct local merge `294be72` "merge: dev → main (login doors…)" [FACT: run list + git log].
  - `dev` red in two waves: #269-271 and #286-291 (00068 collision, fixed by direct-push renumber `fa1180d`), then again #322 (00085 collision on `0a4f62d` #259, fixed 3 minutes later by `7aab1bf` #261) [FACT: run list; git log origin/dev].
  - **Red-then-merged-anyway:** PR #249 was merged into dev while its branch CI had failed 7 consecutive runs (#279-285); the merge run #286 then failed on dev [FACT: run list + merge 251d42c]. PRs #245/#246 also merged onto red dev (#270/#271) [FACT]. The dev→main promotion run #323 failed; a promotion (#260) merged at 17:06 the same day — likely on a later, fixed head [INFER: med — cannot pin which green run covered the merged head].
  - Same afternoon the team merged PR #257 `docs/no-direct-dev-main-rule` — the PR-only rule was written in direct response [FACT: 96a4a62, 2026-07-13 15:10].
- Runs #1–#186 (2026-07-04 → 07-11) not analyzed — coverage gap (see Gaps).

## 3. Deploy model

- **No deploy workflow in the repo** — deploys are Vercel Git integration: `dev` branch → Vercel preview against dev Supabase (`cethihabtddiujzayaxe`, shared with local); `main` → production `theupskillinglabs.org` against isolated prod Supabase (`cdbgkgkjnomjnpicaxqe`). Env vars live in Vercel with Preview/Production scopes [FACT: docs/environments.md:9-16, 100-101].
- **CI is not a deploy gate** — Vercel builds/deploys on push independently of Actions results [INFER: high — no linkage anywhere in repo; the red-main pushes #267/#268 had no deploy blocker].
- **Migrations are applied to prod manually** after merging to main (Supabase Studio SQL editor or CLI); explicitly not automatic [FACT: docs/environments.md:156-166]. `scripts/ops/{dev,prod}-migration-repair-2026-07-06.sql` suggest a same-day dev+prod migration repair incident on 2026-07-06 [INFER: med — filenames only].
- **Crons (vercel.json)** — 5 registered: `learning-log-window` (Fri 21:00), `learning-log-reminder` (daily 09:00), `leadership-log-window` (Wed 13:00), `leadership-log-reminder` (daily 09:00), `sync-luma-events` (*/6h) [FACT: vercel.json]. Vercel crons execute only on the production deployment [INFER: high — Vercel platform behavior; not stated in repo docs].
  - **`/api/cron/pulse-check-reminder` is NOT registered because the route no longer exists** — deleted in the Learning Log pivot [FACT: 306ded1, 2026-07-04]; `learning-log-reminder` explicitly replaces it [FACT: app/api/cron/learning-log-reminder/route.ts:10]. **Correction to the task prompt**, which asked to verify it registered.
  - **`/api/cron/revocation-check`: route exists, NOT registered — confirmed**, matching open issue **#213** (p1, ops, 2026-07-11) [FACT: vercel.json; issue_read #213]. The schedule was removed "temporarily" by **adm-2k himself** on 2026-05-31 [FACT: 4361f91] — unscheduled ~2 months now. Issue #213's own body is stale: it claims vercel.json registers only pulse-check-reminder (untrue since 07-04) and cites `docs/EVOLUTION.md` / `docs/archive/…`, which don't exist on main (orientation §4).
  - All 6 cron routes accounted for: 5 registered + revocation-check unregistered. No other unregistered cron routes [FACT: ls app/api/cron/].
- **SECURITY FINDING (config-dependent, low/med):** every cron route authenticates with `authHeader !== \`Bearer ${process.env.CRON_SECRET}\`` and has **no guard for CRON_SECRET being unset** — in an environment without it, the literal header `Bearer undefined` authenticates [FACT: app/api/cron/learning-log-reminder/route.ts:35; same pattern in sync-luma-events/route.ts:11]. `CRON_SECRET` is absent from `.env.local.example` and from docs/environments.md's env-var lists, so leaving it unset is easy [FACT: grep]. Routes run with the service-role client and send email. Whether it is actually set in Vercel is [UNVERIFIED].
- Note: `.env.local.example` embeds a live, never-expiring Slack workspace invite URL (`NEXT_PUBLIC_SLACK_INVITE_URL`) — deliberate per its comment, but it is a real join link in a tracked file [FACT: .env.local.example].

## 4. Tests

- Vitest `^4.1.9`; `vitest.config.ts` includes **only `lib/**/*.test.ts`**, node environment, "no DB, no network" by design [FACT: vitest.config.ts].
- **51 test files, 4,425 lines, all under `lib/`** [FACT: find/wc]. Densest: `lib/cycle/` 8 files (phase, guards, week, active, closeout, labels, contacts, org-sector), `lib/auth/` 4 (grants, lab, projects, roles), validations 3, participants 3, owner 3; plus learning-log gate/baseline logic, leadership-log tier logic, rate-limit, enrollment reconciler, email template, moderator, feed/social, csv export [FACT: file list].
- **Untested**: all `app/api/**/route.ts` handlers (incl. every cron route), all React pages/components, `scripts/` (the migrations checker itself has no test), no integration/E2E suite. `scripts/verify/cycle-e2e.mjs` is a live-DB verification script (`npm run verify:cycle`), not part of CI [FACT: package.json, ci.yml].
- **No skipped/focused/todo tests anywhere** (`.skip|.only|xdescribe|xit|todo` → zero hits) and no test was disabled in a commit since cutoff (`git log -S ".skip" --since=2026-06-18 -- "*.test.ts"` → empty) [FACT: grep + git log].
- CI runs both `npm run test` (vitest run) and `npm run check:migrations` [FACT: ci.yml:22,25].

## 5. Branch protection & merge discipline

- **`protected: false` on all 127 branches — including `dev` and `main`** [FACT: list_branches, 2 pages]. Newer-style GitHub *rulesets* are not exposed by this API — [UNVERIFIED] whether any exist, but observed behavior says no effective enforcement:
  - Direct non-PR commits on `main` first-parent since cutoff: `9c7c5d8` "Add files via upload" (2026-07-14), `5377f4d` social card (2026-07-14), and HQ's locally-merged promotion `294be72` (2026-07-12) [FACT: git log --first-parent]. The local-merge flow is what docs/environments.md:109-128 *instructs*, contradicting CLAUDE.md's PR-only rule — the docs page predates the 07-13 rule and was never updated [INFER: high].
  - Direct commits on `dev` since cutoff: ~8, all 2026-07-13/14 (four hero-height commits, two content edits, two migration-renumber hotfixes) [FACT: git log --first-parent --no-merges]. After 2026-07-14 the first-parent lines are PR-only [FACT].
- **CODEOWNERS**: `* @brendanwhitaker @adm-2k @amguzzi` [FACT: .github/CODEOWNERS] — includes the absent co-lead; does NOT include inferno-gh/MJ, who squash-merged most of the latest PR wave (#289–#300) [FACT: committer on dev first-parent]. Without branch protection, CODEOWNERS review is advisory only [INFER: high].

## 6. Dependencies (BASELINE `1d3615f` → HEAD `d260022`)

- package.json diff [FACT: git diff]:
  - Scripts added: `test`, `test:watch`, `check:migrations`, `verify:cycle`, `seed:test-cycle`.
  - Deps added: `react-hook-form ^7.76.1`, `@hookform/resolvers ^5.4.0`; devDep `vitest ^4.1.9`.
  - Bumps: `@anthropic-ai/sdk ^0.86.1 → ^0.98.0`; **`next 16.2.3` (exact pin) → `^16.2.6` (caret)** while `eslint-config-next` stays pinned `16.2.3` — minor version-skew risk; framework no longer pinned [FACT: diff]. `react`/`react-dom` remain pinned `19.2.4`.
  - Nothing removed; nothing security-alarming. `package-lock.json` present and CI uses `npm ci`, so builds are lockfile-reproducible [FACT: ls, ci.yml:21].
- **`proxy.ts` is not an anomaly**: it is `middleware.ts` renamed on 2026-04-09 "for Next.js 16 compatibility" [FACT: e36d494] — the Supabase session/auth middleware (fail-closed on error, public-path allowlist for `/`, `/login`, `/api/`, `/survey`, `/c/`, etc.) [FACT: proxy.ts:45-96]. **Correction to the task prompt.**

## 7. Operational scripts (`scripts/`)

- Top level: `check-auth-rows.mjs` (prod auth-row diagnostics per docs/environments.md), `check-embeds.mjs` (smoke-tests PostgREST embed selects against a live DB — a runtime contract unit tests/build can't verify [FACT: file header]), `check-migration-numbers.mjs` (zero-dep duplicate-prefix guard, wired into CI [FACT: file header, ci.yml:22]).
- `scripts/ops/`: `seed-test-cycle.mjs`, `send-bulk-invites.ts`, `seed-sample-spotlights.sql`, `reset-energy-participants.sql`, `dev-` & `prod-migration-repair-2026-07-06.sql` [FACT: ls].
- `scripts/verify/`: `cycle-e2e.mjs` (cycle end-to-end verification, run manually).
- `scripts/migration/`: **the only Python in the repo** — `migrate.py` + `requirements.txt` + `column_mapping.csv`, an offline legacy-spreadsheet→Postgres ETL, not a service [FACT: ls].
- CLAUDE.md one-liners: `scripts/ops/CLAUDE.md` — "one-shot or ad-hoc Node/TypeScript scripts that run against a live Supabase project," distinct from migration/ [FACT: file]. `scripts/migration/CLAUDE.md` — "legacy spreadsheet → Postgres" (W1-003/004/005, Wave-1 critical path) [FACT: file].

## Gaps

- CI runs #1–#186 (2026-07-04 → 07-11) not retrieved — failure-rate figures cover only the newest 240 runs. [UNVERIFIED for early period]
- GitHub **rulesets** (successor to classic branch protection) are not visible via `list_branches`; no read-only MCP tool for the rulesets endpoint was available. Absence of protection is inferred from the flag plus observed direct pushes. [UNVERIFIED]
- Could not identify the specific green CI run covering the head that PR #260 (dev→main promotion after red run #323) actually merged. [UNVERIFIED]
- Vercel-side state is invisible from the repo: whether `CRON_SECRET` is set in either environment, actual cron execution history, preview/production env-var values, and deploy success/failure history. [UNVERIFIED]
- Whether all 91 migrations are applied to prod cannot be checked — DB connections prohibited by audit rules (live alpha data). [UNVERIFIED]
- Whether Vercel "Ignored Build Step" or deployment protection is configured (would change the "CI is not a deploy gate" nuance). [UNVERIFIED]
