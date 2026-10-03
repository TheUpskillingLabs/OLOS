# Onboarding — joining the OLOS team

| | |
|---|---|
| **Status** | Canonical SOP for a new contributor (developer, success, programs); refreshed at every sprint boundary |
| **Owner** | Docs owner (`docs/roadmap/documentation-framework.md` §9); the maintainer who invited you is your first contact |
| **Last verified** | 2026-10-02 |

Welcome. This page is the one place that answers "where is everything and what do I do
first". It is deliberately short; every row links to the document that holds the detail.

## Day one (about an hour)

- [ ] **Access.** A GitHub invitation to `TheUpskillingLabs` (ask the maintainer; the org's
      invite runbook is [#456](https://github.com/TheUpskillingLabs/OLOS/issues/456)); the
      Slack workspace and the `#help-*` channels ([#455](https://github.com/TheUpskillingLabs/OLOS/issues/455));
      a row in the dev `participants` table so you can sign in locally (`docs/environments.md`);
      1Password access for the dev keys. The private team knowledge repository
      (`TheUpskillingLabs/Docs-repository`) holds everything that is not in this repo.
- [ ] **Run it.** `CONTRIBUTING.md` → Setup. `nvm use && npm install`, copy the env template,
      `npm run dev`, sign in with Google. Run `npm run lint && npm run test && npm run build` once.
- [ ] **Read, in this order** (ten minutes): the sprint plan
      [`docs/roadmap/next-sprint.md`](docs/roadmap/next-sprint.md) (§1 the framing, §3 the
      workstreams, §10 the issue map); the doc map [`docs/README.md`](docs/README.md); the
      hand-off brief [`docs/roadmap/handoff-2026-09-28-onboarding-journeys.md`](docs/roadmap/handoff-2026-09-28-onboarding-journeys.md)
      §0–§3 if you will build one of its lanes; `DESIGN_SYSTEM.md` §voice if you will write
      any copy.
- [ ] **Pick your ticket** with the maintainer (below), comment "claiming" on it, and branch
      off `origin/dev` with the branch name the issue gives.

## Where everything lives

| Question | Answer |
|---|---|
| What are we building, and when? | [`docs/roadmap/next-sprint.md`](docs/roadmap/next-sprint.md); the [issue tracker](https://github.com/TheUpskillingLabs/OLOS/issues) is the live view, organised as epics (`epic` label) with sub-issues |
| Why is it built this way? | `docs/vault/` (decision records, MADR shape) once [#391](https://github.com/TheUpskillingLabs/OLOS/pull/391) merges; until then the decision tables in the PRDs and `docs/roadmap/2026-09-audit.md` §3 |
| How is the code organised? | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); the `CLAUDE.md` next to each area |
| What is in this folder, and what is open against it? | the `README.md` in the folder: every top-level folder and route group has one (what is there, how it fits, the rules, the open issues as a dated snapshot with the live link beside it) |
| What does the database look like? | [`SCHEMA.md`](SCHEMA.md); migrations in `supabase/migrations/` (claim a number on your issue before writing one) |
| Who are we building for? | [`docs/roadmap/personas-and-journeys.md`](docs/roadmap/personas-and-journeys.md); the sprint's persona is [`docs/roadmap/pre-registration-persona.md`](docs/roadmap/pre-registration-persona.md) |
| What does "done" mean? | [`docs/roadmap/documentation-framework.md`](docs/roadmap/documentation-framework.md) §5 and the PR template; CI (`lint`, `test`, `build`) and `docs-check` enforce the mechanical half |
| What shipped, when? | [`CHANGELOG.md`](CHANGELOG.md) |
| What did a past session do? | [`docs/sessions/`](docs/sessions/) for this sprint; `olos/sessions/` in the knowledge repo for everything earlier |
| Where is the design system and the copy voice? | [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md); wireframes live in the knowledge repo under `program/design/` |
| Where do program materials live (curriculum, research, meetings)? | The knowledge repo: `program/curriculum/`, `program/research/`, `governance/` |

## How work is organised

- **Sprints** of about six weeks, planned in `next-sprint.md`; the owner ratifies the
  decisions in its §7; the status table in §8 is updated at the weekly triage.
- **Epics and sub-issues.** An epic is a workstream (for example *Workstream A: the
  between-cycles experience*, [#393](https://github.com/TheUpskillingLabs/OLOS/issues/393)).
  Each sub-issue is one branch, one PR, sized `s` (a day), `m` (three days), or `l` (a week).
- **Lanes.** When several people build in parallel, the hand-off brief assigns each a lane
  with the files it owns, so two branches never edit the same file. Read §6–§8 before you
  start a lane; the single-owner zone (`lib/enrollment/`, `lib/moderator/`, the pod admin
  routes) is one person at a time.
- **Decisions** that change the build are recorded as vault notes, never only in chat.
  If you find yourself choosing between two designs, write the note (the template is
  `.github/ISSUE_TEMPLATE/decision.md` for an issue; `docs/vault/CLAUDE.md` for the note).

## Picking up a ticket

1. Read the issue, its parent epic, and the brief's lane if it has one. Ask one question in
   a comment if the scope is unclear; silence is not agreement.
2. Comment "claiming", branch off `origin/dev` with the issue's branch name, and open a
   draft PR early (title shaped like a Conventional Commit: `feat(public): …`).
3. Keep the PR to the issue's scope; file a new issue for anything you find on the way.
4. Before asking for review: CI green, `npm run check:docs` green, a `CHANGELOG.md` line
   for code, screenshots (phone and desktop) in the PR, a vault note if you chose between
   designs, and a session report in `docs/sessions/` for the session that did the work.
5. A maintainer reviews and squash-merges into `dev`; `dev` deploys to a Vercel preview;
   a maintainer promotes `dev → main` separately.

## Good first tickets

Issues labelled [`good first issue`](https://github.com/TheUpskillingLabs/OLOS/issues?q=is%3Aopen+label%3A%22good+first+issue%22)
are self-contained, one file or two, with the acceptance written out. Public-page work is
the easiest place to start: the pages are static or read one table, the design system
carries the styling, and the copy rules are short.

## Rules that are not optional

- Never push to `dev` or `main`; never rewrite someone else's branch.
- Copy: "The Upskilling Labs" or "The Labs" (never "TUL"); "Upskiller"; "Poderator".
- No names of real participants in anything committed — this repository is public.
- No in-app LLM features; no activity telemetry; nothing that shames a member who is behind.
- In new code, cycle facts are data, not code: a cycle's dates, audience and copy come from
  its database rows through one helper, never a constant naming a cycle or season
  (`docs/requirements/cycle-4-readiness.md` §8).
- Secrets never leave this repo's `.env*.local` files or 1Password.

## Who to ask

- Your inviting maintainer, first. Then `#help-olos` in Slack.
- Program questions (the cycle, the curriculum, the Showcase): the success team.
- Anything about a decision: the vault note, then its owner.
