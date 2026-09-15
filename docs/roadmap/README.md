# `docs/roadmap/` — the forward plan

| | |
|---|---|
| **Status** | Canonical index for the planning layer. The documents it lists are **proposals** until the owner ratifies the decisions in [`next-sprint.md`](next-sprint.md) §7 |
| **Owner** | Lead architect / product |
| **Last verified** | 2026-09-15 against `main@226445a` |

This folder is where OLOS's *next* work is planned. It supersedes
[`docs/OLOS-roadmap.md`](../OLOS-roadmap.md) (April 2026, Waves 1–3 — kept for its
§-anchors) and [`docs/audit/IMPROVEMENT_ROADMAP.md`](../audit/IMPROVEMENT_ROADMAP.md)
(July 2026, Phases 0–7 — kept as the prototype-parity plan) as the plan of record.
The *why* behind decisions lives in `docs/vault/` (PR #391); the *what shipped when*
lives in [`CHANGELOG.md`](../../CHANGELOG.md).

## Read in this order

| # | Document | What it is | Read it if you… |
|---|---|---|---|
| 1 | [`2026-09-audit.md`](2026-09-audit.md) | Retroactive audit: docs, decisions, data pipelines, issues/PRs, personas — 14 ranked findings | want to know where things stand and why the rest exists |
| 2 | [`next-sprint.md`](next-sprint.md) | Sprint 0 / 1 / 2 plan: workstreams, dates, dependencies, owner decisions, issue seeds | are deciding or doing the next work |
| 3 | [`pre-registration-persona.md`](pre-registration-persona.md) | The between-cycles persona: behavioral design, the two lists, the readiness ladder, the drip, the Sprint 1 feature set | are building or writing for Sprint 1 workstream A |
| 4 | [`personas-and-journeys.md`](personas-and-journeys.md) | Ten roles × the cycle arc; the impact loop; what each role needs the platform to do | are making a product, copy, or program call |
| 5 | [`documentation-framework.md`](documentation-framework.md) | The docs-and-workflow contract: vault, doc map, changelog, issues, PR definition of done, enforcement | contribute anything at all |
| 6 | [`data-strategy.md`](data-strategy.md) | Reining in the pipelines: ledger, state machines, activity spine, metrics layer, email accounting, catalog | touch schema, crons, email, or metrics |
| 7 | [`onboarding-curriculum-brief.md`](onboarding-curriculum-brief.md) | Hand-off for the curriculum session: the persona prompt, knowledge packet, module map, tool stack, deliverables | are running that session or wiring its output into OLOS |

## Conventions for this folder

- One dated audit per phase (`YYYY-MM-audit.md`); never edited after its date except
  to add a superseded banner.
- `next-sprint.md` is the plan of record; its §8 status table is updated at the weekly
  triage. When a sprint closes, its retro goes in `CHANGELOG.md` (what shipped) and the
  vault (what was decided), and the next sprint doc replaces this one's plan.
- Persona docs are living; strategy docs are re-baselined per phase.
- Every document carries the status header from
  [`documentation-framework.md`](documentation-framework.md) §3.2.
