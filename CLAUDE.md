@AGENTS.md

## Branch discipline

**Never commit or push to `dev` or `main` directly.** Every change goes on a feature branch and into `dev` via a PR; promotion to `main` is its own `dev` → `main` PR. The only exception is when the user *explicitly* asks to push a specific change straight to `dev` or `main` in that moment — otherwise, always branch + PR. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.

## Orientation

The reading order for any session is in [AGENTS.md](AGENTS.md) (imported above): the current sprint, your issue and its epic, the hand-off brief when your issue is one of its lanes, the doc map, the area `CLAUDE.md`. The links below are the same places, with the Claude-specific notes.

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the codebase is organized (App Router, `lib/`, migrations, core concepts).
- [CONTRIBUTING.md](CONTRIBUTING.md) — setup, the branch/PR workflow, and the "Working in parallel" rules (file ownership, claiming migration numbers).
- [docs/agent-teams.md](docs/agent-teams.md) — running Claude Code agent teams on this repo (roles in `.claude/agents/`, ownership map, spawn prompts).
- [docs/roadmap/README.md](docs/roadmap/README.md) — the current plan of record: the September 2026 audit, the sprint plan, personas, the documentation contract, and the data strategy. Read `documentation-framework.md` there before opening a PR — every PR needs a `CHANGELOG.md` line and, when a choice was made, a decision note.
- [docs/README.md](docs/README.md) — the doc map: which of the ~80 documents are canonical, plan-of-record, historical, or archived.
- [docs/roadmap/documentation-topology.md](docs/roadmap/documentation-topology.md) — what stays in OLOS and what publishes to the private team knowledge repo (`docs/publish.manifest.json`). **End every substantive session with a report in `docs/sessions/`** (template in its README) — it is the artifact of what was completed and travels to the team repo on merge.

## Subdocs

- [lib/auth/CLAUDE.md](lib/auth/CLAUDE.md) — sign-in flow, role resolution, invitation flow, and the `TUL_MVP_Spec.md`-vs-implementation deviations (Issues #44, #45). Read before touching anything in `lib/auth/`, `app/api/auth/`, `app/(auth)/`, or `lib/email/`.
- [docs/ambassadors/CLAUDE.md](docs/ambassadors/CLAUDE.md) — the Ambassador role: apply flow, guide, deck, coordinator queue (Lab leads), and the `00104` tables. Read before touching `app/(dashboard)/ambassador/`, `app/api/ambassadors/`, `lib/ambassador/`, or `00104`.
- [docs/poderator-dashboard/CLAUDE.md](docs/poderator-dashboard/CLAUDE.md) — naming conventions, route structure, new DB tables, auth integration, and build order for the Poderator dashboard. Read before touching `app/(dashboard)/moderator/` or any `00019`+ migration.
