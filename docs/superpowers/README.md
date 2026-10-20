# `docs/superpowers/` — a historical design-spec folder (one file)

| | |
|---|---|
| **What this is** | A folder holding one implementation design spec, written 2026-05-22 for the Poderator dashboard. It is historical: the dashboard was built from it and then re-pointed from pulse checks to Learning Logs. |
| **Zone / owner** | `docs` zone (`docs/**`; [`../agent-teams.md`](../agent-teams.md) "File-ownership map"); docs owner. |
| **Conventions** | Do not add files here. The folder is named for the tooling that produced the spec, not for anything in OLOS; nothing else in the repo refers to it beyond the doc map and the publish manifest. Its one file is Historical: not edited, except to add a banner. |
| **Last verified** | 2026-10-02 |

## What is here

| File | Date | Status | What it is |
|---|---|---|---|
| [`specs/2026-05-22-poderator-dashboard-design.md`](specs/2026-05-22-poderator-dashboard-design.md) | 2026-05-22 | Historical (built; re-pointed to Learning Logs) | The implementation design derived from [`../PRD-moderator-dashboard.md`](../PRD-moderator-dashboard.md): scope, pages (`/moderator`, `/moderator/pods/[pod_id]`), API routes, DB migrations (its `00023`–`00026` numbers are historical), components, data fetching, auth, edge cases, and the Poderator-vs-`moderator` naming convention. One phase; no in-app LLM. |

## How it fits

The spec sits between the PRD and the code.
[`../PRD-moderator-dashboard.md`](../PRD-moderator-dashboard.md) says what and why (its §10
decisions still govern); this spec said how; and
[`../poderator-dashboard/CLAUDE.md`](../poderator-dashboard/CLAUDE.md) carries the conventions
that survived into the code. The dashboard as it is today, and its open issues, are in
[`../poderator-dashboard/README.md`](../poderator-dashboard/README.md).

The file is `mirror+prune` in [`../publish.manifest.json`](../publish.manifest.json), bound for
`olos/archive/prds/` in the knowledge repo; the monthly sweep PR removes it from OLOS once the
knowledge repo holds it
([`../roadmap/documentation-topology.md`](../roadmap/documentation-topology.md) §2.1 and §4).
This folder then empties, and this README goes with it.

**Where new design work goes now** (verified against the topology doc's §3 layout):

| Artifact | Goes in |
|---|---|
| Wireframes, and the wireframe → ticket checklist | the team knowledge repo (`TheUpskillingLabs/Docs-repository`), folder `program/design/`, hand-authored by the program and success team. The definition of done asks for a wireframe before a new page or mode ([`../roadmap/documentation-framework.md`](../roadmap/documentation-framework.md) §5; [`../../AGENTS.md`](../../AGENTS.md)). |
| An engineering design doc for a buildable slice | [`docs/requirements/`](../requirements/README.md), with the status header (framework §3.3). |
| The decision behind a design | a vault note (`docs/vault/`, PR #391); until it merges, the slice's requirements doc. |
| A finished spec the build has moved past | left where it is with a banner; the sweep archives it. Never a new file here. |

## Open issues in this area (snapshot 2026-10-02)

Live view: [all open issues](https://github.com/TheUpskillingLabs/OLOS/issues).

No issue is filed against this folder. The surface the spec describes is tracked in
[`../poderator-dashboard/README.md`](../poderator-dashboard/README.md) ("Open issues in this
area").

This list is a snapshot; the live view above is the truth. Refreshed at each sprint boundary
([`../roadmap/documentation-framework.md`](../roadmap/documentation-framework.md) §9.1).

## Before you change something

- Do not. If the spec is cited wrongly somewhere, fix the citation, not the spec.
- If it needs the historical banner, use the text from framework §3.3 verbatim and nothing
  else.
- A new spec goes where the table above says; register it in [`../README.md`](../README.md)
  (`docs-check` fails a PR that adds a doc under `docs/` without touching the map) and run
  `npm run check:docs`.
- Copy rules: "The Labs" (never "TUL"), "Upskiller", "Poderator" in rendered copy
  (`moderator` in code). No names of real participants.
- Branch and PR workflow: [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md).
