# Running Claude Code agent teams on OLOS

[Agent teams](https://code.claude.com/docs/en/agent-teams) let one Claude Code session
(the *lead*) spawn several teammates that work in parallel, each in its own context,
coordinating through a shared task list. This repo is set up to make that productive.
It's an **experimental** feature and **off by default**.

## Enable it (owner-local)

The enabling env var is intentionally **not** checked in, so contributors aren't opted
into an experimental feature. Turn it on for yourself by adding it to your gitignored
`.claude/settings.local.json` in the repo:

```json
{ "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" } }
```

(or to your global `~/.claude/settings.json`). What *is* checked in and shared with
everyone: the pre-approved permissions and the migration-guard hook in
`.claude/settings.json`, and the teammate role definitions in `.claude/agents/`.

## What's already wired up

- **Pre-approved permissions** (`.claude/settings.json`) — teammate permission prompts
  bubble up to the lead and stall the team, so the safe dev commands (lint / test /
  build / `check:migrations` / read-only git) are pre-allowed. Mutating git
  (`push`/`commit`) is deliberately left prompting so the lead controls it.
- **Migration-guard hook** — a `TaskCompleted` hook runs `check:migrations`, so a
  teammate can't mark a task done if it introduced a duplicate migration number.
- **Role definitions** (`.claude/agents/`) — spawn a teammate "using the `backend`
  agent type", etc. Each role has a scoped tool set and points at the right area docs.
- **Context for teammates** — teammates read `CLAUDE.md` (root + the nested ones) but
  **not the lead's conversation history**. Put task-specific detail in the spawn prompt.

## File-ownership map (avoid conflicts)

Two teammates editing one file overwrite each other. Hand each teammate a
non-overlapping zone — these match the roles in `.claude/agents/` and the
"Working in parallel" section of [CONTRIBUTING.md](../CONTRIBUTING.md):

| Zone (`agent type`) | Owns | Watch out for |
|---|---|---|
| `frontend` | `app/components/`, dashboard/public/auth page + client components, `globals.css` | `app/components/ui/form.tsx` is shared — one owner at a time |
| `backend` | `app/api/**`, `lib/**` server logic | the enrollment/moderator/admin area is a **single-owner** zone (see below) |
| `migrations` | `supabase/migrations/`, `SCHEMA.md` | claim the migration number first |
| `docs` | `docs/**`, top-level `*.md` | `SCHEMA.md` usually belongs to `migrations` |
| `reviewer` | read-only, no edits | give each reviewer a distinct lens |

**Single-owner zone:** the enrollment / moderator / admin surface (`lib/enrollment/`,
`lib/moderator/`, `app/api/admin/pods/`, `app/api/moderator/pods/`) is tightly coupled —
issues #110, #115, #117, #123, #125, #179 all touch it. Assign it to **one** `backend`
teammate; don't parallelize inside it.

## Example spawn prompts

**Parallel PR review** (the strongest starter use case — no code written):
```
Spawn three reviewer teammates on PR #NNN, each a different lens:
one security, one performance, one test coverage. Have them report findings
with file:line and severity, then synthesize.
```

**Forms polish** (isolated-enough to parallelize, with one shared-file caveat):
```
Spawn a frontend teammate to take the form issues: #105 (LinkedIn href hardening),
#106 (form ARIA), #99 (propose-form → react-hook-form). #106 and #96 both touch
form.tsx, so keep those on one teammate. Require plan approval before edits.
```

**Cross-layer feature** (frontend + backend + migration, cleanly split):
```
Spawn a backend teammate, a frontend teammate, and a migrations teammate to add
<feature>. The migrations teammate writes the schema and claims its number first;
backend wires the API; frontend builds the UI. Wait for all three before merging.
```

## Good to know (from the feature's limitations)

- **One team per session; no nested teams** — only the lead spawns teammates.
- **Start with research/review** before parallel implementation — clearer boundaries.
- **Wait for teammates** — if the lead starts doing the work itself, tell it to wait.
- **Approve permission prompts on the lead**, not the teammate — a teammate can't
  approve on your behalf.
- Teammates use **significantly more tokens** than one session. Start with 3–5.
