# `docs/sessions/` — session reports (the inbox)

| | |
|---|---|
| **Status** | Canonical convention (proposed 2026-09-25; part of [`../roadmap/documentation-topology.md`](../roadmap/documentation-topology.md) §5) |
| **Owner** | Docs owner |
| **Last verified** | 2026-09-25 |

A **session report** is the artifact of one unit of work — a Claude Code session, a
pairing session, a work day — written by whoever ran it, in the PR that carries the
work. It answers, for someone who was not there: what was asked, what was done, what
was verified, what was decided (and where that decision now lives), and what is next.

This folder is an **inbox, not a library.** Reports land here so they are reviewed
with the code; the `publish-artifacts` workflow copies them to the team knowledge repo
on merge, and the monthly sweep PR removes them from OLOS once the knowledge repo holds
them. Only the current sprint's reports are ever here.

## When to write one

- A Claude Code session that produced a PR with more than a trivial change.
- A pairing or planning session that changed the plan of record.
- A work day or testing session (the retro goes in `work-day-improvements.md` or
  `feedback-running-list.md`; the *report* goes here and links to it).

Not for: routine one-line fixes, or anything the PR body already says in full.

## Naming

`YYYY-MM-DD-short-slug.md`. One report per session; if a session spans days, use the
day it ended.

## Template

```markdown
# <Title: what the session was for>

| | |
|---|---|
| **Date** | YYYY-MM-DD |
| **Ran by** | @handle (+ Claude Code session link if applicable) |
| **Branch / PR** | `branch-name` · #PR |
| **Asked** | one or two sentences, in the requester's words |

## What was done

- bullets; each names the files or surfaces touched

## What was verified

- commands run and their results (tests, lint, checks, manual paths exercised)

## Decisions made → where they live

| Decision | Recorded in |
|---|---|
| … | `docs/vault/decisions/ADR-NNNN-…` (or "needs a vault note — issue #N") |

## Open questions / needs from others

- …

## Next

- the concrete next step and who owns it
```

Keep it under two screens. Cite paths, PR numbers, and issue numbers so the report
stays useful after the branch is gone.
