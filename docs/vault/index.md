---
title: OLOS vault
date: 2026-09-12
kind: index
tags: [meta]
---

# OLOS vault

The **why** behind OLOS. Code, schema, and migrations record what the system does;
this vault records the decisions that got it there, where it has moved away from the
original spec, and the procedures worth not re-deriving.

Conventions, naming, and templates: [CLAUDE.md](CLAUDE.md).

## Sections

- `decisions/` — decision records, `ADR-NNNN`. One per choice worth questioning later.
- `divergence/` — where the build departs from [`TUL_MVP_Spec.md`](../../TUL_MVP_Spec.md), the PRDs in [`docs/`](../), and [`docs/OLOS-roadmap.md`](../OLOS-roadmap.md).
- `workflows/` — runbooks and repeatable procedures.

## How to read the graph

Open the graph view and the shape to look for is a **divergence note with decisions
hanging off it**: that is a place where the spec and the build have parted ways and the
reasons are recorded. A divergence note with no linked decision is an unexplained drift
and should be treated as a gap to fill, not a finished note.

Chains of `supersedes` / `superseded_by` show a decision evolving. Superseded notes are
never deleted.

## Tag vocabulary

Add to this list before using a new tag, so the graph's tag filters stay useful.

**Area:** `auth`, `email`, `cycle`, `pods`, `projects`, `participants`, `moderator`,
`admin`, `surveys`, `learning-logs`, `pulse-checks`, `events`, `labs`, `content`,
`design-system`, `schema`, `integrations`

**Cross-cutting:** `meta`, `ops`, `security`, `privacy`, `performance`, `testing`,
`deploy`, `spec-divergence`

## Related, outside the vault

- [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) — how the codebase is organized
- [`SCHEMA.md`](../../SCHEMA.md) — the database, generated from migrations
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — branch and PR workflow
- [`docs/audit/`](../audit/) — current-state audits and the improvement roadmap
