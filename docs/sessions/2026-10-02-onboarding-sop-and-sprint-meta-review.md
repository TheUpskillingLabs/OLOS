# Onboarding SOP, sprint meta-review, and the executive summary

| | |
|---|---|
| **Date** | 2026-10-02 |
| **Ran by** | dev (Claude Code session, lead-architect role) |
| **Branch / PR** | `claude/olos-roadmap-documentation-yjebim` · planning PR [#476](https://github.com/TheUpskillingLabs/OLOS/pull/476) into `dev` (closes [#401](https://github.com/TheUpskillingLabs/OLOS/issues/401)) |
| **Asked** | Review the branch about to merge so the uses of its documents are clear and the commit is structured cleanly; plan the document cleanup; open a ticket for a volunteer developer joining to build the outward-facing pages; make onboarding part of the update process by embedding the reading order in `README.md` / `AGENTS.md`; write a two-page executive summary of the recent changes and the next sprint, with links to the context documents and issues; open the next sprint's tickets so they can be reviewed. |

## What was done

- **Onboarding surfaces.** `ONBOARDING.md` (new, one page: day one, where everything
  lives, how work is organised, picking up a ticket, good first tickets, the rules that
  are not optional, who to ask). `README.md` gained a "Start here" table; `AGENTS.md` an
  "Orientation" block (reading order 1–5 plus the rules), which `CLAUDE.md` imports so
  people and agents read the same thing; `docs/README.md` lists `ONBOARDING.md` and
  routes "new to the repo" through it.
- **The update process.** `docs/roadmap/documentation-framework.md` §9.1: the
  sprint-boundary refresh (README "Start here", AGENTS "Orientation", `ONBOARDING.md`,
  the executive summary) happens in the same PR that re-baselines `next-sprint.md` §8.
  `.github/workflows/docs-steward.yml` step 4 now checks the three files for stale
  pointers and a "Last verified" older than the sprint start.
- **Cleanup plan.** `docs/roadmap/README.md` "Lifecycle of these documents": for each of
  the nine roadmap documents, its job, when it retires, and where it goes (vault,
  knowledge repo, or deleted). The sweep PR at each promotion executes it.
- **Tickets.** [#472](https://github.com/TheUpskillingLabs/OLOS/issues/472) onboarding
  ticket for the volunteer developer (under [#394](https://github.com/TheUpskillingLabs/OLOS/issues/394));
  [#473](https://github.com/TheUpskillingLabs/OLOS/issues/473) and
  [#474](https://github.com/TheUpskillingLabs/OLOS/issues/474) good first issues on
  existing public pages, one file each; the public-pages lane
  [#414](https://github.com/TheUpskillingLabs/OLOS/issues/414) is the third step.
  `next-sprint.md` §8 and §10 record them. Sprint 0 and Sprint 1 were already fully
  ticketed on 2026-09-25 and 2026-09-28 (§10); nothing new was needed there.
- **Executive summary.** Two pages: where we are, what changed in the last three weeks,
  the next sprint, decisions leadership must make, how a new contributor plugs in,
  links in reading order. Shared as a Claude Doc
  (<https://claude.ai/code/artifact/aa0d9358-7f6e-4cbf-8c0b-67427a563f0b>) and copied
  to the knowledge repo as `governance/executive-summaries/2026-10-02-olos-executive-summary.md`.
- **Rebase (later the same day, on the owner's go-ahead).** `git rebase --onto origin/dev 226445a`:
  the branch now carries 13 commits and no inherited merge commits; the tree is byte-identical
  to the pre-rebase head `6934bc2`; force-pushed with lease to `8c0c1e6`.
- **Folder READMEs** (seventeen, written by five parallel agents against a shared spec, every
  claim verified against the code): `app/`, `app/(public)/`, `app/(dashboard)/`, `app/(auth)/`,
  `app/api/`, `app/components/`, `lib/`, `supabase/`, `scripts/`, `.github/`, `.claude/`,
  `docs/audit/`, `docs/requirements/`, `docs/proposals/`, `docs/legal/`, `docs/superpowers/`,
  `docs/poderator-dashboard/`. Each: what is there, how it fits, the rules, the open issues
  (dated snapshot + live label link), what to run before changing it. The root `README.md`
  layout table and `docs/ARCHITECTURE.md` link them; `ONBOARDING.md` points at them; the
  doc map lists the six under `docs/` and the three legal files.
- **Commit-structure review.** A recommendation (not applied): see the decision table and
  the PR description draft handed to the owner.

## What was verified

- `npm run check:docs` on the final tree — see the commit that carries this report
  (result recorded in the PR description).
- Branch facts: `git rev-list --count origin/dev..HEAD` = 21, of which 8 are `dev → main`
  merge commits inherited because the branch forked from `main@226445a`, and 13 are real
  commits; `git diff origin/dev origin/main` is empty, so rebasing onto `origin/dev` is
  conflict-free.
- Issue bodies name no real person; the volunteer is "a volunteer developer".
- After the README pass: `npm run check:docs` green over 125 Markdown files; every file under
  `docs/` (outside archive, sessions, marketing-site) is named in the doc map; the new READMEs
  carry no real names and no model identifiers.

## Decisions made → where they live

| Decision | Recorded in |
|---|---|
| Onboarding is refreshed at every sprint boundary, in the re-baseline PR, and the steward checks it | `documentation-framework.md` §9.1 |
| The planning branch merges as **one squash-merged PR** whose description maps every added document to its purpose and status; before opening it, rebase onto `origin/dev` (`git rebase --onto origin/dev 226445a`, then `git push --force-with-lease`) to drop the eight inherited merge commits | this report; the PR description draft |
| Each roadmap document has a stated retirement path | `docs/roadmap/README.md` lifecycle table |
| The executive summary is a sprint-boundary artifact and lives in the knowledge repo, not in OLOS | `documentation-framework.md` §9.1 |

## Open questions / needs from others

- D1 (next cycle date + theme) was due today; it gates the Showcase slice of #414.
- D10 (the docs owner) — the sprint-boundary refresh needs a named owner.
- Rebase before opening the PR (recommended), or rely on squash-merge alone.

## Found on the way (not fixed here; filed or commented where an issue exists)

- Six cron routes, not five, fail open without `CRON_SECRET` (the unscheduled
  `revocation-check` too) — commented on #407.
- Stale canonical lines: `docs/ARCHITECTURE.md` ("~76 route handlers" vs 131; `lib/integrations/`
  described as Slack/Drive/GitHub but holds only `luma.ts`; `(survey)/` and `c/` missing from the
  route-group table; `scripts/` "each subfolder has a CLAUDE.md"); `docs/environments.md` still
  says `supabase db push --linked` above the block that forbids it and cites #361 instead of #404;
  `supabase/CLAUDE.md`, `lib/auth/CLAUDE.md`, `docs/poderator-dashboard/CLAUDE.md` carry closed-issue
  status sections; `requirements/moderator-insights-logs.md` is still "Draft" although #379/#381
  shipped 2026-08-30 — commented on #409.
- #212 names a function (`getRegistrationCycle`) that does not exist — commented on #212.
- Personal data in committed files of a public repo (a default ops email in a migration script,
  real first names in a spotlights seed header, a maintainer name and a personal email in
  `docs/environments.md`; alumni quoted by full name on `/donate`) — filed as [#475](https://github.com/TheUpskillingLabs/OLOS/issues/475).
- `/sectors/[slug]` and `/workstreams/[slug]` live in `app/(public)/` but are not in `proxy.ts`
  `publicPaths`, so signed-out visitors are sent to `/login`; `lib/content/org-pages.ts` treats
  them as dashboard deep links — decide whether that is intended (noted in the `(public)` README).
- `lib/llm/` is one function naming new pods and projects from member-written text at finalize,
  admin-only, with a fallback when no key is set; `docs/ARCHITECTURE.md` calls it the one ratified
  in-app LLM use. The hand-off brief's constitution says no in-app LLM — a vault note should
  record the exception or retire it.
- Legal pages are hand-copied JSX mirroring `docs/legal/*.md`; nothing enforces sync.
- Twelve API routes have no in-repo caller (listed with "(verify)" in `app/api/README.md`).

## Next

- Owner: review and squash-merge #476; merge #391;
  decide D1/D10/D12/D13; the volunteer developer starts at #472.
- Docs owner: at the Sprint 1 boundary (Oct 12), run the §9.1 refresh for the first time
  and re-date `ONBOARDING.md`.
