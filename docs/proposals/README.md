# `docs/proposals/` — one historical plan; nothing new goes here

| | |
|---|---|
| **What this is** | A legacy folder holding one finished plan, the Luma-driven event pages (2026-07-31). The folder is not in the folder plan of [`../roadmap/documentation-framework.md`](../roadmap/documentation-framework.md) §3.3 and should not grow. |
| **Zone / owner** | `docs` zone (`docs/**`; [`../agent-teams.md`](../agent-teams.md) "File-ownership map"); docs owner. |
| **Conventions** | Do not add files. "Proposal" is a *status* in the doc map, not a folder: a document awaiting ratification lives where its kind belongs (`docs/roadmap/` for a plan, `docs/requirements/` for a slice) with `Proposal` in its status header, and a decision awaiting ratification becomes a vault note with `status: proposed` once `docs/vault/` lands (PR #391). |
| **Last verified** | 2026-10-02 |

## What is here

| File | Date | Status | What it is |
|---|---|---|---|
| [`luma-driven-event-pages.md`](luma-driven-event-pages.md) | 2026-07-31 | Historical — phases 1–4 done | The plan that made Luma the single source of truth for event-page copy (owner decision, July 2026), retired the bespoke hackathon route, and improved the shared `/events/[slug]` renderer. Phases 1–3 merged in PR #335; phase 4 retired the route. |

## How it fits

The plan is done. The direction it recorded is stated in the header comment of
`lib/integrations/luma.ts` ("Luma is the source of truth for ALL events") and lives in the
event pages under `app/(public)/events/`. The file is listed in
[`../publish.manifest.json`](../publish.manifest.json) as `mirror+prune` to
`olos/archive/plans/` in the knowledge repo, so the monthly sweep PR removes it from OLOS once
the knowledge repo holds it
([`../roadmap/documentation-topology.md`](../roadmap/documentation-topology.md) §2.1 and §4).
When that happens, this README goes with it and the folder is dropped from the doc map.

Where a new proposal goes instead:

| You are proposing… | Put it in | Status |
|---|---|---|
| a plan, audit, or strategy for the next phase | `docs/roadmap/` ([`../roadmap/README.md`](../roadmap/README.md) lists the current ones) | `Proposal` in the status header |
| a buildable slice | `docs/requirements/` ([`../requirements/README.md`](../requirements/README.md)) | `Draft — for review` or `Proposal` |
| a single decision the owner must ratify | `docs/vault/decisions/ADR-NNNN-slug.md` once PR #391 merges; until then a *Decision needed* issue | frontmatter `status: proposed`, with `owner:` and `decide_by:` (framework §2) |

## Open issues in this area (snapshot 2026-10-02)

Live view: [all open issues](https://github.com/TheUpskillingLabs/OLOS/issues).

- [#182](https://github.com/TheUpskillingLabs/OLOS/issues/182) — Migrate marketing site onto OLOS and sunset the separate Squarespace site
- [#437](https://github.com/TheUpskillingLabs/OLOS/issues/437) — S2.4 — One calendar: Stage 2 page sweep, drop the mirror and legacy columns, retire `anchor-events.ts`, upsert anchors from `cycle_events` (`priority/p2, size/l`)

Both touch the public pages and the Luma-synced events the plan built on; neither is work in
this folder.

This list is a snapshot; the live view above is the truth. Refreshed at each sprint boundary
([`../roadmap/documentation-framework.md`](../roadmap/documentation-framework.md) §9.1).

## Before you change something

- Do not add a file here; use the table above.
- The one file is Historical: it is not edited, except to add the banner from framework §3.3.
- If you touch it anyway, run `npm run check:docs`; a new doc under `docs/` must be registered
  in [`../README.md`](../README.md) or `docs-check` fails the PR.
- Copy rules: "The Labs" (never "TUL"), "Upskiller", "Poderator"; no names of real
  participants.
- Branch and PR workflow: [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md).
