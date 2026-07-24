# Lane A — Branch & Commit Archaeology

Run 2026-07-24 · Repo `/home/user/OLOS` (TheUpskillingLabs/OLOS) · Read-only.
Cutoff (LAST_ACTIVE_DATE): **2026-06-18** — adm-2k's last commit d8d4741, 2026-06-18 02:50 ET [FACT: d8d4741].
BASELINE (origin/dev at cutoff): **1d3615f224fa55cefdcfd5c4d49ae7d60caf5768** = `git rev-list -1 --before="2026-06-18 23:59:59 -0400" origin/dev` [FACT: 1d3615f]. Curiosity: that sha is also the tip of `origin/requirements` (amguzzi, 2026-06-17, fully merged) [FACT: 1d3615f].
Commits on origin/dev since cutoff: **314** total, **60 first-parent** (≈38 PR merges + 22 direct/squash commits) [FACT: git rev-list --count].

## 0. METHOD CAVEAT THAT CHANGES EVERYTHING: the clone is SHALLOW

`.git/shallow` contains **9 boundary commits** (`git rev-parse --is-shallow-repository` = true) [FACT: .git/shallow]: two dated 2026-04-10 (ec9ff30, 1aac4dc) and seven dated 2026-07-07/08 (a5942ea, c453a98, 00710f6, a926633, 1fa2e30, f2f40d4, 8e697b1). Main's *local* ancestry is truncated at these points, so:

- Local `git rev-list --left-right --count origin/main...<branch>` **overstates "ahead" for any branch older than ~2026-07-11**. E.g. 18 `claude/*` branches showed 88–123 "ahead"; `origin/schema-development` showed "57 ahead, disjoint root".
- I initially concluded two history rewrites ("repo re-rooted 2026-04-10, PRs #1–#21 orphaned" and "dev force-pushed ~2026-07-11, PRs #136–#160 orphaned"). **Both are refuted by the GitHub API**: `list_commits(sha=main, until=2026-04-10)` returns the PR #8–#21 line *and* c376051 (schema-development's tip) as ancestors of main; `list_commits(sha=main, 2026-07-04)` returns the PR #145–#154 merges (Brendan Whitaker) as ancestors of main [FACT: GitHub list_commits, 2026-07-24].
- Corrections this forces:
  - **True repo root is 3e2da13 "first commit" (amguzzi, 2026-04-07)** — the Phase-0 orientation's "repo born 2026-04-10" is a shallow-clone artifact [FACT: GitHub list_commits; 3e2da13 visible complete on origin/schema-development].
  - `schema-development` (adm-2k, tip c376051 2026-04-08) is **merged into main**, not 57-ahead [FACT: GitHub list_commits shows c376051 in main ancestry].
  - **No evidence of any force-push / history rewrite on main or dev.** Apparent orphaning was truncation.
- Tree-level diffs (used below for "remaining delta") are unaffected by shallowness.
- Any other lane using local ahead/behind counts for pre-July branches inherits this error.

## 1. Merge cadence (dev → main promotion history)

Main has 45 first-parent merges + 14 first-parent non-merge commits, total ≈59 first-parent events [FACT: git log origin/main --first-parent]. Of the merges, **18 are `dev` → `main` promotions** [FACT: grep -c "from TheUpskillingLabs/dev"]; the rest are feature branches merged straight to main (see §4).

Eras:
1. **2026-04-07 → 2026-05-19 — trunk-on-main.** Feature-branch PRs merged directly into main (#8–#71); Madhu also pushed 8 direct commits to main 05-07…05-18 [FACT: main --first-parent --no-merges]. No dev/main split in practice.
2. **2026-05-20 → 2026-06-04 — dev workflow adopted.** First dev→main promotion ed1a471 (#80, 2026-05-20); then #90 (05-21), #92 (05-22), #109 (05-31), #127/#129/#131 (06-04, all merged by adm-2k) [FACT: merge log].
3. **2026-06-04 → 2026-07-03 — THE 29-DAY GAP, the longest ever.** No dev→main promotion between a164dff (#131, 06-04) and 19a52db (#135, 07-03) [FACT: merge log]. This gap brackets the co-lead's departure (06-18). Second-longest gap: 04-10 → 04-30 (20 days, pre-dev-workflow).
4. **2026-07-11 → now — near-continuous.** Production cutover 07-11 (1a6ef3b "take dev tree wholesale" + fa739eb PR #219), then promotions on 07-11 (x2 more), 07-12 (x5, incl. 4 manual no-PR merge pushes by HQ/Claude), 07-13 (x4: #251/#253/#255/#260), 07-14, 07-15 (#278), 07-16 (#285), 07-22 (x3: #296/#299/#301) [FACT: merge log]. Cadence has been near-daily since the 07-11 cutover, with one 6-day pause 07-16→07-22.

dev==main today; the only 3 commits on main not back-merged to dev are the final promotion merges d260022/05ef52e/e23e62f (#301/#299/#296) [FACT: git log origin/dev..origin/main].

## 2. Thematic history — what landed on dev since 2026-06-18 (314 commits)

Note the shape: on the *current* dev line, nothing lands between 06-18 and 07-03 — June activity happened on side branches (adm-2k's docs branches, the 07-06/07 `claude/*` burst) and reached main via the 07-03 (#135) and 07-11 cutover promotions. July is the flood (592 commits across all branches in July vs 61 in June [FACT: orientation]).

| # | Theme | Representative commits/PRs | Authors | Dates |
|---|-------|---------------------------|---------|-------|
| 1 | **Production cutover + Cycle 3 launch** | 1a6ef3b + fa739eb (#219 "production cutover"), daf291a (#222), d8b2efc "Cycle 3 launch — July-11 fix train, June requirements re-baseline", #223 July-feedback/June-changes, #236 remove DCPL logo, 1d56e1e unlist public chrome pages | Claude, brendanwhitaker, HQ, amguzzi | 07-11→07-12 |
| 2 | **Auth/login doors** | 294be72/0de4d4f "login doors: join explainer vs straight sign-in, account chooser, no-account notice" | HQ | 07-12 |
| 3 | **Cycle registration & calendar** | 741f3f6 (#190 registration for upcoming cycle + cycle info pages), #245 lab-timezone windows, #246 info screens, **#247→#259 Stage-1 calendar** (cycle_phases/cycle_events migration 00085/00086 + D-10 registration gate; see §5 saga), #250 referral capture, #256 cycle page description, 5409b20 (#289 ZIP validation), 6651a59 (#294 project_min fix) | amguzzi, Claude, MJ, HQ | 07-06→07-21 |
| 4 | **Surveys & learning instruments** | 7f8f35f (#264 baseline learning log), 115815e (#265 Weekly Learning Log v2, nine-item, migration 00091), #270/#271 (00089 one-survey-per-cycle)/#272 survey-cycle links & edit, e5c8ad7 (#283 survey data backpopulation, 00090) | amguzzi, Claude | 07-14→07-16 |
| 5 | **Dashboard UX** | f08df11 (#262 copy), 79dd116 (#275 checklist-first), aa822f9 (#284 mobile-first feed layout + pagination), 2121229 (#268 profile-card nav), 06ba235 (#273 expandable announcements), b1abda1 (#300 profile save fixes + pod activity feed) | amguzzi, Brendan, MJ, Claude | 07-13→07-22 |
| 6 | **Slack integration saga** | e33dee6 (#287 Slack invite link — merged to MAIN directly), ca5fb40 (#291 re-land onto dev), a9cc2ad (#290), b7fe9d3 (#295 new-signups-only), b128cf2 (#298), 1fa0eb7 (#297 sync main→dev) | MJ, amguzzi, Claude | 07-17→07-22 |
| 7 | **Public site content** | hero-band height churn (8f93bfb/dc7da8f/dca5913/e753bdd — direct commits), 251d42c (#249 hero content), b73fc6d (#252 spotlights homepage), 74cb4a6 (#263 register copy), eb20a5f Founded-in-DC copy, f00b91a/b191bc4 (#266/#267 remove team-leadership page → /board) | Claude, amguzzi, Brendan | 07-13→07-14 |
| 8 | **Migration-number repairs** | fa1180d + a235321 (00068→00085 renumber), 7aab1bf (#261 00085→00086 renumber) — collisions caused by parallel work | amguzzi, MJ | 07-13 |
| 9 | **Process & feedback governance** | 96a4a62 (#257 no-direct-dev-main rule), ca7b53f (#274 feedback pod close rule), 6e59b91 (#276 feedback triage planning), a516b42 (#279 feedback list), be9db17/e697f40 (#277/#280 dev-main diff-risk reconciliation) | amguzzi | 07-13→07-15 |
| 10 | **Vibe-scan cleanup train** | 8357629 (#292 key warning), 27d0c86 (#293 tier-1 fixes, incl. 2bea76f dead-code deletion), 6651a59 (#294) | MJ, HQ, Claude | 07-21 |

[FACT: all shas/PRs from git log origin/dev --first-parent --since=2026-06-18]

## 3. Branch discipline

**The rule is young.** "Never commit or push to dev or main directly" was added to CLAUDE.md by **5640b08 (amguzzi, 2026-07-13 15:08 ET)**, merged via PR #257 (96a4a62, 15:11 ET same day) [FACT: git log -S; commit timestamps]. Everything before that is context, not violation.

**Pre-rule direct activity (context):**
- Madhu: 8 direct commits to main 2026-05-07…05-18 (invite-email fixes, "trigger dev deployment") [FACT: main fp no-merges].
- 741f3f6: PR #190 squash-merged straight to main 07-06 [FACT].
- 07-12: four manual merge commits pushed to main with no PR — d8b2efc, 1d56e1e (Claude), 0de4d4f, 294be72 (HQ; duplicate subjects, consecutive merges of successive dev states — clumsy but not a rewrite) [FACT: parentage check]. The rule lands the very next day; [INFER: high — the 07-12 push chaos motivated #257].

**Post-rule violations (2026-07-13 15:11 ET onward):**
- **e753bdd** — direct commit to dev, Claude, 07-14 01:20 UTC ("Set hero band height to 80svh") [FACT: timestamp].
- **5377f4d** — direct commit to main, Claude, 07-14 ("dedicated social card for the field survey") [FACT].
- **9c7c5d8** — direct commit to main, Brendan Whitaker, 07-14 ("Add files via upload", GitHub web UI) [FACT].
- **Feature PRs based on main, not dev:** #266 (b191bc4, 07-14), #269 (22e8c28, 07-14, branch literally named `cherry-pick/prod-...`), **#287 (e33dee6, 07-21/22, base=main confirmed via API)** [FACT: main fp; PR #287 base.ref="main"]. #287's content then had to be re-landed on dev as #291 and finally reconciled by #297 `merge/sync-main-into-dev` — the measurable cost of skipping the dev-first flow [FACT: ca5fb40, 1fa0eb7].
- Same-day-as-rule but *before* 15:11 ET (not violations): amguzzi's 4 content/migration commits (12:29–12:58 ET), Claude's 3 hero commits (14:46–14:51 ET) [FACT: timestamps].
- Aftermath: #277/#280 ("dev-main diff-risk") on 07-15 merged a main+dev union back into dev — cleanup labor caused by the direct-to-main traffic [FACT: 699c474 subject].

## 4. Unmerged surface — every branch that still differs from main

124 topic branches on origin [FACT: for-each-ref count 127 incl. HEAD/main/dev]. Ahead-counts are shallow-poisoned for old branches (§0), so the authoritative metric below is **"remaining tree delta"**: `git diff origin/main <branch> -- <files-the-branch-touched>` — what applying the branch would actually change today.

### 4a. Genuinely unshipped, live (would still apply cleanly as content)

| Branch | Last commit | Remaining delta vs main | What it is / shipping risk |
|---|---|---|---|
| `claude/remove-build-cycle-sql-5ntk8k` | 24610cf, Claude, **07-22** | +270 (adds `scripts/ops/remove-from-current-cycle.sql`) | Ops SQL "remove four people from the current build cycle". Merge-safe (additive script) but **running it mutates live alpha participant data** — needs owner sign-off [FACT: name-status]. |
| `claude/code-quality-scan-plan-2kxfvz` | 3e37269, 07-15 | +437 (one doc) | **Open PR #286** (VIBE_SCAN audit, 38 findings, base=main). Docs-only, safe [FACT: PR #286]. |
| `docs/feedback-running-list` | d727c74, 07-13 | 1 file +118/−78 | **Open PR #243** (feedback item #12). Doc diverged from the #279-merged copy — merging needs manual reconcile [FACT: diff]. |
| `fix/availability-prefill` | c3da10f, 07-12 | small docs | **Open PR #244** (availability option-list doc reconcile 00082) [FACT: PR #244]. |
| `claude/survey-hero-orb-removal-mbgibl` | b87bcc0, 07-13 | 4 files +229/−173 | **Open PR #248** (survey landing redesign, removes orb, base=main). Conflicts with open PR #199 which *fixes* the orb — one of the two is dead [FACT: PRs #248/#199]. |
| `docs/comms-preview` | 42f5b37, **adm-2k**, 06-17 | 9 files +405, purely additive | The co-lead's own "core-team decision comms package". Never merged; no PR found [FACT: diff; UNVERIFIED: whether a PR ever existed]. |
| `docs-cleanup` | d8d4741, **adm-2k**, 06-18 | 13 files, −3,788 | **The co-lead's final commit** — archives 12 planning docs to a private docs-archive. **Shipping it now would delete `docs/poderator-dashboard/CLAUDE.md`, which root CLAUDE.md still references** [FACT: name-status; CLAUDE.md]. |
| `feat/entity-explorer-design` | 2af5633, Madhu, 06-03 | +978 (DESIGN.md + mockups.html), additive | Unshipped entity-explorer design docs; no PR found [FACT: diff]. |
| `docs/formation-diagram` | 79d988a, Madhu, 06-01 | 5 files +854, additive | **Oldest unshipped content in the repo** [FACT: diff]. |
| `claude/dev-prod-migration-plan-5pumez` | 8a967dd, 07-11 | +349 (one doc) | Prod-migration plan doc; likely partially obsolete post-cutover [INFER: med]. |
| `claude/olos-dev-pod-project-creation-uz3wez` | 6b204f1, 07-11 | **113 files, +13,863/−5,982** | The **docs-consolidation ghost** (adds `docs/EVOLUTION.md`, `docs/archive/*` — referenced by open issue #213) fused with pod/project-creation app work. **Shipping would be destructive**: it carries migrations numbered 00035–00039 (numbers long since taken; main is at 00091) and 6-week-old copies of dashboard/API files [FACT: name-status, migrations ls]. Only the docs/ part is salvageable, by cherry-pick. |

Plus open PRs #185 (Sensemaker brief) and #173 (pages-reorg requirements) — docs-only, heads on pre-cutover dev SHAs, mergeable as content [FACT: open-PR list]. **All 7 open PRs request adm-2k as reviewer** — this is literally the returning co-lead's review queue [FACT: requested_reviewers].

### 4b. Content fully landed elsewhere (squash-merged); branch is residue
`fix/dev-test-findings` (→ #300), `fix/vibe-scan-tier1` (→ #293/#294), `fix/cycle-config-project-min` (→ #294), `fix/funnel-zip-client-validation` (→ #289), `fix/slack-row-click-done` (→ #298), `merge/sync-main-into-dev` (→ #297), `bug-fixes` (1a255f3 patch-equivalent, landed via `feat/integrate-bug-fixes`), `requirements`, plus every 0-ahead branch (adm-2k's May/June `fix/*`, `110-phase-*`, `45-issue-*`, `feature/short-form-dashboard`, `feat/poderator-dashboard`, etc.) [FACT: git cherry + remaining-delta = none].

### 4c. Stale — superseded by main's later churn (shipping would REGRESS main)
- `claude/weekly-learning-log-questions-wvw91f` (HQ, 07-18): residual −408/+215 in `dashboard/page.tsx` + `log-health.ts` — would roll back the #265/#284 dashboard [FACT: diff].
- `claude/slack-join-todo-k3508k` (07-21): merged to main as #287; residual is an old dashboard page copy [FACT].
- `claude/mobile-dashboard-optimization-kh7ue0` (HQ, 07-18): residual −29 [FACT].
- `feat/cycle-schedule-stage1` (HQ, 07-13): PR #247 was merged into the WRONG base (see §5); content re-landed via #259; residual 13 files −920 = pre-re-land copies [FACT: PR #247 + diff].
- `fix/login-popup` (HQ, 07-12): 3 files +140/−181, predates the merged login-doors work — would likely regress it [INFER: high].
- `claude/problem-statement-editing-enmc9u` (MJ, 07-17): +4 lines residual; relates to feedback #13 (open) [FACT: diff].
- `fix/cycle-tabs-key-warning`, `claude/build-cycle-layout-rneaph`: small residuals, superseded [INFER: med].
- The **18-branch `claude/*` burst of 07-06/07** (`pod-project-pages-follow`, `mobile-cycle-banner-cards`, `survey-orb-fix`, `slack-integration-setup`, `sensemaker-brief`, `triangulator-sensemaker`, `events-card-redesign`, `survey-*`, etc.): local "ahead 88–123" is shallow-artifact; their line IS in main's ancestry (GitHub). Unique tip content is small and mostly merged/superseded via PRs #136–#160+ and the cutover; three still carry open PRs (#199, #185, #173) [FACT: GitHub list_commits; INFER: med for per-tip supersession].
- April fossils: `claude/improve-code-quality-vq5hO` (04-17), `claude/add-cycle-dummy-data-gmA6Y` (04-09), `claude/bulk-magic-link-invitations` (05-05, +39 residual, superseded by #70), `IssuesPush`, `schema-development` (merged — see §0) [FACT/INFER: med].

## 5. The revert-230 and #247 sagas

- **PR #230** (`fix/events-ui`, events-page UX fixes from July-11 testing feedback) merged into dev 07-12 19:39 UTC by brendanwhitaker [FACT: PR #230 API]. Hours later Brendan created **`revert-230-fix/events-ui`** with GitHub's auto-revert commit 103b398 (07-12 15:44 ET) [FACT: 103b398]. **No revert PR was ever opened or merged** — the only "revert"-titled PR in the repo is April's #35 [FACT: search_pull_requests]. The revert commit is in no mainline ref; **#230's changes are live in production**. A revert was contemplated and abandoned; why is not recorded in the repo [UNVERIFIED: motive].
- **PR #247** (Stage-1 calendar, migration 00085, D-10 registration gate) was stacked on #245 with an explicit "do not merge before #245" warning. It was nevertheless merged 07-13 **with base still `fix/lab-timezone-windows`** — a branch already merged and deleted-in-spirit — so its commits never reached dev [FACT: PR #247 base.ref]. Same day, **#259 "re-land #247 onto dev"** fixed it (0a4f62d), followed by the 00085→00086 renumber (#261) because 00085 had meanwhile been taken by the `service_role_admin_paths` renumber on main+dev [FACT: 7aab1bf subject]. A stacked-PR mis-merge with a two-step cleanup tail.

## 6. Red flags (commit-message archaeology)

- **4361f91** (adm-2k, 2026-05-31): "fix(ops): **temporarily** remove revocation-check cron schedule". Today `app/api/cron/revocation-check/` still exists but `vercel.json` has **no revocation-check cron entry** (5 crons: learning-log x2, leadership-log x2, sync-luma-events) — the "temporary" removal was **never restored** in 8 weeks [FACT: vercel.json; app/api/cron ls]. A 07-04 progress-audit commit (a46c529) lists "revocation cron" under *deferred infra*, so it is at least a known deferral [FACT: a46c529 message]. Flag for the co-lead: revocation enforcement is presumably not running on schedule [INFER: high — config absence; Lane E/D should confirm intended state].
- **24610cf** (07-22, unmerged): ops SQL to remove four people from the current build cycle — pending data surgery on live participants [FACT].
- **f4a0f07** (adm-2k, 05-21): "draft Energy-cycle non-owner reset SQL" — earlier precedent of ops-SQL-in-repo [FACT].
- **a7f6502** (HQ, 07-06): "dev migration-history repair (aliases 00030–00053 + timestamp reverts)" — migration ledger was manually repaired; Lane D territory [FACT].
- **No disabled tests found**: no `describe.skip/it.skip/test.skip/xit/xdescribe` anywhere in `app/`, `lib/`, `scripts/` [FACT: grep]. Candidates for "disabled rather than fixed": none surfaced; PR #230 body notes tests at 255 passing, #247 at 313 — count grew, not shrank [FACT: PR bodies].

## 7. Force-push archaeology

Reflog empty (fresh clone) [FACT]. My two graph-based rewrite hypotheses were **refuted** via GitHub API (§0). The odd duplicate merges 0de4d4f/294be72 are consecutive real merges, not rewrites [FACT: parentage]. Whether any force-push ever hit non-default branches: [UNVERIFIED — GitHub events API not queried; no read tool for it in this kit].

## 8. Bottom line: what is sitting unshipped, and what shipping it would break

1. **Nothing is waiting on dev** — dev==main since 07-22 [FACT: Phase 0]. The unshipped surface is 7 open PRs (all docs/UX-polish scale, all naming adm-2k as reviewer) + ~11 branches with real residual content (§4a).
2. **Safe to ship as-is:** docs/comms-preview (+405), feat/entity-explorer-design (+978), docs/formation-diagram (+854), PR #286, #244, #185, #173. All additive docs.
3. **Ship only with care:** docs-cleanup (breaks a live CLAUDE.md doc reference); claude/remove-build-cycle-sql (merge safe, execution touches live data); PR #248 vs #199 (mutually exclusive — pick one, close the other); docs/feedback-running-list (manual reconcile with the #279 copy).
4. **Do not ship; salvage by cherry-pick only:** claude/olos-dev-pod-project-creation-uz3wez — the docs/EVOLUTION.md consolidation (issue #213's missing referent) is trapped inside a branch whose migrations (00035–00039) and app files would collide with 6 weeks of main history.
5. **Everything else** (≈100 branches) is squash-landed residue or superseded work whose "ahead" counts are shallow-clone illusions; shipping any of the §4c set would *regress* merged July work, most acutely the dashboard (`dashboard/page.tsx` is the most-contended file in the repo).
6. **Oldest still-open line of work:** by content, `docs/formation-diagram` (Madhu, 2026-06-01); by open PR, **#173 pages-reorg requirements (2026-07-05)**; the oldest open *code* thread is the survey-orb dispute (#199, 07-07, vs #248). The co-lead's own last two commits (docs-cleanup 06-18, comms-preview 06-17) are themselves part of the unshipped surface.

## Gaps

- **Why the #230 revert was abandoned** — no PR, no issue, no commit explains it [UNVERIFIED].
- **Per-tip supersession of the 18-branch 07-06/07 `claude/*` burst** — verifying each tip against main needs per-branch file diffs or unshallowing; I verified the pattern (line is in main ancestry) but not all 18 tips [INFER: med].
- **Force-push history on non-default branches** — reflog empty; GitHub events API not available in the provided read-only toolset [UNVERIFIED].
- **Whether adm-2k's docs-cleanup/comms-preview were deliberately parked** (e.g. discussed off-repo) — no PR exists for either [UNVERIFIED].
- **Intended state of the revocation-check cron** — config says disabled since 05-31; whether an external scheduler replaced it is outside the repo [UNVERIFIED — flagged to Lanes D/E].
- Local ahead/behind table for pre-July branches is shallow-poisoned; exact counts would require an unshallowed fetch (a write to the clone, not performed) [FACT: constraint].
