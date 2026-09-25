# `docs/` — the map

| | |
|---|---|
| **Status** | Canonical index. `docs-check` fails a PR that adds a doc under `docs/` without listing it here |
| **Owner** | Docs owner (see [`roadmap/documentation-framework.md`](roadmap/documentation-framework.md) §9) |
| **Last verified** | 2026-09-25 against `main@226445a` |

Eighty-odd documents, four kinds, six statuses. **Kind** is the Diátaxis question the
doc answers (tutorial · how-to · reference · explanation). **Status** is ours:
**Canonical** (trust it) · **Plan of record** (we are building this) · **Proposal**
(awaiting ratification) · **North star** (direction, not scheduled) · **Historical**
(true on its date; bannered) · **Superseded** (kept as a redirect). The framework that
defines these is [`roadmap/documentation-framework.md`](roadmap/documentation-framework.md).

## Start here

| If you are… | Read |
|---|---|
| new to the repo | [`../README.md`](../README.md) → [`../CONTRIBUTING.md`](../CONTRIBUTING.md) → [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| deciding what to build next | [`roadmap/README.md`](roadmap/README.md) |
| about to open a PR | [`roadmap/documentation-framework.md`](roadmap/documentation-framework.md) §5, then the PR template |
| touching an area | the `CLAUDE.md` next to it (`lib/auth/`, `supabase/`, `scripts/ops/`, `scripts/migration/`, `docs/poderator-dashboard/`) |
| asking "why is it like this" | `docs/vault/` (PR #391) once merged; until then the decision logs in the PRDs and `audit/IMPROVEMENT_ROADMAP.md` |
| asking "what shipped when" | [`../CHANGELOG.md`](../CHANGELOG.md) |

## Top-level files

| File | Kind | Status | Notes |
|---|---|---|---|
| [`../README.md`](../README.md) | reference | Canonical | stack, commands, layout |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | tutorial / how-to | Canonical | setup, branch/PR workflow, docs contract |
| [`../CHANGELOG.md`](../CHANGELOG.md) | reference | Canonical | Keep-a-Changelog, sectioned by `dev → main` promotion |
| [`../SCHEMA.md`](../SCHEMA.md) | reference | Canonical | ERDs + table summary; the seed of the data catalog |
| [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) | reference | Canonical | tokens, components, voice; has its own change log |
| [`../TUL_MVP_Spec.md`](../TUL_MVP_Spec.md) | explanation | Historical | the April intent; bannered |
| [`../CLAUDE.md`](../CLAUDE.md), [`../AGENTS.md`](../AGENTS.md) | reference | Canonical | agent context and orientation |

## `roadmap/` — the forward plan (Sept 2026 →)

| File | Kind | Status |
|---|---|---|
| [`roadmap/README.md`](roadmap/README.md) | reference | Canonical index |
| [`roadmap/2026-09-audit.md`](roadmap/2026-09-audit.md) | explanation | Proposal (findings verified) |
| [`roadmap/next-sprint.md`](roadmap/next-sprint.md) | plan | Proposal → Plan of record on ratification |
| [`roadmap/pre-registration-persona.md`](roadmap/pre-registration-persona.md) | explanation / spec | Proposal |
| [`roadmap/personas-and-journeys.md`](roadmap/personas-and-journeys.md) | explanation | Proposal |
| [`roadmap/documentation-framework.md`](roadmap/documentation-framework.md) | reference / how-to | Proposal |
| [`roadmap/data-strategy.md`](roadmap/data-strategy.md) | explanation | Proposal |
| [`roadmap/onboarding-curriculum-brief.md`](roadmap/onboarding-curriculum-brief.md) | how-to (hand-off) | Proposal |
| [`roadmap/documentation-topology.md`](roadmap/documentation-topology.md) | explanation / how-to | Proposal — the two-repo contract and the publish bridge |

## Reference and explanation (docs root)

| File | Kind | Status | Notes |
|---|---|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | reference | Canonical | the 10-minute orientation |
| [`environments.md`](environments.md) | how-to / reference | Canonical | local/dev/prod, env vars, migrations, **ledger-drift warning** |
| [`SECTOR_MODEL.md`](SECTOR_MODEL.md) | explanation | Canonical (Phase A shipped; B–D on paper) | sectors, cycle lifecycle, graduation |
| [`LOCAL_LABS.md`](LOCAL_LABS.md) | explanation | Canonical | metros as labs, sub-cohorts, lab leads |
| [`ORG_CYCLES.md`](ORG_CYCLES.md) | explanation | Canonical (§6 has one stale claim) | the org-internal track |
| [`SENSEMAKING_FLOW.md`](SENSEMAKING_FLOW.md) | explanation | Plan of record (intake shipped; rest on paper) | survey → extract → swipe → Paradox Sprint |
| [`ORTELIUS_KNOWLEDGE_GRAPH.md`](ORTELIUS_KNOWLEDGE_GRAPH.md), [`ORTELIUS_NORTHSTAR.md`](ORTELIUS_NORTHSTAR.md) | explanation | North star | gated on governance decision #11 |
| [`personas.md`](personas.md) | explanation | Superseded by `roadmap/personas-and-journeys.md` | the May originals; voice source |
| [`architecture-review-onboarding-state-machine.md`](architecture-review-onboarding-state-machine.md) | explanation | Historical (postmortem) | why the reconciler exists |
| [`agent-teams.md`](agent-teams.md) | how-to | Canonical | Claude Code agent teams on this repo |
| [`testing-plan-cycle-uat.md`](testing-plan-cycle-uat.md) | how-to | Canonical | facilitator-led UAT script |
| [`AUTH_UNIFICATION_RUNBOOK.md`](AUTH_UNIFICATION_RUNBOOK.md) | how-to | Runbook — verify whether it has run on prod | |
| [`feedback-running-list.md`](feedback-running-list.md) | living log | Canonical | app feedback intake |
| [`work-day-improvements.md`](work-day-improvements.md) | living log | Canonical | in-person work-day retros; proto-requirements |
| [`OLOS-roadmap.md`](OLOS-roadmap.md) | plan | Historical (April; bannered) | keep for `§`-anchors |
| [`OLOS-architecture-brief.md`](OLOS-architecture-brief.md), [`PROTO_TRANSLATION_PLAN.md`](PROTO_TRANSLATION_PLAN.md) | explanation | Superseded | redirects |

## PRDs and design specs

| File | Status | Notes |
|---|---|---|
| [`PRD-lab-lead-ux.md`](PRD-lab-lead-ux.md) | Plan of record | Phase 0+ shipped 2026-07-11; Phases 1–3 unrecorded |
| [`PRD-admin-org-separation.md`](PRD-admin-org-separation.md) | Plan of record | 4 phases; completion unrecorded |
| [`PRD-moderator-dashboard.md`](PRD-moderator-dashboard.md), [`PRD-moderator-dashboard-mockups.html`](PRD-moderator-dashboard-mockups.html), [`superpowers/specs/2026-05-22-poderator-dashboard-design.md`](superpowers/specs/2026-05-22-poderator-dashboard-design.md) | Historical (built; re-pointed to Learning Logs) | §10 decisions still govern |
| [`PRD-login-and-cycle-onboarding.md`](PRD-login-and-cycle-onboarding.md) | Historical (bannered) | superseded by the funnel + ceremony |
| [`poderator-dashboard/CLAUDE.md`](poderator-dashboard/CLAUDE.md) | Canonical area context | migration numbers in it are historical |
| [`proposals/luma-driven-event-pages.md`](proposals/luma-driven-event-pages.md) | Historical | phases 1–4 done |

## `requirements/`

| File | Status |
|---|---|
| [`requirements/cycle-timeline.md`](requirements/cycle-timeline.md) | Plan of record — Stage 1 (`00086`) shipped; Stage 2 sweep pending |
| [`requirements/pod-registration.md`](requirements/pod-registration.md) | Plan of record — D-10 window and `registered` status (`00099`) shipped |
| [`requirements/permissions-redesign.md`](requirements/permissions-redesign.md) | Plan of record — finishing the `participant_roles` unification |
| [`requirements/implementation-plan.md`](requirements/implementation-plan.md) | Plan of record — Stages 0–1 executed; later stages unrecorded |
| [`requirements/moderator-insights-logs.md`](requirements/moderator-insights-logs.md) | Likely shipped (PRs #379/#381) — verify and mark |
| [`requirements/per-lab-configuration.md`](requirements/per-lab-configuration.md) | Deferred (trigger: a second active lab) |
| [`requirements/cycle3-testing-plan.md`](requirements/cycle3-testing-plan.md), [`requirements/pr231-evaluation.md`](requirements/pr231-evaluation.md), [`requirements/local-labs.md`](requirements/local-labs.md) | Historical / superseded (self-declared) |

## `audit/` — point-in-time audits (dated; never edited after their date)

| File | Date | Status |
|---|---|---|
| [`audit/DATA_ARCHITECTURE.md`](audit/DATA_ARCHITECTURE.md) | 2026-07-04 | Canonical principles (§2); hardening batch shipped |
| [`audit/DESIGN_INTENT.md`](audit/DESIGN_INTENT.md) | 2026-07-04 | Reference — the prototype's intent and the constitution rules |
| [`audit/GAP_AUDIT.md`](audit/GAP_AUDIT.md) | 2026-07-04 | Historical |
| [`audit/IMPROVEMENT_ROADMAP.md`](audit/IMPROVEMENT_ROADMAP.md) | 2026-07-05 | Historical plan (Phases 0–7); open decisions moving to the vault |
| [`audit/PROGRESS.md`](audit/PROGRESS.md) | 2026-07-05 | Historical (bannered) — superseded by `roadmap/2026-09-audit.md` |
| [`audit/SOCIAL_LAYER_ANALYSIS.md`](audit/SOCIAL_LAYER_ANALYSIS.md) | 2026-07-07 | Reference + workstreams (A–D) feeding Sprint 2 |

## `vault/` — decisions, divergences, workflows

Proposed in PR #391 (Obsidian-compatible, MADR-shaped). Conventions in
`docs/vault/CLAUDE.md` once merged. The framework adopts it as the single decision
register ([`roadmap/documentation-framework.md`](roadmap/documentation-framework.md) §2).

## `sessions/` — session reports (an inbox)

One report per substantive session, written in the PR that carries the work
([`sessions/README.md`](sessions/README.md) has the template). Published to the team
knowledge repo on merge and swept out of OLOS monthly, so only the current sprint's
reports are here. Not listed individually in this map.

## `publish.manifest.json` — what leaves OLOS

The list of paths the `publish-artifacts` workflow copies to the private team repo
(`TheUpskillingLabs/docs-archive` by default), with modes `mirror`, `mirror+prune`, and
`snapshot`. Design: [`roadmap/documentation-topology.md`](roadmap/documentation-topology.md).

## `archive/` — session artifacts and superseded plans

Moved here 2026-09-15; see [`archive/README.md`](archive/README.md). Frozen: links inside
them are not checked. Published to the knowledge repo and swept out of OLOS by the
monthly sweep PR, so this folder empties over time.

## Content corpora (not engineering docs)

- [`legal/`](legal/) — Code of Conduct, Privacy Policy, Terms (rendered by the public pages).
- [`marketing-site/`](marketing-site/) — the legacy Squarespace export, a reference corpus
  for copy (see its [`README.md`](marketing-site/README.md)).
