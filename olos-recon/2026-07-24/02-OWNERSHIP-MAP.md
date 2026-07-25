# 02 — Ownership Map

*Who owns what now, where the bus factor is 1, and what would de-risk it. Contribution patterns only — nothing here evaluates anyone's competence. Full method (identity mapping, agent-commit attribution, `--full-history` caveat) in `03-lane-people.md`.*

## Identity key

| Git identity | GitHub | Notes |
|---|---|---|
| Brendan Whitaker | `brendanwhitaker` | Works almost entirely through Claude Code sessions [FACT: PR session links] |
| amguzzi | `amguzzi` | Also files PRs via the Claude GitHub App [FACT: #287] |
| MJ / Madhu / "/" (mjalan@gmail.com) | `inferno-gh` | Proven via squash authorship on #289–#301 [FACT] |
| HQ (hq@theupskillinglabs.org) | `TheLabsHQ` | **Shared org account**, first commit 07-03 (post-departure); operator unknown [INFER: med] |
| adm-2k | `adm-2k` | The returning co-lead; zero commits since 06-18 |
| Claude (noreply@anthropic.com) | — | 180 dev commits since cutoff: 90 attributed via PRs (amguzzi 60, brendanwhitaker 28, inferno-gh 2), **90 direct pushes with no attributable human** [FACT: merge-graph] |

## Subsystem → owner table

Bus = number of humans who could maintain it today. ⚠ = single human. "AGENT" column = share of since-cutoff commits with no attributable human driver.

| Subsystem | Primary | Secondary | Bus | AGENT-direct | Last touched |
|---|---|---|---|---|---|
| app/api (118 routes) | amguzzi | brendanwhitaker | 2 | 34/67 | 07-22 b1abda1 |
| app/(dashboard) UI | amguzzi | brendanwhitaker, inferno-gh | 2–3 | 48/112 | 07-22 |
| app/(public) + survey | amguzzi | brendanwhitaker | 2 | 11/29 | 07-16 |
| lib/auth | brendanwhitaker | thin (2 commits each: inferno-gh, amguzzi) | **1 ⚠** | 14/26 | 07-22 |
| lib/ other server logic | amguzzi | brendanwhitaker | 2 | 31/65 | 07-22 |
| supabase/migrations (authoring) | amguzzi | brendanwhitaker | 2 | 19/41 | 07-22 |
| **migrations → prod apply** (process) | **nobody** (was adm-2k) | — | **0–1 ⚠⚠** | — | repair SQL 07-06 |
| scripts/ (ops + migration ETL) | brendanwhitaker (light) | — (was adm-2k; `migrate.py` untouched since departure) | **1 ⚠** | 7/12 | 07-12 |
| Integrations (lib/email, lib/integrations/luma, lib/llm) | brendanwhitaker | — | **1 ⚠** | 6/14 | 07-21 |
| .github / CI | brendanwhitaker | — | **1 ⚠** | 4/9 | 07-16 |
| **dev→main release path** (process) | inferno-gh (all promotes since 07-16) | HQ + AGENT-direct merges | **1 ⚠⚠** | 4 direct promote merges | 07-22 |
| Revocation/enrollment machinery (#110 reconciler, warn→revoke cron) | **nobody** (was adm-2k) | — | **0 ⚠⚠** | route rewritten by AGENT | unscheduled since 05-31 |
| docs/ | amguzzi | brendanwhitaker | 2 | 10/45 | 07-22 |

[FACT: all counts `03-lane-people.md` §4, `--full-history` on origin/dev]

## Who has been carrying what

**brendanwhitaker** — the platform-and-governance axis. Since the cutoff: contributor onboarding layer (README/CONTRIBUTING/ARCHITECTURE/templates/CODEOWNERS, #178), CI bootstrap era, admin-panel consolidation (#202), legal/publishing (privacy policy, apex domain #210, OAuth consent #215), mobile feed-first dashboard (#284), and all three tracker-reconciliation waves including filing the only open p1s (#212, #213) and the confessional #214. 94 of 163 post-cutoff PRs. Also the author of this morning's PR #302 [FACT: 03-lane-people §2; 08-DELTA].

**amguzzi** — the product-feature axis and busiest merger (44 merge commits since cutoff). The June-17 requirements re-baseline (which replaced roadmap-driven planning), field surveys (#270–#272, #283), Weekly Learning Log v2 (#265), registration/copy train, profile/directory batch (00078→00082), the feedback-list process, the PR-only rule itself (#257), and the Slack invite work (#287 — the one that went to main by mistake and cost a three-PR cleanup) [FACT: 03-lane-people §2].

**inferno-gh (MJ)** — pre-cutoff, built the moderator/poderator area (`lib/moderator` is essentially his). Post-cutoff he became **the release manager**: every dev→main promotion since 07-16, the #247 re-land + migration renumber, the vibe-scan fix train (landing HQ's commits), ZIP/Slack fixes. All 16 of his post-cutoff PRs were self-merged. He is not in CODEOWNERS [FACT: 03-lane-people §2].

**TheLabsHQ (shared account)** — two modes: direct no-PR merges to main during the 07-12 launch push (the chaos that provoked the PR-only rule), and authoring fix commits on branches that inferno-gh then lands (vibe-scan series, weekly-log v2, mobile dashboard). 0 PRs authored. Who is behind it is unknown [FACT/INFER: 03-lane-people §2].

**adm-2k (you)** — pre-departure surface, for re-orientation: the #110 onboarding/enrollment state machine (reconciler, admin membership routes, two-stage revocation cron + migration 00030), ops/data-migration scripts (`migrate.py`, bulk invites, option-list seeding), Resend configuration, migration numbering + the prod-apply ritual, and the reference docs (SCHEMA.md, supabase/CLAUDE.md, lib/auth/CLAUDE.md, roadmap). Your last two branches (`docs/comms-preview`, `docs-cleanup`) never merged [FACT: 03-lane-people §2].

**Absorption map:** release path → inferno-gh; migration *authoring* → amguzzi; roadmap → amguzzi's requirements re-baseline; email → amguzzi + agent sessions. **Never absorbed: prod-apply discipline, the revocation machinery, ops scripts** — all three failed visibly in July (prod 11 behind on 07-06 → reset on 07-11; cron dark since 05-31; scripts untouched) [FACT: 03-lane-people §2].

## Review graph

There is none to draw: **zero formal reviews on all 244 PRs ever**; ~97% self-merge (verified sample n=36: inferno-gh 16/16 self-merged, brendanwhitaker 10/10, amguzzi 8/10 — the 2 cross-merges were merges, not reviews). Substitutes: PR-body self-verification, agent-evaluation PRs (#233 reviewing #231), after-the-fact audits (VIBE_SCAN → #291–#294). CODEOWNERS auto-requests you on every PR [FACT: 03-lane-people §3].

## The three highest bus-factor risks, and what would de-risk each

1. **Migrations prod-apply (bus ≈0–1; already failed).** Prod drifted 11 behind → hand-repair SQL → full reset on 07-11; 00078–00091 application state unrecorded; #77 (auto-apply in CI) designed since 05-20, untouched. **De-risk:** ship #77 (a day of work); until then write the prod-apply runbook into CONTRIBUTING and have amguzzi + inferno-gh each perform one supervised apply so two humans have done it [FACT: 03-lane-people §5].
2. **Release path (bus 1, plus unaccountable direct merges).** Your promote ritual passed to inferno-gh, with HQ and headless agent sessions also merging to main. **De-risk:** enable branch protection on `main`+`dev` (the rule already exists on paper — #257; protection makes it real), fix CODEOWNERS (add inferno-gh, remove or annotate you until you're back reviewing), write the 1-page promote checklist currently living in PR #219/#280 bodies [FACT: 07-lane-ops §5].
3. **Revocation/enrollment machinery (bus 0 — your orphan).** Single-authored by you, cron unscheduled since 05-31, rewritten by an agent in your absence, tracked only by unassigned p1 #213. **De-risk:** you re-adopt it explicitly — it is the smallest-ramp, highest-leverage re-entry point since the code lineage is yours; assign #212/#213 to named people, re-enable the cron behind a dry-run flag, write the half-page reconciler design note that currently exists only in commit messages [FACT: 03-lane-people §5].

Secondary flags: lib/auth (bus 1 — and its reference doc was yours), integrations (bus 1), CI (bus 1), and the anonymous half of the July wave (90 AGENT-direct commits, ghost branch included) whose context holder is unidentified — see `00-CATCHUP-BRIEF.md` "what to ask."
