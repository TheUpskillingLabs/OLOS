# Lane F — Documentation and decision state (OLOS re-entry audit)

**Audit cutoff (LAST_ACTIVE_DATE): 2026-06-18** — adm-2k's last commit [FACT: d8d4741, per Lane B/D verification].
**BASELINE (prescribed formula):** `git rev-list -1 --before=2026-06-18T23:59:59-04:00 origin/dev` → [FACT: 1d3615f224fa55cefdcfd5c4d49ae7d60caf5768]. Caveat inherited from Lane D: 1d3615f is a long-lived docs side-branch commit; the mainline tip at cutoff is a164dff.
**Orientation note:** the tasked `00-ORIENTATION.md` resolved to path "undefined" and does not exist anywhere on disk [FACT: filesystem search]. Proceeded on independently verified facts plus the two sibling lane files already in the audit directory.

**Bottom line:** the doc set was rebuilt almost entirely in the co-lead's absence (58 of 314 dev commits since cutoff touch docs), but the three most load-bearing "current state" artifacts are each broken in a different way: the roadmap's §6 tracker is a frozen, partially wrong historical record whose replacement (`docs/audit/`) is itself a 2026-07-04 snapshot; two open p1 issues cite docs that exist only on an unmerged branch; and SCHEMA.md — updated as recently as 07-18 — has **zero coverage of the consent/erasure/email-audit tables** (00055/00057/00058) that matter most in a live alpha with real participant data.

---

## Freshness

Method: `git log -1 --format="%h %ad" -- <file>` on the checked-out tree (origin/dev == origin/main as of 2026-07-22 per Phase 0). All dates 2026. Files last touched **on or before 2026-06-18 have not changed since the co-lead left** (marked ◄).

### Root docs

| File | Last commit | Date |
|---|---|---|
| README.md | a5942ea | 07-08 — real front door now, not boilerplate [FACT: file head] |
| CLAUDE.md | 5640b08 | 07-13 |
| AGENTS.md | 1aac4dc | 04-10 ◄ |
| SCHEMA.md | 115815e | 07-18 (PR #265) — **but see consent-table gap below** |
| DESIGN_SYSTEM.md | a95a56c | 07-03 (reskin commit — "retire the legacy dark theme") |
| CONTRIBUTING.md | a5942ea | 07-08 |
| TUL_MVP_Spec.md | a5942ea | 07-08 — historical banner added July 2026 [FACT: file head; metadata-only read per instructions] |

### CLAUDE.md subdocs

| File | Last commit | Date |
|---|---|---|
| lib/auth/CLAUDE.md | 27d0c86 | 07-21 (#293 vibe-scan tier-1) |
| supabase/CLAUDE.md | a235321 | 07-13 (renumber-history entry) |
| docs/poderator-dashboard/CLAUDE.md | 21a35b3 | 06-01 ◄ **stale — predates the entire moderator-dashboard rebuild wave** |
| scripts/migration/CLAUDE.md | eb535f4 | 05-06 ◄ |
| scripts/ops/CLAUDE.md | f2f39aa | 07-09 |

### docs/ (recursive; marketing-site blog/pages collapsed — all a5942ea 07-08 except pages/privacy-policy.md f2f39aa 07-09)

| File | Last commit | Date |
|---|---|---|
| docs/ARCHITECTURE.md | a5942ea | 07-08 (created in the July wave — distinct from the ghost branch's ARCHITECTURE.md, see Ghost branch) |
| docs/AUTH_UNIFICATION_RUNBOOK.md | a5942ea | 07-08 — status header likely stale post-cutover, see ADR-5 |
| docs/LOCAL_LABS.md | a5942ea | 07-08 |
| docs/OLOS-architecture-brief.md | a5942ea | 07-08 (bannered historical) |
| docs/OLOS-roadmap.md | a5942ea | 07-08 — see Roadmap audit |
| docs/ORG_CYCLES.md | a5942ea | 07-08 |
| docs/ORTELIUS_KNOWLEDGE_GRAPH.md | a5942ea | 07-08 |
| docs/ORTELIUS_NORTHSTAR.md | a5942ea | 07-08 |
| docs/PR-feedback-widget.md | 092ef8c | 06-03 ◄ |
| docs/PRD-admin-org-separation.md | a5942ea | 07-08 |
| docs/PRD-lab-lead-ux.md | 8495875 | 07-11 |
| docs/PRD-login-and-cycle-onboarding.md | f2f39aa | 07-09 |
| docs/PRD-moderator-dashboard{.md,-mockups.html} | 21a35b3 | 06-01 ◄ |
| docs/PROTO_TRANSLATION_PLAN.md | a5942ea | 07-08 |
| docs/SECTOR_MODEL.md | a5942ea | 07-08 |
| docs/SENSEMAKING_FLOW.md | a5942ea | 07-08 |
| docs/agent-teams.md | a5942ea | 07-08 |
| docs/architecture-review-onboarding-state-machine.md | 8c022e4 | 05-31 ◄ |
| docs/audit/DATA_ARCHITECTURE.md | a5942ea | 07-08 |
| docs/audit/DESIGN_INTENT.md | a5942ea | 07-08 |
| docs/audit/GAP_AUDIT.md | 27d0c86 | 07-21 |
| docs/audit/IMPROVEMENT_ROADMAP.md | a5942ea | 07-08 |
| docs/audit/PROGRESS.md | a5942ea | 07-08 (self-dated snapshot 2026-07-05 "through PR #157/#161") |
| docs/audit/SOCIAL_LAYER_ANALYSIS.md | a5942ea | 07-08 |
| docs/branch-vs-main-2026-05-08.md | 8a0ef4f | 05-08 ◄ |
| docs/consolidated-issue-draft-onboarding-state-machine.md | 8c022e4 | 05-31 ◄ |
| docs/dev-report-cycle-process.md | a0c0061 | 07-09 |
| docs/environments.md | f2f39aa | 07-09 — **predates the 07-11 prod reset it should describe** |
| docs/feedback-running-list.md | a516b42 | 07-15 |
| docs/issue-44-verification-2026-05-08.md | 8a0ef4f | 05-08 ◄ |
| docs/launch-plan-2026-05-31.md | 03fce13 | 05-31 ◄ |
| docs/legal/{CODE_OF_CONDUCT,PRIVACY_POLICY}.md | f2f39aa | 07-09 |
| docs/legal/TERMS_OF_SERVICE.md | a5942ea | 07-08 |
| docs/marketing-site/** (18 files) | a5942ea | 07-08 |
| docs/personas.md | b783aac | 05-20 ◄ |
| docs/requirements/{cycle-timeline,cycle3-testing-plan,implementation-plan,pod-registration}.md | 117bb06 | 07-12 |
| docs/requirements/{local-labs,per-lab-configuration,permissions-redesign}.md | 0b8a4c7 | 07-12 |
| docs/requirements/pr231-evaluation.md | 0968d93 | 07-12 |
| docs/superpowers/specs/2026-05-22-poderator-dashboard-design.md | 21a35b3 | 06-01 ◄ |
| docs/testing-feedback-2026-07-11.md | 04d13af | 07-12 |
| docs/testing-plan-cycle-uat.md | a0c0061 | 07-09 |

**Freshness headline — SCHEMA.md silent on the privacy/consent layer.** SCHEMA.md (07-18) contains **zero mentions** of `agreement_acceptances` (00055), `email_log` (00057), or `participant_erasures` (00058) [FACT: `grep -c` = 0 for all three in SCHEMA.md], and **no file anywhere in docs/ mentions them either** [FACT: repo-wide grep]. Every other major new subsystem (follows, spotlights, learning_logs, sectors, labs, field_surveys, baseline_responses, cycle_phases, owner_actions) is covered. The tables exist in the migration chain [FACT: supabase/migrations/00055_agreement_acceptances.sql, 00057_email_log.sql, 00058_admin_owner_delete_erasure.sql — filenames per chain listing]. For a live-alpha system holding real participant data, the consent/erasure ledger being the *one* undocumented subsystem is the single highest-value doc fix.

---

## Drift ratio

Method: commits on `origin/dev` since 2026-06-19 touching subsystem code paths vs commits touching that subsystem's docs in the same window (`git rev-list --count origin/dev --since=2026-06-19 -- <paths>`). Counts include agent squash commits — treat as relative signal, not absolute effort. Total: 314 dev commits since cutoff; 58 touched docs/ or *.md [FACT: rev-list counts].

| Rank | Subsystem | Code paths | Code | Doc paths | Docs | Ratio | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | Admin console | app/(dashboard)/admin, app/api/admin | 30 | PRD-admin-org-separation.md | 1 | 30:1 | **Top debt.** PR #202 rebuilt the panel into "shell + 4 sections" [FACT: PR title, merged 07-07]; only doc is a PRD, no as-built doc |
| 2 | Moderator/poderator | app/(dashboard)/moderator, lib/moderator, app/api/moderator | 9 | docs/poderator-dashboard/, PRD-moderator-dashboard.md | **0** | ∞ | **docs/poderator-dashboard/CLAUDE.md frozen at 06-01** while the health model was repointed from pulse to learning logs (lib/moderator/log-health.ts) |
| 3 | Learning/leadership logs | lib/learning-logs, lib/leadership-logs, app/(dashboard)/learning, api routes | 8 | (no dedicated doc) | **0** | ∞ | Whole subsystem born after cutoff (00040→00091); design intent lives only in docs/audit/ snapshots + SCHEMA.md |
| 4 | Public site/CMS | app/(public), lib/pages, lib/content, app/api/content | 22 | docs/marketing-site/ | 2 | 11:1 | Marketing content docs are the *source* content, not architecture docs |
| 5 | Design system | app/globals.css, app/components/ui, lib/ui | 20 | DESIGN_SYSTEM.md | 2 | 10:1 | DESIGN_SYSTEM.md rewritten at reskin (07-03), little since |
| 6 | Auth | lib/auth, app/api/auth, app/(auth), app/@authmodal | 22 | lib/auth/CLAUDE.md, AUTH_UNIFICATION_RUNBOOK.md | 3 | 7.3:1 | Best-maintained CLAUDE.md (07-21) but runbook status stale (ADR-5) |
| 7 | Social layer | lib/follows, lib/updates, lib/announcements, app/(dashboard)/network, api routes | 7 | docs/audit/SOCIAL_LAYER_ANALYSIS.md | 1 | 7:1 | Analysis predates the shipped 00070–00077 implementation |
| 8 | Cycles/registration | lib/cycle*, lib/enrollment, app/(dashboard)/cycles, app/api/cycles | 33 | ORG_CYCLES.md, requirements/{cycle-timeline,pod-registration}.md | 5 | 6.6:1 | High absolute churn; docs are 07-12 requirements, code kept moving through 07-22 |
| 9 | Surveys/sensemaking | app/(survey), lib/survey*, api | 6 | SENSEMAKING_FLOW.md | 1 | 6:1 | |
| 10 | Owner console | lib/owner, app/api/owner | 3 | — | **0** | ∞ | owner_actions/reset RPCs (00078–00081) have one SCHEMA.md row and nothing else |
| 11 | Schema/migrations | supabase/migrations | 39 | SCHEMA.md, supabase/CLAUDE.md | 19 | 2.1:1 | Best ratio — but see the consent-table hole above |
| 12 | Labs | lib/lab*, app/(dashboard)/lab, app/api/labs | 6 | LOCAL_LABS.md, requirements/local-labs.md, PRD-lab-lead-ux.md, per-lab-configuration.md | 4 | 1.5:1 | Healthiest subsystem doc-wise |

Top documentation debt: **admin console**, **poderator dashboard** (stale subdoc actively pointed to by root CLAUDE.md), **learning logs** (no home doc), **owner console** (no doc at all).

---

## Roadmap audit

`docs/OLOS-roadmap.md` read in full [FACT: working tree @ a5942ea].

**The convention is itself stale — twice.** The header still claims "The central long-term plan. This is the source of truth; issues reference back to it" and "**Last updated:** April 30, 2026" (line 5) — while a July 2026 staleness note added inside §6 [FACT: added by a5942ea, `git log -S "Staleness note"`] redirects to **`docs/audit/` (GAP_AUDIT + IMPROVEMENT_ROADMAP)** "for current state and forward planning." IMPROVEMENT_ROADMAP.md's preamble confirms it explicitly: "What this replaces: … the live remnants of `docs/OLOS-roadmap.md` (§3.7 Phase C, the AC-gap items, decisions D1–D4 — absorbed below)" [FACT: docs/audit/IMPROVEMENT_ROADMAP.md:4-6]. But the replacement is itself a **2026-07-04/07-05 snapshot** ("Audit date: 2026-07-04, dev @ PR #144"; PROGRESS.md "Assessed 2026-07-05 … through PR #157") that predates ~140 dev commits, the labs model, the social layer, the owner console, and the prod cutover. **Nothing on mainline is a current status tracker today.** New issues meanwhile anchor to a third artifact — `docs/EVOLUTION.md` — that exists only on an unmerged branch (see Ghost branch).

**§6 tracker line-by-line** (§6 does still exist; frozen as "Wave-1 historical record"):

| Row | Tracker says | Reality | Verdict |
|---|---|---|---|
| §1.1 (#39) | resolved, 00011 | consistent | OK (historical) |
| §1.2 (#40) | **"in review"**, PR #58 | PR #58 merged [FACT: merge commit 4f3ef32] | stale — shipped but unrecorded |
| §1.3 (#41) | **"in progress"** | #41 closed [FACT: set-difference of the 13 verified open issues and 12 not-planned closures → closed-completed, INFER: high] | stale |
| §1.4 (W1-004) | **"not started"** | `scripts/migration/migrate.py` shipped 2026-05-19 [FACT: a4c1667] — *before the tracker was last edited*; approach then retired in favor of self-registration | wrong even as history |
| §1.5 (#43) | "ran, data quality bad; issue should be re-scoped or closed" | #43 closed as **not-planned** [FACT: GitHub search reason:not-planned] | consistent, resolution unrecorded |
| §1.6 (#44) | **"in review"** | shipped long ago; staleness note itself admits it | stale |
| §1.7 (#45), §1.8 (#46) | resolved | consistent | OK |
| §1.9 (#47) | absorbed; "closure pending AC walkthrough" | #47 closed [INFER: high, same set-difference]; **entire pulse subsystem since retired** (PROGRESS.md: "pulse gate retired, Pulse left the nav") though `app/(dashboard)/pulse-check/` still exists in-tree [FACT: ls] | describes a retired subsystem |
| §1.10 (#48) | superseded | closed not-planned [FACT] | OK |
| §1.11 (#49), §1.12 (#50) | shipped, AC gaps | AC-gap list now moot (pulse retired); #86 closed not-planned [FACT] | overtaken |
| §1.13 (#51) | "downgraded … **pick up after #110 lands**" | #110 closed 07-11; **#51 closed not-planned 07-06** [FACT: not-planned search] | contradicted — was abandoned, not picked up |
| §1.14 (#52/#87) | "#87 downgraded … depends on #51 + Phase B" | **#87 closed as *completed* 2026-07-06** [FACT: issue_read, closed_by brendanwhitaker] | shipped but unrecorded |
| §2.1 (TBD) | no issue | shipped as `cycle_config.pod_limit`, migration 00043 [FACT: PROGRESS.md; Lane D chain] | shipped, unrecorded |
| §2.3 (TBD) | no issue | admin cycle-config editor exists (the #293 fix patched its `updateCycleConfigSchema`) [FACT: 27d0c86 message] | shipped, unrecorded |
| §5 D1–D4 | all "OPEN" | D1 de-facto resolved (preference_rank preserved — 00028 exists [FACT: supabase/CLAUDE.md renumber table]); D4 resolved (00011 single migration); D3 mentors = Phase 5 "not started" [FACT: PROGRESS.md]; IMPROVEMENT_ROADMAP claims to absorb them | table never closed out |

**Wrong-pointer class:** no §6 row points at a wrong issue/PR number; the failure mode here is *frozen status text*, plus the two open issues (#212/#213) and ghost-era text pointing at wrong *migration numbers and paths* (next section).

**supabase/CLAUDE.md rule text — verified.** "The roadmap is the plan; [migrations/](migrations/) is the truth. They drift." [FACT: supabase/CLAUDE.md:31]. The rule survives, but its object ("the roadmap") now means a superseded document; same file also still says "we already have 12 files" (line 49) against a 91-file chain, and carries an entire "Active issue: ISSUE-W1-002" section for work that shipped in May — the file is half-fresh (renumber history updated 07-13) and half-fossil.

---

## Ghost branch

**Branch:** `origin/claude/olos-dev-pod-project-creation-uz3wez` — the only ref containing 37a1f2f/424eddc/3d0ae7d/6b204f1 [FACT: `git branch -r --contains`]. 11 commits ahead of dev, **298 behind** [FACT: rev-list --left-right --count]. Diverged from dev at 741f3f6 (merge of PR #190, 2026-07-06).

**Shape:** 6 feature commits (2026-07-10, "Harden pod & project creation" → "Per-lab pod formation … Stage B") then the 5-part docs restructure (2026-07-11 01:35–02:35 UTC, all authored "Claude", session_01GP3PNQNWUeJjmg6ma3erJ5). Part 2 is e60bc03 ("roadmap + migration-doc refresh, archive link repair") [FACT: log --grep "part 2"]. The docs delta over the branch's own tip: 26 files, +759/−141 — creates docs/EVOLUTION.md + its own docs/ARCHITECTURE.md, moves ~13 stale docs to docs/archive/ with supersession banners, rewrites README/CLAUDE.md/lib/auth/CLAUDE.md/SCHEMA.md, adds roadmap §8 "Shipped beyond Wave 1" and fully reconciles the §6 tracker (every row resolved with accurate history) [FACT: git show --stat on all 5 commits; git show 6b204f1:docs/OLOS-roadmap.md].

**Why it stalled:** **no PR was ever opened from this branch** [FACT: search_pull_requests `head:claude/olos-dev-pod-project-creation-uz3wez` → 0 results], so there are no review comments to explain the stall. The structural reason is visible in git [INFER: high]: the branch forked *before* dev's a5942ea wave (07-08) and never rebased. Its feature commits implement a **parallel-universe labs model with its own migrations 00033–00039** ("00038_labs_lead_and_cycle_metro.sql", "00039_hq_lab_cycle_model.sql" per its §8.6) — numbers that on dev belong to entirely different files (00038 = metros zip mapping, 00039 = rsvp ip_hash; dev's labs model is 00062/00067/00068). Dev's shipped semantics even **contradict** the ghost model: ghost §8.6/#212 say "Labs leads can now create and run their own lab's cycles"; dev's LOCAL_LABS.md says "labs do **not** run their own open cycles (00067)" [FACT: both texts]. Merging the docs as-is would import factually wrong migration references; that plus the 298-commit gap made the branch unmergeable without a rewrite.

**But half the session escaped the branch.** The same session executed its issue-tracker reconciliation directly on GitHub (parts 4–5): filed #212/#213/#214, closed #62/#110, re-scoped #117/#123/#179 [FACT: part 4/5 commit messages; #212/#213 created 2026-07-11T02:33Z matching the commit timestamps]. Those live actions reference the dead docs:

- **#213 (open, p1)** Refs: `docs/archive/architecture-review-onboarding-state-machine.md` and `docs/EVOLUTION.md §Known open items` — **both 404 on mainline** [FACT: #213 body; repo find].
- **#212 (open, p1)** cites `docs/EVOLUTION.md §Known open items`, attributes the labs model to "migrations 00038/00039" (ghost numbering, wrong on dev), and refs `lib/cycles/registration.ts` / `getRegistrationCycle()` — **neither exists on dev** [FACT: #212 body; grep -r getRegistrationCycle → 0 hits; lib/cycles/ has no registration.ts]. The underlying metro-blind concern may still be real in the funnel (`app/api/registrations/funnel` exists) but the issue as written cannot be executed against current code — needs re-anchoring (flagged to Lane B's #212 finding).
- No mainline doc references EVOLUTION.md or docs/archive/ [FACT: repo-wide grep] — the blast radius is confined to the two open p1 issues (+ closed #214-era comments).

**What stays broken while unmerged:** the only *accurate, reconciled* §6 tracker and the only era-by-era history (EVOLUTION.md) rot on a dead branch; both open p1 issues point at 404s; and anyone repeating the "July documentation/reality audit" will redo parts 1–5 from scratch. The salvage is docs-only cherry-picking with migration numbers corrected — the feature commits should be treated as superseded [INFER: high].

**Two more ghost docs, same failure pattern:**
1. **`docs/audit/VIBE_SCAN_2026-07.md`** — three commits on `origin/claude/code-quality-scan-plan-2kxfvz` (2026-07-15: "vibe-scan complete — 38 findings, 14 decision questions, 3-tier backlog") [FACT: git log --all -- <file>; branch --contains]. Never merged — yet merged commit 27d0c86 (#293, 07-21) fixes "vibe-scan C1/PP1/CT4/PA1" and says "See docs/audit/VIBE_SCAN_2026-07.md C1", and GAP_AUDIT.md line 26 cites "verified by VIBE_SCAN_2026-07" [FACT: both texts]. The findings ledger that tier-1 fixes are being merged against is unmergeed and invisible on mainline.
2. **`docs/prod-migration-plan.md`** — only on `origin/claude/dev-prod-migration-plan-5pumez` [FACT: ls-tree], containing the plan + EXECUTION RECORD of the 2026-07-11 prod reset (Lane D's cutover finding). Mainline has no record: docs/environments.md was last touched 07-09, *two days before* the event it should describe, and grep finds no prod-cutover text in docs/, SCHEMA.md, or supabase/CLAUDE.md [FACT: greps].
3. (Related, open not unmerged:) **PR #173** "docs(pages-reorg): current-state page map + reorg requirements" (amguzzi, opened 07-05) is still **open** — 685 added lines of R1–R10 requirements + decisions log under `docs/pages-reorg/` [FACT: pull_request_read]. Some content is already overtaken (R9's nav is partially shipped per PROGRESS.md; R9 still positions "Pulse Check", since retired).

---

## Undocumented decisions (draft ADRs)

Each: what was decided, evidence, and a draft ADR paragraph for the co-lead to confirm or correct.

### ADR-1 — Prod database was reset and rebuilt from a baseline dump (2026-07-11)
**Decided:** stop migrating prod incrementally; wipe and rebuild OLOS-prod from a schema baseline at chain position 00077 because a rehearsal showed the chain does not replay cleanly (Lane D's verified finding). **Evidence:** plan + execution record only at `origin/claude/dev-prod-migration-plan-5pumez:docs/prod-migration-plan.md` [FACT: ls-tree]; zero mainline documentation [FACT: greps above]; open issue #77 (auto-apply migrations) still describes the pre-cutover world.
**Draft ADR:** *On 2026-07-11 OLOS-prod was reset and re-provisioned from a `supabase db dump` baseline reflecting migrations 00001–00077, because the accumulated 91-file chain (with two renumber repairs and out-of-band applications) no longer replayed cleanly on a fresh database. Consequences: prod's `schema_migrations` history no longer mirrors the repo chain file-for-file; future promotions apply only post-baseline migrations; the supabase/CLAUDE.md "periodic baseline snapshot" policy was effectively exercised ad-hoc without the accompanying `git mv` archive step. The plan/execution record must be merged to mainline and docs/environments.md updated.*

### ADR-2 — Documentation canon: in-place banners + docs/audit/, not archive/ + EVOLUTION.md
**Decided (implicitly, by whichever landed):** dev's July wave kept stale docs in place with historical banners (TUL_MVP_Spec.md, OLOS-architecture-brief.md) and made `docs/audit/` the planning canon; the ghost branch independently chose a `docs/archive/` + EVOLUTION.md canon that never merged — but its issue-tracker half executed, so the tracker now cites the losing convention. **Evidence:** TUL_MVP_Spec.md banner [FACT: file head]; IMPROVEMENT_ROADMAP preamble [FACT: :4-6]; ghost commits [FACT: 37a1f2f et al.]; #212/#213 refs [FACT: bodies].
**Draft ADR:** *OLOS documents supersession with in-place historical banners plus a small living set (README → ARCHITECTURE → SCHEMA → docs/audit/), not a physical docs/archive/ move. The unmerged EVOLUTION.md/archive restructure is rejected as a file layout but its content (era narrative, reconciled tracker) should be salvaged into the winning layout, and issues #212/#213 re-pointed at mainline paths.*

### ADR-3 — Consent, agreement, and email-audit ledger (00032/00055/00057)
**Decided:** enrollment activation requires a typed-signature Open Cycle Agreement (`cycle_agreements`, 00032); agreement acceptance is additionally recorded in a versioned `agreement_acceptances` ledger (00055); outbound email is audited in `email_log` (00057). **Evidence:** migration files [FACT: filenames in chain]; **zero coverage in SCHEMA.md or any docs/ file** [FACT: greps = 0].
**Draft ADR:** *Consent state lives in the database, versioned: participants.agreement_version/_accepted_at capture funnel consent, cycle_agreements captures the per-cycle signed ceremony, agreement_acceptances is the append-only acceptance ledger, and email_log records what we sent to whom. These tables are the compliance surface for a live alpha and must be documented in SCHEMA.md (ERD + summary rows) with a short data-retention note in docs/legal/PRIVACY_POLICY.md review.*

### ADR-4 — Participant erasure via `delete_participant()` RPC, with a known FK gap
**Decided:** right-to-erasure implemented as an owner-only SQL function (00058) logging to `participant_erasures`, later hardened + archived-state added (00079). A known gap was consciously deferred: the function omits `lab_leads` and `project_roles` (no cascade), so erasing a lab lead or project contributor **fails on FK** — "Fix … before relying on erasure in prod" [FACT: docs/AUTH_UNIFICATION_RUNBOOK.md:171-178]. **No issue tracks this** — it is not among the 13 open issues [FACT: Lane B's verified list].
**Draft ADR:** *Erasure is a database RPC, not an app route, so it works even when the app is the thing being distrusted; every erasure writes a participant_erasures row. Known limitation: lab_leads/project_roles FKs block erasure of participants holding those roles — a small migration must add those deletes before erasure is exercised on prod. File the tracking issue.*

### ADR-5 — Role authority unified into `participant_roles`; runbook execution state unrecorded
**Decided:** admin/owner determination resolves from one table, `participant_roles` (00054/00064/00065/00066), closing a live split-brain; `user_roles`/`participant_permissions` become transitional with sync triggers. **Evidence:** docs/AUTH_UNIFICATION_RUNBOOK.md (07-08) documents the design well — but its status header still says "Do NOT run any of this against prod" while the 07-11 prod rebuild at chain position 00077 *includes* 00064–00066 [FACT: Lane D cutover record], meaning the promotion almost certainly happened via the cutover, not the runbook [INFER: med].
**Draft ADR:** *participant_roles is the single authority for authorization; legacy tables are compat shims pending the documented retirement pass. The runbook's prod-promotion procedure was superseded by the 2026-07-11 baseline cutover; mark the runbook executed/obsolete and schedule the legacy-retirement follow-ups it lists.*

### ADR-6 — Weekly "What's next" messages are program-global, not per-cycle (00088)
**Decided:** 00087's `cycle_weekly_messages` was dropped one migration later for a global `weekly_messages` (one row per week 0–12, shared by every open cycle) — an owner decision in PR #264 review (Lane D). **Evidence:** SCHEMA.md:668 documents it well [FACT] — this one needs only a pointer from a decisions index, not new writing.
**Draft ADR:** *Weekly guidance copy is program-level content, not cycle configuration; cycles supply only the week number. Revisit only if two concurrent open cycles ever need divergent messaging (currently impossible: one active open cycle by invariant 00048/00060).*

### ADR-7 — Participant handles de-suffixed in place, breaking shared URLs (00083)
**Decided:** strip numeric suffixes from handles where the base is unclaimed; the 00044 trigger still suffixes real collisions. Live `/u/[handle]` URLs change **with no redirect** — flagged as an unresolved "⚠️ Prod decision" [FACT: docs/feedback-running-list.md:189]. **Draft ADR:** *Handles are identity-adjacent and may be rewritten for quality while the network is small; after any future "handles are stable" promise (public profiles, printed materials), renames require a redirect table. Decide before/whether 00083 applies to prod.*

### ADR-8 — One pod / one project per participant per cycle + 12-week model
**Decided:** `pod_limit` became cycle-config with default 1 (00043), cycle rail renumbered to weeks 0–12 (PRs #152–#154) [FACT: PROGRESS.md scorecard; PR titles]. Roadmap §2.1 still describes "the hardcoded 2-pod cap" world. **Draft ADR:** *A participant commits to one pod and one project per cycle; the cap is cycle_config.pod_limit (default 1) so future cycles can relax it without code. The cycle is a 13-slot week rail (0 Kickoff → 12 Showcase).*

**Documented adequately (no ADR needed, noted for completeness):** sector model & single-active-cycle rescope (SECTOR_MODEL.md, "owner-ratified" status lines), org cycles (ORG_CYCLES.md), local labs (LOCAL_LABS.md), Learning-Log pivot rationale (IMPROVEMENT_ROADMAP Phase 1 + PROGRESS), Luma sync (GAP_AUDIT A1 "diverged-better: live Luma sync (00035, cron)"), spotlights (shipped via PR #171 07-05; ARCHITECTURE/SCHEMA mention — though GAP_AUDIT's "missing" row is now internally stale).

---

## Deferred questions

Explicit punts, quoted, with source:

1. **#213**: "Add the cron entry to `vercel.json` (**decide cadence** — the review assumed daily)" and "**Decide the labs-model interaction before enabling**" [FACT: #213 body]. Same hold appears as PROGRESS.md "Deferred / infra": "Revocation-check cron: route exists, **not** registered in `vercel.json`… Only intentional Phase-0 hold."
2. **#212**: "Cycle info pages / `/cycles` listing should apply the same visibility rule… (**decide: show HQ-open only, or HQ-open + local with labels**)" [FACT: #212 body].
3. **Owner-decision queue** (docs/audit/IMPROVEMENT_ROADMAP.md §Owner-decision queue, 14 numbered items): #1 "Pulse fields with no Learning-Log home — keep/drop energy_level, highlight, tailwinds, tools_used, benefits, new_connections, in-pulse nominations"; PROGRESS.md adds that #2 (gate cadence), #3 (cutover timing), #7 (directory default) were "**Resolved-by-build (defaults chosen, worth explicit ratification)**" [FACT: PROGRESS.md]. These are decisions awaiting the co-lead-level ratification loop.
4. **PRD-admin-org-separation.md:352-355**: "Workstream rename does not rename the current quarter's run pod… **Deferred** — not blocking"; "The nav 'Cycles' item still routes to `/admin`… extracting a dedicated cycle-list page is **deferred**… acceptable **for now**"; "The org People tab's reconciler/stuck-participant affordances are **kept for now**" [FACT].
5. **AUTH_UNIFICATION_RUNBOOK.md:163+** "deferred by design": legacy-table retirement (`user_roles`/`participant_permissions`/00065 triggers), the **erasure FK gap** (ADR-4), and "Flags → roles" (`is_staff`/`is_test` not yet role-backed) [FACT].
6. **IMPROVEMENT_ROADMAP.md:228**: "**Consciously deferred (small, no phase):** `events.cycle_week`/`cycle_id` + the admin event-annotation route… `metros.display_order`; a dedicated `onboarding_tasks` table…; Delivery Facilitator + Client Sponsor roles" [FACT].
7. **ORG_CYCLES.md §7 "Open questions / deferred"**: org steering-committee analog; "Does an org cycle ever publish to the commons?"; "Do ICs get a follow feed?" (`project_subscriptions` is "**write-only for now**"); workstream dormancy mid-run [FACT: :225-245].
8. **ORTELIUS_KNOWLEDGE_GRAPH.md**: the accumulating graph model "**explicitly deferred to this not-yet-written sub-doc**"; "closed cycles… model is deferred"; sector governance "deferred and out of scope **for now**" [FACT: :48,124,170,173].
9. **docs/feedback-running-list.md:189**: "⚠️ **Prod decision**: applying 00083 changes `/u/[handle]` URLs with no redirect — previously shared numbered links 404" [FACT].
10. **OLOS-roadmap.md:211**: "Real-time updates **deferred to a polling pass in a future issue** — for v1 it's a server-rendered snapshot" [FACT].
11. **PR #173 body**: "**Still open** (tracked in the doc): Fresh-joiner checklist steps · Slack deep-link format (+ GitHub link?) · registered-member Home composition" [FACT: PR body] — open since 07-05.
12. **Phase-2 profile tails**: "Profile cred-band + locked badges + links **deferred**" [FACT: PROGRESS.md:23; SOCIAL_LAYER_ANALYSIS.md:140].
13. Cross-lane (verified by Lane B, listed for the synthesis view): #119 (.ics email vs Luma), #125 (A/B/C reactivation rows), #96 (accessibility-vs-UX call), #189 Part A (Slack app — workspace owner action).

---

## Gaps

- **00-ORIENTATION.md does not exist** anywhere on disk despite being the mandated first read; proceeded on sibling lane files (02/03/04) plus independent verification. The orchestrator's date placeholders ("undefined") were resolved from Lane B/D as cutoff 2026-06-18.
- **Why the ghost branch stalled is inference only** — no PR, no review thread, no issue comment explains it; the migration-number collision + 298-commit divergence is the visible mechanism, not a recorded decision.
- **#41/#47 closure reasons inferred by set-difference** (not in the 13 open, not in the 12 not-planned ⇒ completed) rather than individually fetched; state_reason "duplicate" would evade this net.
- **VIBE_SCAN_2026-07.md content unread** — I verified its existence, branch, and citations of it, but did not read the 38 findings/14 decision questions (unmerged-branch file; reading it fully belongs to a follow-up or the code-quality lane).
- **Drift-ratio counts are commit-granularity** on origin/dev including large agent squashes; they rank debt credibly but do not measure effort. Subsystem path lists are my mapping and may miss files (e.g., cross-cutting components).
- **PR-body sweep for deferred language was not exhaustive** — GitHub search payloads exceeded context limits; PR-sourced punts beyond #173 (and Lane B's issue set) may exist in the 163 PRs since #132.
- **docs/audit/GAP_AUDIT.md not audited row-by-row** — I confirmed one stale row (spotlights "missing" vs shipped PR #171/00051-52) and its 07-21 partial refresh; a full row-by-row re-verification against current dev is real work that should follow the co-lead's return.
- **TUL_MVP_Spec.md read as metadata + banner only**, per instructions.
- Whether the **metro-blind registration bug (#212) reproduces in the current funnel code** (post-`getRegistrationCycle` removal) was not established here — flagged for Lane B/synthesis.
- **AUTH_UNIFICATION_RUNBOOK execution status** on prod is [INFER: med] via the cutover's chain position; only the (unmerged) prod-migration-plan execution record or the live DB could confirm, and DB access is out of scope.
