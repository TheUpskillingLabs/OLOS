# `.claude/` — shared Claude Code configuration: agent roles, hooks, permissions

| | |
|---|---|
| **What this is** | The checked-in Claude Code settings every contributor and agent session inherits: five teammate role definitions, a session-start hook, and the pre-approved command list. |
| **Zone / owner** | Not a zone in the [file-ownership map](../docs/agent-teams.md#file-ownership-map-avoid-conflicts); the roles in `agents/` *are* that map's zones. Owned by the maintainers. |
| **Conventions** | No `CLAUDE.md` here (the project-level one is [`../CLAUDE.md`](../CLAUDE.md)). `settings.json` is shared and tracked; personal overrides go in the gitignored `settings.local.json`. A role owns a non-overlapping set of paths; two roles never edit one file. |
| **Last verified** | 2026-10-02 |

## What is here

| Path | What it does | Notes |
|---|---|---|
| [`agents/backend.md`](agents/backend.md) | Server logic: route handlers under `app/api/` and the `lib/` modules. Not UI components or SQL migrations. | Coordinates with `migrations` for schema. |
| [`agents/docs.md`](agents/docs.md) | Markdown under `docs/` and the top-level `*.md` files; keeps doc work off the code teammates' branches. | `SCHEMA.md` usually belongs to `migrations`. |
| [`agents/frontend.md`](agents/frontend.md) | React components, signed-in dashboard pages, design-system styling: `app/components/` and the page/client components under `app/(dashboard)`, `app/(public)`, `app/(auth)`. Not API routes or `lib/`. | `app/components/ui/form.tsx` is shared: one owner at a time. |
| [`agents/migrations.md`](agents/migrations.md) | SQL migrations under `supabase/migrations/` and keeping `SCHEMA.md` in sync; owns DDL. | Claims the migration number on the issue first. |
| [`agents/reviewer.md`](agents/reviewer.md) | Read-only review through one lens (correctness, security, performance, or test coverage); reports findings with `file:line` and severity, edits nothing. | Spawn several with different lenses for a PR. |
| [`hooks/session-start.sh`](hooks/session-start.sh) | `SessionStart` hook. On Claude Code on the web only (`CLAUDE_CODE_REMOTE=true`) it runs `npm install --no-audit --no-fund` in the project so `npm test`, `npm run lint`, and `npx tsc --noEmit` work; local sessions exit immediately. | Synchronous and idempotent by design. |
| [`settings.json`](settings.json) | Pre-approves the safe commands (`npm run lint/test/build/check:migrations`, `npx tsc --noEmit`, `npx eslint`, `npx vitest`, `node scripts/check-migration-numbers.mjs`, read-only `git status/diff/log/show/branch`) and wires two hooks: `SessionStart` → the script above; `TaskCompleted` → `node scripts/check-migration-numbers.mjs || exit 2`, so a task that introduced a duplicate migration number cannot be marked done. | No secrets, no env values. Mutating git (`commit`, `push`) is deliberately left prompting. |
| `settings.local.json` | Your personal overrides, e.g. the agent-teams enabling flag. | Gitignored; never committed. |

## How it fits

Every session reads [`../CLAUDE.md`](../CLAUDE.md) (which imports the orientation block in
[`../AGENTS.md`](../AGENTS.md)) and the area `CLAUDE.md` files; teammates spawned from
`agents/` read those too but not the lead's conversation, so task detail goes in the spawn
prompt. How to enable and run teams, with spawn prompts and the ownership map, is in
[`docs/agent-teams.md`](../docs/agent-teams.md). The `TaskCompleted` hook calls the same
checker CI runs ([`scripts/check-migration-numbers.mjs`](../scripts/check-migration-numbers.mjs)).
The weekly docs steward is a separate, GitHub-hosted Claude job in
[`.github/workflows/docs-steward.yml`](../.github/workflows/docs-steward.yml).

## Open issues in this area (snapshot 2026-10-02)

Live view: [all open issues](https://github.com/TheUpskillingLabs/OLOS/issues).

- [#401](https://github.com/TheUpskillingLabs/OLOS/issues/401) — Adopt the planning layer: open the roadmap branch as a PR into dev; merge #391; close #390 (`priority/p1`)
- [#411](https://github.com/TheUpskillingLabs/OLOS/issues/411) — Turn on the docs steward (secret or Claude Routine) and run the first weekly triage (`priority/p2`)

This list is a snapshot; the live view above is the truth. Refreshed at each sprint
boundary ([`docs/roadmap/documentation-framework.md` §9.1](../docs/roadmap/documentation-framework.md#91-the-sprint-boundary-refresh-onboarding-is-part-of-the-update-process)).

## Before you change something

- Nothing here has a test; after editing `settings.json` or the hook, start a fresh
  session and confirm the hook ran and the pre-approved commands do not prompt.
- Add to `permissions.allow` only commands that cannot change the repo or the remote;
  keep `git commit` / `git push` prompting so the lead controls them.
- When a role's paths change, update the ownership map in
  [`docs/agent-teams.md`](../docs/agent-teams.md) and the "Working in parallel" rules in
  [`CONTRIBUTING.md`](../CONTRIBUTING.md#working-in-parallel) in the same PR.
- Experimental flags stay out of `settings.json`; put them in `settings.local.json`.
- Role prompts carry the repo rules: "The Labs" (never "TUL"), "Upskiller", "Poderator";
  no in-app LLM, no activity telemetry, nothing that shames a member who is behind.
- Workflow: branch off `dev`, one issue, one PR — [`CONTRIBUTING.md`](../CONTRIBUTING.md).
