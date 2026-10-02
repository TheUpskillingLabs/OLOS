# Onboarding SOP, sprint meta-review, and the executive summary

| | |
|---|---|
| **Date** | 2026-10-02 |
| **Ran by** | dev (Claude Code session, lead-architect role) |
| **Branch / PR** | `claude/olos-roadmap-documentation-yjebim` · planning PR ([#401](https://github.com/TheUpskillingLabs/OLOS/issues/401)) not yet opened |
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

## Next

- Owner: open the planning PR into `dev` (#401) with the draft description; merge #391;
  decide D1/D10/D12/D13; the volunteer developer starts at #472.
- Docs owner: at the Sprint 1 boundary (Oct 12), run the §9.1 refresh for the first time
  and re-date `ONBOARDING.md`.
