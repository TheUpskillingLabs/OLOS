# `docs/requirements/` — requirements and design docs for buildable slices

| | |
|---|---|
| **What this is** | The requirements and design documents for slices of OLOS that are being built or were recently built: the cycle timeline, pod registration, the permissions unification, the Poderator Insights re-pointing, and the records of their re-baselines. |
| **Zone / owner** | `docs` zone (`docs/**`; [`../agent-teams.md`](../agent-teams.md) "File-ownership map"). Each doc is owned by the feature's engineer and reviewed by product ([`../roadmap/documentation-framework.md`](../roadmap/documentation-framework.md) §9). |
| **Conventions** | No `CLAUDE.md` here. Every doc opens with the status header (framework §3.2) and names its related code and docs. A doc is re-baselined with a dated note, never silently rewritten, when the code moves past it. Mirrored to the knowledge repo at `olos/requirements/` ([`../publish.manifest.json`](../publish.manifest.json)). |
| **Last verified** | 2026-10-03 |

## What is here

Statuses are the doc map's ([`../README.md`](../README.md), `requirements/` table). Six of the
docs were drafted 2026-06-17 (PR #231) and re-baselined 2026-07-12; `pr231-evaluation.md`
records why.

| File | Status | What it is |
|---|---|---|
| [`cycle-timeline.md`](cycle-timeline.md) | Plan of record — Stage 1 (`00086`) shipped; Stage 2 sweep pending | A cycle owns one ordered, timezone-aware schedule from which every window is derived. Stage 2 is issue #437. |
| [`cycle-4-readiness.md`](cycle-4-readiness.md) | Plan of record for Cycle 4 (decided 2026-10-03, #480) | Cycle 4 is internal: the homepage hot fix (data only), Cycle 4 run as an org cycle (no code), the next public cycle in 2027 with expectation-safe copy, materials and tasks for members while they wait, and the known 12-week limitations (no change planned). Epic #477; ops log #481. |
| [`pod-registration.md`](pod-registration.md) | Plan of record — D-10 window and `registered` status (`00099`) shipped | Two registration windows keyed to pod phases, the enrollment reconciler, the revocation cron. |
| [`permissions-redesign.md`](permissions-redesign.md) | Plan of record — finishing the `participant_roles` unification | What remains after migrations `00054`–`00066` made `participant_roles` the source of truth. |
| [`implementation-plan.md`](implementation-plan.md) | Plan of record — Stages 0–1 executed; later stages unrecorded | The sequenced plan across the slices above (2026-07 re-baseline). |
| [`moderator-insights-logs.md`](moderator-insights-logs.md) | Likely shipped (PRs #379/#381) — verify and mark | Re-pointing the Poderator Insights surfaces from `pulse_checks` to `learning_logs`. `CHANGELOG.md` lists both PRs under 2026.08.30; the doc's own header still says Draft. |
| [`per-lab-configuration.md`](per-lab-configuration.md) | Deferred (trigger: a second active lab) | Per-metro option lists, integrations, branding. With one tenant there is nothing to differentiate. |
| [`cycle3-testing-plan.md`](cycle3-testing-plan.md) | Historical / superseded (self-declared) | The gated test plan for the Cycle 3 go-live (2026-07-14). |
| [`pr231-evaluation.md`](pr231-evaluation.md) | Historical / superseded (self-declared) | Why the June drafts were re-baselined: prod had answered several of their questions, some differently. |
| [`local-labs.md`](local-labs.md) | Historical / superseded (self-declared) | The June multi-tenancy proposal; shipped differently as metros + sub-cohorts (`00060`–`00068`). Kept as the record. What exists is in [`../LOCAL_LABS.md`](../LOCAL_LABS.md). |

## How it fits

Three kinds of document describe a feature, and they are not interchangeable (framework §2
and §3):

- **A requirements doc** (this folder) says *what to build and how* for one buildable slice:
  current state, prescription, related code, open questions. It is the engineer's working spec
  and is re-baselined when the code moves. The status header is mandatory (§3.3).
- **A PRD** (`docs/PRD-*.md`, the docs root) was the May 2026 form for a whole surface:
  problem, goals, non-goals, functional requirements, and a decisions log. The three in the
  repo are Historical; their decisions logs still govern, and a departure from one gets a vault
  divergence note rather than a rewrite.
- **A vault note** (`docs/vault/`, PR #391, not yet merged) records *one decision*: an ADR, a
  divergence from a spec, or a workflow. MADR-shaped, with `status: proposed | accepted |
  superseded`, shipped in the PR that made the decision. Until the vault lands, a decision made
  while building a slice is recorded in that slice's doc.

The code these docs describe is mapped in [`../ARCHITECTURE.md`](../ARCHITECTURE.md) ("Core
domain concepts") and the tables in [`../../SCHEMA.md`](../../SCHEMA.md).

## Open issues in this area (snapshot 2026-10-03)

Live view: [all open issues](https://github.com/TheUpskillingLabs/OLOS/issues).

- [#408](https://github.com/TheUpskillingLabs/OLOS/issues/408) — State-machine reference (`docs/reference/state-machines.md`) + a test that the CHECK vocabularies equal the TypeScript unions (`priority/p1, size/s`)
- [#433](https://github.com/TheUpskillingLabs/OLOS/issues/433) — D3 — Prune the dead enrollment vocabulary (`interested`, `completed`); keep `stepped_back` reserved with a comment (`priority/p2, size/s`)
- [#437](https://github.com/TheUpskillingLabs/OLOS/issues/437) — S2.4 — One calendar: Stage 2 page sweep, drop the mirror and legacy columns, retire `anchor-events.ts`, upsert anchors from `cycle_events` (`priority/p2, size/l`)
- [#378](https://github.com/TheUpskillingLabs/OLOS/issues/378) — Pods→Projects transition: poderator scoping, project-level log views, and switcher rethink
- [#423](https://github.com/TheUpskillingLabs/OLOS/issues/423) — B4 — Pods→Projects scoping (decide #378 Gap 1) + project-scoped log view and roster + switcher groups (`priority/p1, size/m`)
- [#477](https://github.com/TheUpskillingLabs/OLOS/issues/477) — Cycle 4 readiness: run an internal cycle without a public front door, and keep expectations honest (`epic, priority/p1`); sub-issues [#480](https://github.com/TheUpskillingLabs/OLOS/issues/480) decision, [#481](https://github.com/TheUpskillingLabs/OLOS/issues/481) ops log, [#478](https://github.com/TheUpskillingLabs/OLOS/issues/478) registration audience (backlog)
- [#212](https://github.com/TheUpskillingLabs/OLOS/issues/212) — [labs][p1] Registration routing is metro-blind — getRegistrationCycle() ignores the participant's lab (`priority/p1, size/s`)

This list is a snapshot; the live view above is the truth. Refreshed at each sprint boundary
([`../roadmap/documentation-framework.md`](../roadmap/documentation-framework.md) §9.1).

## Before you change something

- Keep the status header current (framework §3.2). If what you build departs from the doc,
  update the doc in the same PR and record the choice (a vault note once PR #391 merges; until
  then a dated note in the doc).
- A doc the build has moved past gets a dated re-baseline or the historical banner, never a
  silent rewrite; `pr231-evaluation.md` is the model.
- A new doc here needs a row in [`../README.md`](../README.md) (`docs-check` fails otherwise)
  and `npm run check:docs` green.
- Migration numbers in a doc are historical the moment they merge; claim a new number on the
  issue first ([`../../CONTRIBUTING.md`](../../CONTRIBUTING.md), "Database migrations").
- Copy rules: "The Labs" (never "TUL"), "Upskiller", "Poderator"; never course / class /
  student / lesson / module in UI copy. Constitution: no in-app LLM, no activity telemetry,
  nothing that shames a member who is behind, consent-gated messaging.
