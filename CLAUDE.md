@AGENTS.md

## Branch discipline

**Never commit or push to `dev` or `main` directly.** Every change goes on a feature branch and into `dev` via a PR; promotion to `main` is its own `dev` → `main` PR. The only exception is when the user *explicitly* asks to push a specific change straight to `dev` or `main` in that moment — otherwise, always branch + PR. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.

## Knowledge capture (Obsidian vault)

Durable build knowledge goes in the in-repo Obsidian vault at [`docs/vault/`](docs/vault/), not only in a PR comment. Write the note **in the same PR as the change it explains**, and write one whenever:

- **A decision gets made** that a future reader could reasonably question, or that closes an option off: a record in `docs/vault/decisions/` (`ADR-NNNN-slug.md`).
- **The build moves away from the spec** (`TUL_MVP_Spec.md`, a PRD in `docs/`, or `docs/OLOS-roadmap.md`): a note in `docs/vault/divergence/`, wikilinked to the decision that caused it and linked back from it.
- **A repeatable procedure gets figured out** that would otherwise be re-derived: a runbook in `docs/vault/workflows/`.

The vault records **why**, never **what**: nothing that the code, `SCHEMA.md`, a migration, or a directory's own `CLAUDE.md` already answers. No task lists, no in-progress state, no session narration. A decision that stops holding is marked `superseded` and kept, never deleted or rewritten, because the evolution away from the PRD is the thing being preserved.

Conventions, frontmatter, naming, and templates: [docs/vault/CLAUDE.md](docs/vault/CLAUDE.md).

## Orientation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the codebase is organized (App Router, `lib/`, migrations, core concepts).
- [CONTRIBUTING.md](CONTRIBUTING.md) — setup, the branch/PR workflow, and the "Working in parallel" rules (file ownership, claiming migration numbers).
- [docs/agent-teams.md](docs/agent-teams.md) — running Claude Code agent teams on this repo (roles in `.claude/agents/`, ownership map, spawn prompts).

## Subdocs

- [docs/vault/CLAUDE.md](docs/vault/CLAUDE.md) — the decision vault: what counts as a decision, divergence, or workflow note, how notes are named and linked, and what must never go in them. Read before writing into `docs/vault/`.
- [lib/auth/CLAUDE.md](lib/auth/CLAUDE.md) — sign-in flow, role resolution, invitation flow, and the `TUL_MVP_Spec.md`-vs-implementation deviations (Issues #44, #45). Read before touching anything in `lib/auth/`, `app/api/auth/`, `app/(auth)/`, or `lib/email/`.
- [docs/poderator-dashboard/CLAUDE.md](docs/poderator-dashboard/CLAUDE.md) — naming conventions, route structure, new DB tables, auth integration, and build order for the Poderator dashboard. Read before touching `app/(dashboard)/moderator/` or any `00019`+ migration.
