# `docs/audit/` — the July 2026 point-in-time audits

| | |
|---|---|
| **What this is** | Six dated audits (2026-07-04 to 2026-07-07) of OLOS against the prototype's design intent: what the product was meant to be, where it stood, the data principles, the reconciled build sequence, a progress snapshot, and the social-layer analysis. |
| **Zone / owner** | `docs` zone (`docs/**`; [`../agent-teams.md`](../agent-teams.md) "File-ownership map"). Reviewed by the docs owner ([`../roadmap/documentation-framework.md`](../roadmap/documentation-framework.md) §9). |
| **Conventions** | No `CLAUDE.md` here. An audit is dated and **never edited after its date**, except to add the superseded banner (framework §3.3). A newer audit supersedes an older one; nothing is updated in place. The folder is mirrored unchanged to the team knowledge repo at `olos/audits/2026-07/` ([`../publish.manifest.json`](../publish.manifest.json)). |
| **Last verified** | 2026-10-02 |

## What is here

Dates and statuses are the doc map's ([`../README.md`](../README.md), `audit/` table). Each
file states its own audit date in its opening paragraph, except `DESIGN_INTENT.md`, which
carries no date of its own; the map's date is used for it.

| File | Date | Status | What it is |
|---|---|---|---|
| [`DATA_ARCHITECTURE.md`](DATA_ARCHITECTURE.md) | 2026-07-04 | Canonical principles (§2); hardening batch shipped | A 12-dimension audit of the shipped schema (migrations `00001`–`00036`) and the target data design behind the Data Sensemaker and Project Ortelius canvases. §2 is still the data constitution. |
| [`DESIGN_INTENT.md`](DESIGN_INTENT.md) | 2026-07-04 | Reference — the prototype's intent and the constitution rules | The per-theme dossier of what the product is supposed to be, distilled from the `onboarding-proto` repo. The naming and voice rules ("The Labs", "Poderator") are stated here. |
| [`GAP_AUDIT.md`](GAP_AUDIT.md) | 2026-07-04 | Historical | Row-by-row verdicts (parity / partial / missing / diverged) of OLOS against `DESIGN_INTENT.md`, taken at `dev` @ PR #144. Appendix A crosswalks the Pod Squad memo. |
| [`IMPROVEMENT_ROADMAP.md`](IMPROVEMENT_ROADMAP.md) | 2026-07-05 | Historical plan (Phases 0–7); open decisions moving to the vault | The reconciled build sequence. Its owner-decision queue is the backfill list for the vault (framework §2; issue #405). |
| [`PROGRESS.md`](PROGRESS.md) | 2026-07-05 | Historical (bannered 2026-09-15) — superseded by [`../roadmap/2026-09-audit.md`](../roadmap/2026-09-audit.md) | A status snapshot against `IMPROVEMENT_ROADMAP.md` through PR #157/#161. |
| [`SOCIAL_LAYER_ANALYSIS.md`](SOCIAL_LAYER_ANALYSIS.md) | 2026-07-07 | Reference + workstreams (A–D) feeding Sprint 2 | The audit of the directory, profiles, roles, and interaction primitives after PR #205, with candidate workstreams for the roadmap's Phase 3–5 slots. Its §9 open questions are also vault backfill. |

## How it fits

These audits were the plan of record from July to September 2026. The chain of supersession:

- `IMPROVEMENT_ROADMAP.md` replaced the Stage-C list in
  [`../PROTO_TRANSLATION_PLAN.md`](../PROTO_TRANSLATION_PLAN.md) and the live remnants of
  [`../OLOS-roadmap.md`](../OLOS-roadmap.md) (both now Superseded / Historical in the map).
- [`../roadmap/2026-09-audit.md`](../roadmap/2026-09-audit.md) supersedes `PROGRESS.md`
  (bannered 2026-09-15) and, as the assessment behind the current plan, the phase plan in
  `IMPROVEMENT_ROADMAP.md`. The plan of record is now
  [`../roadmap/next-sprint.md`](../roadmap/next-sprint.md).
- Still read as current: `DATA_ARCHITECTURE.md` §2 (the data principles), `DESIGN_INTENT.md`
  (intent and constitution rules), and the `SOCIAL_LAYER_ANALYSIS.md` workstreams. Everything
  else here is "true on its date".

The next audit goes in `docs/roadmap/` as a dated file ("one dated audit per phase", framework
§3.3). When it lands, this folder flips to `mirror+prune` in the manifest and is swept to the
knowledge repo ([`../roadmap/documentation-topology.md`](../roadmap/documentation-topology.md)
§2.1).

## Open issues in this area (snapshot 2026-10-02)

Live view: [all open issues](https://github.com/TheUpskillingLabs/OLOS/issues).

- [#409](https://github.com/TheUpskillingLabs/OLOS/issues/409) — Fix the remaining stale lines in canonical docs and record phase completion in the PRDs (`priority/p2, size/s`)
- [#405](https://github.com/TheUpskillingLabs/OLOS/issues/405) — Backfill the five un-recorded architectural decisions (ADR-0004…0008) and the open decision queues into `docs/vault/` (`priority/p1`)

This list is a snapshot; the live view above is the truth. Refreshed at each sprint boundary
([`../roadmap/documentation-framework.md`](../roadmap/documentation-framework.md) §9.1).

## Before you change something

- Do not edit an audit's findings. If a doc here is superseded, add the historical banner,
  verbatim from framework §3.3, with the date and a link to what replaced it. That is the only
  permitted edit.
- New findings go in a new dated audit under `docs/roadmap/`, registered in the doc map. Open
  decisions found in an audit go to the vault (until PR #391 merges, to a *Decision needed*
  issue).
- `npm run check:docs` runs the relative-link check; `docs-check` fails a PR that adds a doc
  under `docs/` without touching [`../README.md`](../README.md).
- Copy rules apply to prose too: "The Labs" (never "TUL"), "Upskiller", "Poderator". No names
  of real participants; the repository is public.
- Branch and PR workflow: [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md).
