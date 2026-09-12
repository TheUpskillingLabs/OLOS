---
title: Build decisions are recorded in an in-repo Obsidian vault
date: 2026-09-12
status: accepted
kind: decision
tags: [meta]
related: []
---

# Build decisions are recorded in an in-repo Obsidian vault

## Context

OLOS accumulates decisions faster than it records them. The reasoning behind several
already-shipped choices survives only in PR comments, issue threads, and a
staleness-flagged roadmap table, and `docs/OLOS-roadmap.md` §6 says so outright. Decisions
that moved the build away from `TUL_MVP_Spec.md` are the worst affected: the spec still
reads as though they never happened, so anyone reading it as truth is misled.

A per-project Obsidian vault was already in use for exactly this purpose, including a
mind map of how decisions evolve away from the PRD. The open question was where that vault
should live relative to the repo.

## Options considered

| Option | Why it was attractive | Why not |
|---|---|---|
| Vault outside the repo (iCloud or Drive) | Already exists; one graph across every project | Notes are not in git, so they are invisible in PRs, unreviewable, and unreachable in a session that has not been granted that folder |
| In-repo folder, `docs/vault/` | Versioned with the code, travels in the PR that caused it, reviewable, always reachable | The graph covers OLOS only |
| Confluence, Notion, or similar | Wider audience | Another surface to keep in sync; drifts from the code immediately |

## Decision

Decision records, PRD-divergence notes, and workflows live in `docs/vault/`, opened
directly as an Obsidian vault. Notes are written in the same PR as the change they explain.

## Why

The failure being fixed is that reasoning drifts away from the code. Anything that lives
somewhere the code review cannot see it will drift again. Putting the notes in the repo
makes "did you record the decision?" a reviewable question in the PR, and makes the notes
readable on GitHub by people who do not use Obsidian.

Obsidian needs nothing from the folder but markdown, so nothing about this choice is
Obsidian-specific and there is no export step to forget.

## Consequences

- Notes are subject to branch discipline: they go on a feature branch and into `dev` via a PR like any other change.
- `docs/vault/.obsidian/` local workspace state is gitignored; shared plugin config, if it is ever added, is not.
- The graph covers OLOS only. If a cross-project graph is wanted later, the existing vault can add `docs/vault/` as a linked folder without moving anything.
- ADR numbers can collide across parallel branches. The second to merge renumbers, which is cheap because wikilinks are few and checkable.

## Links

- Conventions: [CLAUDE.md](../CLAUDE.md)
- Index and tag vocabulary: [[index]]
