@AGENTS.md

## Orientation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the codebase is organized (App Router, `lib/`, migrations, core concepts).
- [CONTRIBUTING.md](CONTRIBUTING.md) — setup, the branch/PR workflow, and the "Working in parallel" rules (file ownership, claiming migration numbers).
- [docs/agent-teams.md](docs/agent-teams.md) — running Claude Code agent teams on this repo (roles in `.claude/agents/`, ownership map, spawn prompts).

## Subdocs

- [lib/auth/CLAUDE.md](lib/auth/CLAUDE.md) — sign-in flow, role resolution, invitation flow, and the `TUL_MVP_Spec.md`-vs-implementation deviations (Issues #44, #45). Read before touching anything in `lib/auth/`, `app/api/auth/`, `app/(auth)/`, or `lib/email/`.
- [docs/poderator-dashboard/CLAUDE.md](docs/poderator-dashboard/CLAUDE.md) — naming conventions, route structure, new DB tables, auth integration, and build order for the Poderator dashboard. Read before touching `app/(dashboard)/moderator/` or any `00019`+ migration.
