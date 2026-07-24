# Lane C — Contributor ownership map (OLOS re-entry audit)

**Audit cutoff (LAST_ACTIVE_DATE):** 2026-06-18 — adm-2k's last commit [FACT: d8d4741920ef2d88c24a97d2a2333c0458aa9d19, "docs: archive completed-sprint & ideation docs", 2026-06-18].
**BASELINE:** `git rev-list -1 --before=2026-06-18T23:59:59-04:00 origin/dev` → [FACT: 1d3615f224fa55cefdcfd5c4d49ae7d60caf5768, authored by amguzzi, "docs(requirements): add redesign specs + sequenced implementation plan"].
**Note:** the orchestrator's `00-ORIENTATION.md` path resolved to "undefined" and the file does not exist anywhere on disk (searched /tmp/claude-0 and /home/user). I adopted the cutoff/baseline already derived and cross-checked by Lane B (`02-lane-issues.md`), then re-verified both against git myself.

**Methodology warning for anyone re-running these numbers:** in this repo, any pathspec-filtered `git log -- <path>` MUST use `--full-history`. The wholesale dev↔main merges (e.g. 1a6ef3b "take dev tree wholesale") make git's default history simplification silently drop everything before ~2026-07-08 for most paths [FACT: `git log origin/dev -- app/api` returns 42 commits, earliest 2026-07-08; with `--full-history` it returns 102, earliest 2026-04-10].

---

## 1. Identity map

| Git identity (email) | GitHub handle | Evidence |
|---|---|---|
| `Brendan Whitaker <205478375+brendanwhitaker@…>` (122 commits) | **brendanwhitaker** (id 205478375) | [FACT: matching numeric noreply id; PR #141/#150/etc. user.login] |
| `amguzzi <amg@dalmatianops.com>` (107) | **amguzzi** (id 265613286) | [FACT: PR #226/#229/#287 user.login + squash commits on main authored `amguzzi <amg@dalmatianops.com>` for PRs #287/#265] |
| `MJ` / `Madhu` / `/` `<mjalan@gmail.com>` (85 total: 57+23+5) | **inferno-gh** (id 240970629) | [FACT: PRs #289–#301 all authored by inferno-gh per API + cache, and their squash commits on main are authored `MJ <mjalan@gmail.com>` (e.g. #294 → main commit "Fix silently-dropped project_min… (#294)"); GitHub squash sets the PR author as commit author. Also merge commits of inferno-gh's PRs authored `MJ`] |
| `HQ <hq@theupskillinglabs.org>` (42) | **TheLabsHQ** (id 268728717) | [FACT: get_commit 294be722 → author.login TheLabsHQ] |
| `adm-2k <62628090+adm-2k@…>` (85) | **adm-2k** (id 62628090) | [FACT: get_commit d8d4741 → author.login adm-2k] |
| `Claude <noreply@anthropic.com>` (381) | agent commits — no human handle | see attribution method below |

TheLabsHQ reads as a shared org account (name "HQ", org-domain email, user's own login email is dev@theupskillinglabs.org); which human operates it is not determinable from git/GitHub data [INFER: med]. It first appears 2026-07-03 — *after* adm-2k left [FACT: `git log --all --author=hq@…` earliest 2026-07-03].

**"Claude" commit attribution method (stated explicitly):**
1. For each `Merge pull request #N` merge commit on origin/dev + origin/main, every commit in `merge^1..merge^2` is attributed to the **PR author** (the human who drove the session and opened the PR), using PR author data from the GitHub API (cached for all 163 PRs created since 2026-07-03; there were zero PRs created 2026-06-19→07-03 [FACT: Lane B search]).
2. GitHub **squash** merges already author the squashed commit as the PR author's git identity, so those self-attribute (this is also what proves MJ=inferno-gh).
3. Co-Authored-By trailers were checked and are nearly useless here: of 264 trailers on dev, 248 name a Claude model; only 13 name HQ, 3 amguzzi, 2 Brendan Whitaker, 1 adm-2k [FACT: trailer tally on origin/dev].
4. **Residue:** of 180 Claude-authored commits on dev since cutoff, 90 were attributed via PR merges (amguzzi 60, brendanwhitaker 28, inferno-gh 2) and **90 arrived by direct agent pushes/merges to dev with no PR** — e.g. df8e5b0b "owner lifecycle (Phases 1-3)", 6a705fdc "Lab Lead Phase 0+", 86f826bf "pod & project creation flow" (the wave issue #214 records as shipped with no tracking issue), 1a6ef3b/d8b2efc9 direct dev→main promotions. These commits carry `Claude-Session:` URLs but no human identity [FACT: e.g. 6a705fdc trailer block]; **their driver is unattributable from git alone** and they are counted as "AGENT-direct" everywhere below. [UNVERIFIED: which human drove each direct agent push]

---

## 2. Per-contributor profiles (activity since cutoff 2026-06-18, unless noted)

Commit counts are on origin/dev unless "all-branches". Lines exclude lockfiles/node_modules. "Active last 14 days" = any commit on any branch since 2026-07-10.

### brendanwhitaker
- Commits since cutoff: 10 authored + 17 merge-commits on dev; **91 all-branches**; +66,045/−1,123 lines on dev (large adds mostly squashed agent-session deliverables) [FACT: git log/numstat].
- Additionally drove ≥28 Claude-authored dev commits via his merged PRs since cutoff [FACT: merge-graph attribution]. 134 PRs authored all-time — the most of anyone (244 total exist) [FACT: search author:brendanwhitaker → 134].
- Range: 2026-04-08 → 2026-07-18. **Active in last 14 days: yes** (18 commits).
- Top dirs (authored, all-time dev): app/(dashboard) 167, app/api 142, supabase/migrations 70, (root) 36, app/components 32.
- Prose: operates almost entirely through Claude Code sessions (his PR bodies carry `claude.ai/code/session_…` links [FACT: PRs #141, #168, #178, #202, #215]). Since cutoff his fingerprints are on: the contributor-onboarding layer (README/CONTRIBUTING/ARCHITECTURE/CODEOWNERS/issue+PR templates, PR #178), the admin-panel consolidation into a shell+4 sections (PR #202), publishing/legal prep (unified privacy policy + apex domain PR #210 [FACT: f2f39aa], Google-OAuth consent links PR #215), the mobile feed-first dashboard (PR #284 [FACT: aa822f9]), and the governance/tracker work — the July 5–7 "tracker reconciliation" sweep, the July-11 audit closures, filing the only open p1s #212/#213 and the retroactive record issue #214 [FACT: Lane B, issue authorship].

### amguzzi
- Commits since cutoff: 45 authored + 44 merge-commits on dev; 99 all-branches — **all 99 fall in 2026-07-10 → 2026-07-21**; +4,327/−604 authored lines [FACT].
- Drove ≥60 Claude-authored dev commits via merged PRs since cutoff — the largest agent-driver by PR volume on dev [FACT: merge-graph]. 55 PRs all-time, 48 merged since cutoff [FACT: search + cache].
- Range: 2026-04-07 → 2026-07-21. **Active in last 14 days: yes** (99 commits).
- Top dirs: app/(dashboard) 71, lib/validations 14, app/api 11, supabase/migrations 10, docs 10.
- Prose: authored the June-17 requirements re-baseline that is the BASELINE commit itself [FACT: 1d3615f] and landed it as PR #231. Since 07-10: the field-survey feature line (share links #270, cycle links #271/#272, data backpopulation #283), Weekly Learning Log v2 (#265 [FACT: 115815e]), cycle-registration copy fixes (#226), the profile/directory batch incl. migration 00078 (#229), the docs/feedback-running-list process (#237/#239/#241/#279), and the Slack invite link (#287 — filed via the Claude GitHub App [FACT: #287 performed_via_github_app]). Also the busiest merger on dev (44 merge commits since cutoff).

### inferno-gh (git: MJ / Madhu / "/")
- Commits since cutoff: 11 authored + 2 merges on dev (21 all-branches); +1,712/−369; but 68 dev commits all-time — most of the moderator work predates the cutoff [FACT].
- 20 PRs all-time; 16 merged since cutoff, **all 16 self-merged** [FACT: sample below]. Range: 2026-05-04 → 2026-07-22(-23 UTC, PR #300/#301). **Active in last 14 days: yes.**
- Top dirs (all-time): app/(dashboard) 93, app/api 32, **lib/moderator 18**, lib/validations 15, supabase/migrations 14.
- Prose: pre-cutoff, built the Poderator (moderator) dashboard area (lib/moderator is essentially his directory). Since cutoff he has become the **release manager**: every dev→main promotion PR since 2026-07-16 is his (#296/#297/#299/#301 [FACT: merge commits authored MJ + PR authorship]), plus the ZIP-validation fix #289, the vibe-scan Tier-1 fix train #291–#294 (landing HQ-authored branch commits), the Slack advisory-row fixes #295/#298, the Stage-1 calendar re-land #259, and migration renumber #261. Notably he is **not in CODEOWNERS** [FACT: .github/CODEOWNERS = `* @brendanwhitaker @adm-2k @amguzzi`].

### TheLabsHQ ("HQ")
- First commit 2026-07-03 (post-departure identity). 42 commits all-branches; only **5 ever reached dev** (+201 lines: 2 docs/legal files + 1 migration); 36 commits since 07-10 sit on feature branches [FACT].
- 0 PRs authored [FACT: search author:TheLabsHQ → 0]. **Active in last 14 days: yes.**
- Prose: works in two modes: (a) **direct merges of dev→main with no PR** on 2026-07-12 (294be722, 0de4d4f — "login doors" launch push) [FACT], contravening the repo's own no-direct-push rule (CLAUDE.md; docs/no-direct-dev-main-rule PR #257 landed 07-13, i.e. the rule was written the day after); (b) authoring fix commits on branches that inferno-gh then lands as his PRs — the entire 07-21 vibe-scan series (a5456f9, 6861d55, b608b0c… → PRs #291–#294) and parts of weekly-log v2 / mobile-dashboard branches [FACT: branch commits authored HQ; PRs authored inferno-gh].

### adm-2k — the pre-departure baseline (what has been drifting)
- All-time: 85 commits all-branches (2026-04-08 → 2026-06-18); 81 on dev (48 self-committed, 33 landed via GitHub web merges); +8,877/−806 on dev across 80 files; 35 PRs [FACT: search author:adm-2k → 35]. **Active in last 14 days: no — zero commits anywhere since 2026-06-18.**
- Top dirs: app/api 24, app/(dashboard) 18, docs 17, supabase/migrations 12, (root) 12.
- What they owned (from commit subjects + issues):
  1. **The #110 onboarding/enrollment state machine, phases A–C** — enrollment reconciler + RLS hardening (Phase A), profile-edit + placeholder-name guards + admin pod-membership/name-edit routes (Phase B.1–B.8), migration 00030 + **two-stage revocation cron + warning email** (Phase C) [FACT: commit series "feat(#110 Phase …)" 2026-05-31→06-03; self-merged as PRs #111/#116/#124].
  2. **Ops & data-migration scripts** — bulk magic-link invites, sheets→postgres cohort migration (scripts/migration/migrate.py, W1-004), legacy column mapping, option_lists seeding [FACT: commits 2026-05-05→05-19].
  3. **Email/Resend configuration** (#45 verification, sender alignment) [FACT: 2026-05-08/09 commits].
  4. **Migration numbering + prod-apply discipline** (renumber 00016→00018; filed #77 auto-apply-migrations, #115, #125) and the dev→main promotion ritual (self-merged promotes #126–#131 on 2026-06-03/04) [FACT: merge commits].
  5. **Repo reference docs**: SCHEMA.md, supabase/CLAUDE.md, lib/auth/CLAUDE.md, docs/OLOS-roadmap.md (their single most-touched file, 9 revisions).
- **Final acts never merged**: the core-team decision comms package (branch `origin/docs/comms-preview`, 2026-06-17) and the docs-archive sweep (branch `origins/docs-cleanup`, 2026-06-18) — the latter is why root CLAUDE.md still points at `docs/poderator-dashboard/CLAUDE.md`, which that commit intended to remove [FACT: d8d4741 message vs current CLAUDE.md; branch containment checked].
- **Who absorbed what:**
  - dev→main promotion → **inferno-gh** (PRs #296–#301) plus unattributed direct agent/HQ merges [FACT].
  - Migration numbering → **amguzzi** (most human migration commits since cutoff: 8 authored / 12 driven) + inferno-gh (renumber #261); but the *prod-apply* half was absorbed by no one — scripts/ops/{dev,prod}-migration-repair-2026-07-06.sql exist because prod drifted by up to 11 migrations [FACT: files; Lane B #110 comment], and #77 is untouched since 2026-05-20.
  - Roadmap → superseded by **amguzzi**'s requirements re-baseline (PR #231 replaced roadmap-driven planning) [FACT: 65ae661].
  - Email/Resend → **amguzzi** (registration email #287, weekly-log emails #265) + agent sessions (leadership-log cascade crons, da749a4).
  - **Not absorbed:** the revocation machinery — adm-2k removed the revocation-check cron schedule "temporarily" on 2026-05-31 [FACT: commit "fix(ops): temporarily remove revocation-check cron schedule"], and today's vercel.json has crons for learning-log/leadership-log/luma but **no revocation-check** [FACT: vercel.json]; open p1 #213 is exactly this, unassigned. The ops scripts (bulk invite, migrate.py) also have no post-departure human touches [FACT: scripts/ log].

---

## 3. Review graph (sample: 36 merged PRs since cutoff — all 16 inferno-gh + 10 brendanwhitaker + 10 amguzzi, via pull_request_read get + get_reviews)

**Headline: there are zero formal GitHub reviews on the entire repository — ever.** All 36 sampled PRs returned an empty review list, and `reviewed-by:` searches for all five handles return 0 across all 244 PRs [FACT: get_reviews ×36; search reviewed-by:{amguzzi, brendanwhitaker, inferno-gh, adm-2k, TheLabsHQ} → 0 each].

| Author | PRs sampled | Self-merged | Merged by someone else | Reviews |
|---|---|---|---|---|
| inferno-gh | 16 | 16 | 0 | 0 |
| brendanwhitaker | 10 | 10 | 0 | 0 |
| amguzzi | 10 | 8 | 2 (#226, #229 → merged by inferno-gh) | 0 |

Corroborating full population (59 `Merge pull request` commits on dev since cutoff, author↔merger from git + PR cache): amguzzi→amguzzi 40, brendanwhitaker→brendanwhitaker 15, inferno-gh→self 2, cross-merges 2 (one each way between amguzzi and brendanwhitaker) — **~97% self-merge** [FACT: merge-commit tally].

Everyone is "never reviewed." What substitutes for review: (a) PR-body verification checklists + "Manual testing" sections (template hardened 2026-07-15 [FACT: commit "PR template: require manual-testing instructions…"]); (b) agent-on-agent evaluation PRs (PR #233 `claude/pr-231-evaluation` reviewing PR #231's content [FACT: merge 65ae661/a54eed2]); (c) after-the-fact audits (vibe-scan docs/audit/VIBE_SCAN_2026-07.md via PR #286 → fix train #291–#294). Meanwhile CODEOWNERS still auto-routes review requests to **adm-2k** on every PR — all 16 July inferno-gh PRs list adm-2k as a requested reviewer who can never respond [FACT: requested_reviewers on #242…#300; CODEOWNERS].

---

## 4. Bus-factor table

"Drivers since cutoff" = human PR authors credited with their agents' commits; AGENT-direct = commits with no attributable human. Counts from `--full-history` on origin/dev.

| Subsystem | Primary owner | Secondary | Bus | AGENT-direct share since cutoff | Last touched (dev) |
|---|---|---|---|---|---|
| app/api (routes) | amguzzi (15) | brendanwhitaker (13) | **2** | 34/67 commits | b1abda1 2026-07-22 |
| app/(dashboard) UI | amguzzi (37) | brendanwhitaker (20), inferno-gh (7) | 2–3 | 48/112 | b1abda1 2026-07-22 |
| app/(public)+(survey) | amguzzi (11) | brendanwhitaker (6) | 2 | 11/29 | e5c8ad7 2026-07-16 |
| lib/auth | brendanwhitaker (8) | inferno-gh (2), amguzzi (2) | **1 ⚠** | 14/26 | 845c26d 2026-07-22 |
| lib/ (other server logic) | amguzzi (17) | brendanwhitaker (13) | 2 | 31/65 | b1abda1 2026-07-22 |
| supabase/migrations | amguzzi (12) | brendanwhitaker (7) | **1–2 ⚠⚠** (prod-apply: 1) | 19/41 | 845c26d 2026-07-22 |
| scripts/ (ops+migration) | brendanwhitaker (5) | — (was adm-2k) | **1 ⚠** | 7/12 | 0de4d4f 2026-07-12 |
| docs/ | amguzzi (24) | brendanwhitaker (9) | 2 | 10/45 | 845c26d 2026-07-22 |
| integrations (lib/email + lib/integrations/luma + lib/llm) | brendanwhitaker (5) | amguzzi (2), inferno-gh (1) | **1 ⚠** | 6/14 | a9cc2ad 2026-07-21 |
| .github / CI | brendanwhitaker (4) | amguzzi (1) | **1 ⚠** | 4/9 | e5c8ad7 2026-07-16 |
| dev→main release path (process, not dir) | inferno-gh (PRs #296–#301) | HQ + direct agent merges | **1 ⚠⚠** | 4 of the since-cutoff dev↔main merges are Claude-direct or HQ-direct [FACT: 845c26d, 1d56e1e8, d8b2efc9, 1a6ef3b, 294be722, 0de4d4f] | b128cf2 2026-07-22 |

Integration code locations, for the record: Resend → lib/email/ (index.ts + templates); Luma → lib/integrations/luma.ts + app/api/cron/sync-luma-events (cron every 6h in vercel.json); Anthropic SDK → lib/llm/names.ts; Slack → not yet an integration, only invite-link config (#189 pending) [FACT: grep + vercel.json].

Bus-factor-1 flags: **lib/auth** (whose reference doc, lib/auth/CLAUDE.md, was adm-2k's), **scripts/** (adm-2k's Python migrate.py has had zero human touches since departure), **integrations**, **.github/CI**, and — the two compounding ones — **migrations prod-apply** and the **release path**.

---

## 5. Three highest bus-factor risks + de-risking (for a 2–4 person volunteer team)

1. **Migrations prod-apply + numbering (bus ≈1, and it already failed once).** Prod drifted up to 11 migrations behind and needed hand-written repair SQL on 2026-07-06 [FACT: scripts/ops/*-migration-repair-2026-07-06.sql; #110 comment]; three renumber collisions since (#261, 00089→00090, 00090→00091 [FACT: commits 566540e5, a2adb7a]); the designed fix #77 has been open untouched since 2026-05-20. **De-risk:** ship #77 (CI step that applies supabase/migrations on merge to dev/main — a day of work); until then, add a written prod-apply runbook to CONTRIBUTING and have amguzzi + inferno-gh each perform one supervised prod apply so two humans have done it.
2. **The release path (dev→main) replaced one bus-factor-1 human with another, plus untracked direct merges.** adm-2k's promote ritual passed to inferno-gh (all promotes since 07-16), with HQ and headless agent sessions also merging straight to main (07-11/07-12) [FACT: merge list above]. **De-risk:** turn on branch protection for main+dev (blocks the direct-merge mode entirely; the team already wrote the rule in PR #257 — it's just unenforced), add inferno-gh to CODEOWNERS and remove adm-2k (review requests currently route to someone who cannot respond), and write the 1-page promote checklist (currently oral tradition + PR #219/#280 bodies).
3. **adm-2k's enrollment/revocation machinery is ownerless.** The reconciler, admin membership routes, and the two-stage revocation cron were single-authored, their cron schedule was removed "temporarily" on 2026-05-31 and never restored [FACT: vercel.json has no revocation-check], and the only tracking is unassigned p1 #213. **De-risk:** the returning co-lead should re-adopt this area explicitly (it is adm-2k's old surface, smallest ramp-up for whoever reads #110's phase commits); concretely: assign #212/#213 to a named person, restore the cron schedule behind a dry-run flag, and capture the reconciler's design in a half-page of docs (its only documentation is commit messages).

Not a performance review: all statements above describe contribution *patterns* (what shipped, where, via which mechanism), not the quality or competence of any person's work.

---

## Gaps

- **Drivers of the 90 direct agent pushes to dev since cutoff** (50% of all Claude commits on dev): commits carry only `Claude-Session:` URLs; no git- or API-visible human identity. Issue #214 attributes one wave narratively; the rest are [UNVERIFIED].
- **Who operates TheLabsHQ** (and whether it is one human or several): [INFER: med] shared org account; not determinable read-only.
- **Pre-cutoff review graph** (PRs #1–#131): PR-author cache starts at #132; I verified zero reviews repo-wide via search, and adm-2k's self-merged promotes via git, but did not build a full pre-cutoff author↔merger pair table.
- **~130 unmerged origin branches**: per-contributor stats here cover origin/dev (+main) plus all-branch commit counts; per-branch ownership of unmerged work is Lane-scope for the branches lane. Notable for this lane: adm-2k's two unmerged final branches (docs/comms-preview, docs-cleanup).
- **Lines-changed for squash-landed agent work** is attributed to the human PR author by construction (GitHub squash authorship); per-human "hand-written vs agent-written" line splits are not recoverable.
- Orientation file (00-ORIENTATION.md) did not exist; corrections that would have lived there are noted inline and in my structured return.
