# Documentation & development-workflow framework

| | |
|---|---|
| **Status** | Proposal — adopts PR #391's decision vault as-is; everything else is new and awaits maintainer ratification |
| **Owner** | Maintainers (`.github/CODEOWNERS`); a named **docs owner** is one of the decisions below |
| **Last verified** | 2026-09-15 against `main@226445a` |
| **Companion** | [`2026-09-audit.md`](2026-09-audit.md) §2, §3, §5 (the findings this answers); [`docs/README.md`](../README.md) (the map this framework produces) |

The audit found that OLOS has good code discipline (CI, migration guards, idempotent
DDL, tests) and no documentation discipline (three stale roadmaps, eleven decision
registers, no changelog, orphaned docs PRs). This framework is the contract that closes
that gap. It is deliberately assembled from **existing, validated conventions** — each
adopted for one job, adapted minimally, and enforced mechanically where possible.

---

## 0. The framework in one paragraph

**Why** a thing is the way it is goes in a **decision record** (`docs/vault/`, PR #391;
MADR-shaped, Obsidian-compatible). **What** the system is goes in **reference docs**
organized by the **Diátaxis** lens (tutorial / how-to / reference / explanation) via a
doc map and a status header, not a mass rename. **When** it changed goes in
**`CHANGELOG.md`** (Keep a Changelog), sectioned by `dev → main` promotion and tagged
with **CalVer**. **What changed and who owns it** is tracked with **Conventional
Commits** (already de facto), GitHub **issue types + labels + milestones**, and a PR
template that treats docs as part of the definition of done. A **`docs-check` GitHub
Action** enforces the mechanical parts on every PR, and a **weekly Claude "docs
steward"** reads the week's merges and files drift issues for the parts that need
judgment.

---

## 1. Principles

1. **Docs live with the code and change in the same PR.** A behavior change without
   its doc change is incomplete. This is the one rule everything else serves.
2. **Every document declares its status.** Canonical, plan of record, proposal,
   historical, superseded. Stale is a state to be labeled, not a sin to be hidden.
3. **Four questions, four homes.** *Why* → vault. *What* → reference docs and
   `SCHEMA.md`. *When* → `CHANGELOG.md`. *How* → runbooks (vault `workflows/`) and
   area `CLAUDE.md` files.
4. **Enforce mechanically what can be; review weekly what cannot.** A CI check can
   demand a changelog line. It cannot judge whether a decision was worth recording.
5. **Agents are first-class contributors.** `CLAUDE.md` files are the contract for
   Claude Code sessions as much as for people. Conventions that only live in a human's
   head are not conventions.
6. **Adapt, don't invent.** MADR, Diátaxis, Keep a Changelog, Conventional Commits,
   CalVer. Each is used for exactly the job it was designed for, in its lightest form.

---

## 2. Decision records — the vault (`docs/vault/`)

**Adopt PR #391 unchanged** as the single decision register. It already has the right
shape: three note kinds (`decisions/ADR-NNNN-slug.md`, `divergence/area-slug.md`,
`workflows/verb-object.md`), MADR-style sections (Context / Options / Decision / Why /
Consequences / Links), frontmatter with `status: proposed | accepted | superseded`,
supersession chains, and the rule that a note ships in the PR that made the decision.
Close PR #390 as a strict subset.

Two small additions, proposed as a follow-up PR to the vault once #391 lands (not edits
to #391 itself):

| Addition | Why |
|---|---|
| Optional frontmatter `owner:` (GitHub handle) and `decide_by:` (date) on `proposed` notes | Turns the vault into the **open-decision register**. The eleven scattered queues in the audit (§3.1) all lack an owner and a date, which is why they stay open. |
| `docs/vault/decisions/README.md` — a table of every ADR (number, title, status, owner, date), maintained by hand and checked by `docs-check` for missing rows | Obsidian users get the graph; GitHub readers get a list. |

**Backfill (Sprint 0, ~2 hours).** Every open owner decision in the legacy queues
becomes a `proposed` vault note with an owner. The source docs each get one line:
*"Open decisions moved to `docs/vault/` on 2026-MM-DD."* The list:

| Source | Items | Proposed ADR slugs (first pass) |
|---|---|---|
| `IMPROVEMENT_ROADMAP.md` owner queue | #1, #4, #5, #6, #8, #9, #10, #11, #12, #13, #14 | `pulse-field-disposition`, `voter-eligibility` (**mark superseded by the 2026-08-26 direct-registration decision — record that decision first as `ADR-0004-direct-project-registration`**), `formation-arena-shape`, `team-caps`, `survey-stack`, `licensing-legal-review`, `resources-editor`, `sensemaker-governance-gate`, `interaction-telemetry`, `ortelius-pilot-scope`, `embeddings-model` |
| `SOCIAL_LAYER_ANALYSIS.md` §9 | 5 | `reaction-visibility`, `props-mechanic`, `contact-opt-in-default`, `activity-event-retroactivity`, `poderator-badge-public` |
| `ORTELIUS_NORTHSTAR.md` §12 | 3, 4, 7, 8 | `standpoint-weighting`, `targeting-policy`, `anonymous-retention-window`, `commons-custodian` |
| `SECTOR_MODEL.md` §10, `ORG_CYCLES.md` §7 | 8 | `closed-b2b-cycles`, `sector-steering-committee`, `cohort-naming`, `dri-removal`, `org-steering-analog`, `org-commons-publishing`, `ic-follow-feed`, `workstream-dormancy` |
| `feedback-running-list.md` 🧭 rows | ~12 | one note each, or one `member-feedback-product-calls-2026-07` note listing them with owners |
| `work-day-improvements.md` 🧭 rows | #2, #12, #13 | `worked-example-choice`, `problem-statement-review-workflow`, `pod-viability-threshold` |
| Un-recorded, already made | — | `ADR-0004-direct-project-registration` (2026-08-26), `ADR-0005-registered-enrollment-state` (`00099`), `ADR-0006-learning-log-replaces-pulse` (Phase 1), `ADR-0007-labs-as-sub-cohorts` (`00067`), `ADR-0008-no-in-app-llm` (constitution rule; the moderator copy-prompt pattern and BYO-LLM extraction both rest on it) |

The last row matters most: the five biggest architectural facts of the product have
no decision record. Backfilling them is how the vault earns trust.

**Divergence notes** are how `TUL_MVP_Spec.md` and the May PRDs stop misleading
readers without being rewritten: each known departure gets a `divergence/` note linked
to its ADR. The audit's §2.1 "Historical PRD" rows are the first candidates.

**Decision issues.** A new issue template, *Decision needed*, captures a decision
request (context, options, who decides, decide-by). Its resolution is a PR that adds
the vault note and closes the issue. This is how "issues are created, commented on,
and resolved as part of the workflow" applies to decisions, not just code.

---

## 3. The doc map, status headers, and where things go

### 3.1 The map

`docs/README.md` (added by this PR) lists every document with its **kind** (Diátaxis)
and **status** (ours). It is the entry point for humans and agents, and `docs-check`
fails a PR that adds a Markdown file under `docs/` without adding it to the map.

Diátaxis kinds, applied to OLOS:

| Kind | Question it answers | OLOS examples |
|---|---|---|
| **Tutorial** | "Teach me, step by step" | `CONTRIBUTING.md` setup; the UAT script; (future) curriculum modules |
| **How-to** | "How do I do X" | `environments.md` migration steps, `agent-teams.md`, vault `workflows/`, `scripts/*/CLAUDE.md` |
| **Reference** | "What is true" | `SCHEMA.md`, `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, area `CLAUDE.md`, the (new) metrics dictionary and state-machine reference |
| **Explanation** | "Why is it shaped this way" | `SECTOR_MODEL.md`, `LOCAL_LABS.md`, `ORG_CYCLES.md`, `SENSEMAKING_FLOW.md`, the Ortelius docs, the architecture review, vault `decisions/` |

Status classes (from the audit): **Canonical · Plan of record · Proposal · North star
· Historical · Superseded**.

### 3.2 The status header

Every document under `docs/` (and every new top-level `*.md`) opens with this table,
after the H1. PRDs and requirements docs already use the pattern; this makes it universal.

```markdown
| | |
|---|---|
| **Status** | Canonical · Plan of record · Proposal · North star · Historical · Superseded |
| **Owner** | @github-handle (a person or a role) |
| **Last verified** | YYYY-MM-DD against `dev@<sha>` or `main@<sha>` |
```

Optional rows: **Supersedes**, **Superseded by**, **Companion**, **Scope**. The docs
steward (§7.2) flags any Canonical doc whose *Last verified* is older than 90 days or
whose cited paths no longer exist.

### 3.3 Folder plan — no mass rename

| Folder | Holds | Rule |
|---|---|---|
| `docs/README.md` | the map | every doc appears once |
| `docs/roadmap/` | forward planning: audits, sprint plans, personas, strategies | one dated audit per phase; the sprint doc is the plan of record |
| `docs/vault/` | decisions, divergences, workflows | PR #391 conventions |
| `docs/requirements/` | requirements and design docs for buildable slices | status header mandatory |
| `docs/audit/` | point-in-time audits | dated, never edited after their date except to add a superseded banner |
| `docs/archive/` | session artifacts, superseded plans | moved, not deleted; `docs/archive/README.md` says why |
| `docs/*.md` (root) | reference and explanation docs | existing names stay; add status headers opportunistically |
| `docs/legal/`, `docs/marketing-site/` | content corpora | not engineering docs; excluded from steward checks |
| `CHANGELOG.md` | what shipped when | §6 |

Historical banner, verbatim, for docs that describe a plan the build has moved past:

```markdown
> **Historical (bannered YYYY-MM-DD).** This document describes the plan as of its
> date. For current state see `docs/README.md`; for the decisions that moved the build
> away from this plan see `docs/vault/`.
```

### 3.4 Area `CLAUDE.md` files are reference docs

`lib/auth/CLAUDE.md`, `supabase/CLAUDE.md`, `scripts/*/CLAUDE.md`,
`docs/poderator-dashboard/CLAUDE.md` are the densest, most-read references in the repo
and the ones agents obey. Rules: a PR that changes a convention an area `CLAUDE.md`
states must update it (PR checklist); each carries a *Last verified* line; the steward
flags cited paths that no longer resolve.

---

## 4. Issues, labels, milestones, and the weekly triage

### 4.1 Types and labels

Use the org's existing **issue types** (Task, Bug, Feature) on every issue. Labels
carry the rest; the taxonomy below extends what was in use in May–June:

| Family | Values | Meaning |
|---|---|---|
| `area/` | `frontend`, `backend`, `database`, `ops`, `docs`, `design` | which part of the tree |
| `persona/` | `pre-registrant`, `upskiller`, `poderator`, `mentor`, `lab-lead`, `admin`, `owner`, `contributor` | who it serves (new; makes persona coverage measurable) |
| `priority/` | `p0` (live incident) `p1` (this sprint) `p2` (next) `p3` (backlog) | when |
| `size/` | `xs` (≤2h) `s` (≤1d) `m` (≤3d) `l` (≤1w) `xl` (split it) | how big |
| state | `needs-triage`, `needs-decision`, `blocked`, `good first issue` | workflow |
| CI | `skip-changelog`, `schema-doc-exempt` | opt-outs read by `docs-check` (must be justified in the PR) |

### 4.2 Milestones and the board

One milestone per sprint (`Sprint 0 — Hygiene (Sep 2026)`, `Sprint 1 — Pre-registration
(Oct 2026)`, …). Every triaged issue has a milestone or `p3`. A GitHub Project board
with **Now / Next / Later / Done** columns, filtered by milestone, is the only view
maintainers need; the roadmap docs link to it.

### 4.3 Lifecycle

```
opened (template) ──► needs-triage ──► triaged: type + area + persona + priority + size + milestone
   ──► in progress: branch `feat|fix|docs/<slug>` (or `<issue#>-<slug>`), PR body says `Closes #N`
   ──► review ──► merged into dev (issue auto-closes) ──► promoted to main (changelog section)
```

Umbrella issues (like #361) use GitHub **sub-issues**, never checkbox lists alone, so
each item can be labeled, sized, and closed by a PR.

### 4.4 The weekly triage (30 minutes, maintainers)

1. Read the docs steward's issue (§7.2).
2. Label and type every `needs-triage` issue; assign milestones.
3. Dispose of PRs idle > 14 days: merge, request changes, or close with a reason.
4. Move `needs-decision` items to a vault `proposed` note with an owner and a date.
5. Update the sprint doc's status table.

---

## 5. Pull requests — the definition of done

The PR template (updated by this PR) adds two sections to the good one that exists:

- **Issue** — `Closes #N` (or "no issue: why").
- **Docs & decisions** checklist — changelog line under *Unreleased*; ADR or divergence
  note if a choice was made or the build moved off a spec; `SCHEMA.md` if a migration;
  the area `CLAUDE.md` if a convention changed; the relevant `docs/roadmap/` or
  requirements doc if scope changed; `docs/README.md` if a doc was added.

PR **titles** follow Conventional Commits (`feat(scope): …`, `fix(...)`, `docs(...)`,
`chore(...)`, `refactor(...)`, `ops(...)`), because squash-merge turns the title into
the commit that the changelog and `git log` will show forever. `docs-check` validates
the title pattern.

**Review ownership.** `CODEOWNERS` gains a line routing `docs/**` and `*.md` to the
docs owner in addition to the maintainers, so documentation PRs stop waiting.

---

## 6. Changelog and releases

`CHANGELOG.md` (seeded by this PR) follows **Keep a Changelog 1.1**:

- `## [Unreleased]` at the top. Every PR that touches `app/`, `lib/`, `supabase/`,
  `proxy.ts`, or `vercel.json` adds one line here under **Added / Changed / Fixed /
  Removed / Ops / Docs**, ending in `(#PR)`. Docs-only PRs may skip with the
  `skip-changelog` label.
- On each `dev → main` promotion, the maintainer renames *Unreleased* to a dated section
  `## [2026.10.10]` (**CalVer** `YYYY.MM.DD`, matching the promotion date), tags `main`
  with `v2026.10.10`, and lists the **migrations to apply to prod** under **Ops**. The
  changelog section is then the promotion runbook's input, and `git tag` gives every
  prod deploy a name.
- Retroactive history: sections from 2026-07-12 onward are reconstructed from the merge
  log; April–July is reconstructed from the docs' PR references and marked as such.

Why CalVer and not SemVer: OLOS has one deployment, no downstream consumers, and
ships on a cadence. "What was live on Oct 10" is the question people ask.

---

## 7. Enforcement

### 7.1 `docs-check` — on every pull request

`.github/workflows/docs-check.yml` (added by this PR) runs alongside `ci.yml` and
fails the PR when:

| Check | Rule | Opt-out |
|---|---|---|
| Schema doc | `supabase/migrations/**` changed and `SCHEMA.md` did not | label `schema-doc-exempt` |
| Changelog | `app/`, `lib/`, `supabase/`, `proxy.ts`, or `vercel.json` changed and `CHANGELOG.md` did not | label `skip-changelog` |
| Doc map | a new `docs/**/*.md` was added and `docs/README.md` did not change | — |
| Links | a changed Markdown file contains a relative link to a path that does not exist (`scripts/check-doc-links.mjs`) | allowlist in the script for intentionally untracked files |
| Vault frontmatter | a `docs/vault/**/*.md` note lacks `title`, `date` (ISO), `status ∈ {proposed, accepted, superseded}`, `kind ∈ {decision, divergence, workflow, index}` | — |
| PR title | not Conventional-Commit shaped | — |
| Migration numbers | duplicate numeric prefix (`npm run check:migrations`, already in `ci.yml`; repeated here so a docs-only workflow can run alone) | — |

Everything is a shell step or a small Node script; no third-party actions beyond
`actions/checkout` and `actions/setup-node`. The checks are conservative on purpose:
they demand the *presence* of a doc change, never judge its content.

### 7.2 The docs steward — weekly, Claude

`.github/workflows/docs-steward.yml` (added by this PR; inert until an
`ANTHROPIC_API_KEY` secret is set) runs Claude Code on a schedule (Mondays 13:00 UTC)
and on manual dispatch with a fixed prompt that:

1. Lists PRs merged into `dev` in the last 7 days (`gh pr list --state merged`).
2. For each, checks: a changelog line exists; if the PR body or diff contains a
   decision ("we chose", "instead of", "decided", a new CHECK constraint, a removed
   route), a vault note exists; if a migration landed, `SCHEMA.md` and the state-machine
   reference changed where relevant; if a route or `lib/` module was added or removed,
   `docs/ARCHITECTURE.md` still describes the tree.
3. Scans Canonical docs for *Last verified* older than 90 days and for cited paths
   (`app/…`, `lib/…`, `supabase/migrations/…`) that no longer exist.
4. Checks `docs/roadmap/next-sprint.md`'s status table against issue/PR state.
5. Opens (or updates) **one** issue titled `Docs steward — week of YYYY-MM-DD` with
   findings grouped by severity and suggested fixes. **It never pushes commits and never
   edits docs**; humans (or a Claude session a human starts) act on the issue.

Permissions: `contents: read`, `issues: write`, `pull-requests: read`. Cost: one
session per week over a small diff — cents. If the team prefers to run it from Claude
Code on the web instead of GitHub Actions, the same prompt works as a **Claude Routine**
(a scheduled trigger that spawns a fresh session with the repo attached); the workflow
file documents both.

### 7.3 What we deliberately do not enforce

Prose style, document length, a minimum number of ADRs per sprint, or "every PR must
have an ADR". Over-enforcement produces empty notes. The vault's own rule stands: write
a decision note when a future reader could reasonably question the choice.

---

## 8. Adoption plan (Sprint 0, two weeks)

| Day | Action | Owner |
|---|---|---|
| 1 | Merge PR #391; close #390. Merge this PR (`docs/roadmap/`, `CHANGELOG.md`, `docs/README.md`, workflows, templates, archive moves). | maintainers |
| 1 | Create labels (§4.1) and the two milestones; set `ANTHROPIC_API_KEY` for the steward (or create the Routine). | docs owner |
| 2 | Label sweep: type + labels + milestone on all 20 open issues; break #361 into sub-issues. | docs owner + maintainers |
| 2 | Dispose of the 6 orphan docs PRs per the audit §5.2 table. | maintainers |
| 3–5 | Backfill the five un-recorded architectural decisions (ADR-0004…0008) and the open queues (§2) as `proposed` notes with owners. | lead architect |
| 5 | Fix the stale lines the audit found in `ARCHITECTURE.md`, `environments.md`, `poderator-dashboard/CLAUDE.md`, `ORG_CYCLES.md` §6; banner `PROGRESS.md` as superseded. | docs owner |
| 8 | First steward run; first weekly triage using its output. | maintainers |
| 10 | Retro: what the checks caught, what they blocked wrongly; tune opt-outs. | all |

---

## 9. Ownership

| Class of document | Owner (role) | Reviewed by |
|---|---|---|
| Vault decisions | whoever made the decision; owner-level decisions by the owner | maintainers |
| `docs/roadmap/*` | lead architect / product | maintainers |
| Reference (`SCHEMA.md`, `ARCHITECTURE.md`, area `CLAUDE.md`) | the engineer changing the area | maintainers |
| `CHANGELOG.md` | the PR author (line); the promoting maintainer (section) | — |
| `docs/requirements/*` | the feature's engineer | product |
| Living logs (`feedback-running-list`, `work-day-improvements`) | success team / events lead | — |
| `docs/README.md`, `docs/archive/` | docs owner | — |

**Decision to make now:** name the docs owner. Recommendation: the maintainer who
already runs the feedback lists, with the steward doing the reading.
