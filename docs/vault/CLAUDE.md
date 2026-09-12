# The OLOS vault: conventions

This folder is an **Obsidian vault** as well as a folder of markdown in the repo.
Open `docs/vault/` directly as a vault in Obsidian (File > Open folder as vault) and
the wikilinks, tags, and graph view all work with no export step. Because it lives
in the repo, every note travels in the PR that caused it and is reviewable there.

Read this file before writing into `docs/vault/`.

## What goes here, and what does not

Three kinds of note, one folder each:

| Folder | Note kind | Write one when |
|---|---|---|
| `decisions/` | Decision record (ADR) | A choice was made that a future reader could reasonably question, or that closes an option off |
| `divergence/` | PRD divergence | The build moves away from `TUL_MVP_Spec.md`, a PRD, or the roadmap |
| `workflows/` | Workflow / runbook | A repeatable procedure got figured out and would otherwise be re-derived |

**Do not write here:**

- Anything already true in the code, `SCHEMA.md`, or a migration. The vault records *why*, never *what*. If `cat` on a file answers the question, there is no note to write.
- In-progress state, task lists, or "next steps". Those belong in issues and PRs.
- Session narration ("tried X, then Y"). A decision note records the conclusion and the reasoning that survives, not the path taken.
- Anything already covered by a `CLAUDE.md`. If the guidance is *"how to work in this directory"*, it belongs in that directory's `CLAUDE.md`, not the vault.

One note per subject. Update an existing note rather than adding a near-duplicate.

## Naming

- Decisions: `decisions/ADR-NNNN-short-slug.md`, four digits, never reused. Claim the next number by listing the folder; if two branches collide, the second to merge renumbers.
- Divergence: `divergence/area-slug.md`, named for the spec area it diverges from (`divergence/auth-jwt-to-ssr-cookies.md`), not for the date.
- Workflows: `workflows/verb-object.md` (`workflows/claim-a-migration-number.md`).

Lowercase, hyphenated, no spaces in filenames. The human-readable name goes in frontmatter `title` and the H1.

## Frontmatter

Every note carries frontmatter. Obsidian reads `tags` and `aliases`; the rest is for humans and for future Claude sessions.

```yaml
---
title: Invitation email delivered via Resend HTTP API
date: 2026-05-08
status: accepted        # proposed | accepted | superseded
kind: decision          # decision | divergence | workflow
tags: [auth, email]
related: ["[[divergence/auth-jwt-to-ssr-cookies]]"]
---
```

Rules:

- `date` is the date the decision was made or the workflow was verified, in `YYYY-MM-DD`. Absolute dates only, never "last week".
- `status` on a decision is never edited to `wrong`. A decision that no longer holds becomes `superseded`, with a `superseded_by` wikilink, and the new decision gets `supersedes` pointing back. **The old note stays.** The point of the vault is that the evolution is legible, so deleting the history defeats it.
- `tags` come from the vocabulary in [[index]]. Add a tag there before inventing one.

## Linking, and what the graph is for

The graph view is the deliverable, not a side effect. It only tells you anything if the links are real, so:

- A divergence note **must** link the decision that caused it, and the decision **must** link back.
- A decision that supersedes another **must** use `supersedes` / `superseded_by`. This is what makes a chain of decisions visible as a chain.
- Link to the spec or PRD the note reacts to by repo path in the body (`TUL_MVP_Spec.md` §4.2), and to other notes by wikilink (`[[ADR-0007-slack-outbound-only]]`).
- Do not link for the sake of density. An unmotivated link is noise in the graph.

Wikilinks resolve inside the vault only. To point at code or docs outside it, use a normal relative markdown link (`../ARCHITECTURE.md`) so it works on GitHub too.

## Templates

Copy from `templates/` rather than writing frontmatter from scratch:

- `templates/decision.md`
- `templates/divergence.md`
- `templates/workflow.md`

Obsidian's Templates core plugin can be pointed at `templates/` for one-keystroke insertion.

## Timing

Write the note **in the same PR as the change it explains**. A decision recorded a week later has already lost the alternatives that were live at the time, which is the part worth keeping.

If a decision is made in conversation with no code change attached, it still gets a note: open a branch for the note alone.
