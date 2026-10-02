# Hand-off brief for the onboarding and journey lanes, and the Cycle v2 epic

| | |
|---|---|
| **Date** | 2026-09-28 |
| **Ran by** | dev@theupskillinglabs.org with Claude Code (web) — session `01Br1xPM7fXAQzMrZTaBL7Xa` (continued; Ultracode) |
| **Branch / PR** | `claude/olos-roadmap-documentation-yjebim` · PR not yet opened |
| **Asked** | An overview document to seed the next agent's context for building the public-facing pages and the experience of a signed-up member who has not joined a cycle; the pre-cycle curriculum (Slack, OLOS, tools) and the learning pages, shaped by validated behavioral research; a scaffold of the success team's weekly tasks filed as an issue for review; a Poderator weekly goal (reach out to members on the lower side of log submission; copy and run their weekly logs query in their own chat tool); entry points for people who want to build rather than research; the frame-innovation method made explicit and practised by the Labs' own teams; the plan split into lanes with parameters and submission criteria for an Ultracode run; issues opened for the pieces; a paper trail. Also: how far `dev` and `main` are apart. |

## What was done

- Verified the branches: `origin/dev@36b6d2a` and `origin/main@226445a` are content-identical (`main` carries eight `dev → main` merge commits `dev` lacks; the diff is empty); the planning branch is 17 commits ahead of `dev`, 0 behind; PRs #390/#391 and the July docs PRs are still open.
- Ran a nine-agent reading pass (Workflow) over the public pages, the member dashboard and task system, the success team's authoring tools, the Poderator surfaces, enrollment and identity data, the cycle's time model, and the program docs, plus two research agents (behavioral evidence with honest effect sizes; Dorst's frame innovation mapped onto the cycle with entry points). Findings with file paths are the brief's §2, §4, §5.
- Ran a six-lane design pass (Workflow) producing specs with copy decks and content scaffolds; the adversarial critique and revision stages hit the session limit on the first run, were resumed, and completed (19 of 19 agents); the critiques' blockers and should-fixes are folded into each lane section and posted on the lane issues; the completeness pass's rulings on cross-lane conflicts, the unassigned pieces, and the merge order are §6 of the brief.
- Wrote [`docs/roadmap/handoff-2026-09-28-onboarding-journeys.md`](../roadmap/handoff-2026-09-28-onboarding-journeys.md): where the code is; what exists today; what is decided; the evidence base and ten high-agency rules; frame innovation, the three ways in, the participant narrative, the Labs' own practices; sequencing; six lanes (U public pages, M between-cycles dashboard, L learning shelf, S weekly messages, P Poderator goal, C Cycle v2); lane conventions and the definition of done; an Ultracode workflow skeleton; the issue map; the decisions; what the team must provide.
- Filed issues: the Cycle v2 epic [#459](https://github.com/TheUpskillingLabs/OLOS/issues/459) with [#468](https://github.com/TheUpskillingLabs/OLOS/issues/468)–[#471](https://github.com/TheUpskillingLabs/OLOS/issues/471); A9 [#460](https://github.com/TheUpskillingLabs/OLOS/issues/460); B7 [#461](https://github.com/TheUpskillingLabs/OLOS/issues/461); bugs [#462](https://github.com/TheUpskillingLabs/OLOS/issues/462), [#463](https://github.com/TheUpskillingLabs/OLOS/issues/463); D6 [#464](https://github.com/TheUpskillingLabs/OLOS/issues/464); K10 [#467](https://github.com/TheUpskillingLabs/OLOS/issues/467) (the 21 weekly messages for review), K11 [#466](https://github.com/TheUpskillingLabs/OLOS/issues/466) (the 14 Poderator texts and the logs-query prompt), K12 [#465](https://github.com/TheUpskillingLabs/OLOS/issues/465); lane-pointer comments on #412, #413, #414, #441; re-scope comments on #416 and #421.
- Updated `next-sprint.md` §8 and §10, the doc map, the roadmap index, and the changelog.

## What was verified

- Spot-checks of the highest-leverage code claims against the tree (the register card's "We'll open your next steps here when it starts", the custom-task audience rule at `lib/tasks/tasks.ts:151`, the roster export's email column, the `weekly_messages` CHECK, the log-insights field list, the welcome email's promise, the forced `contact_consent`, the absent `github_username` write path); fragile line numbers replaced with identifiers where they drifted between readers.
- `npm run check:docs` on the tree; the publish bridge dry run.

## Decisions made → where they live

| Decision | Recorded in |
|---|---|
| Lanes are the unit of hand-off: one branch, one PR, one agent; the single-owner zone stays single-owner | brief §6–§8 |
| Recommendations only (owner decides): extend `weekly_messages` in place; the Poderator goal is self-set, never a quota; the Builder track's split last call and the "ready for builders" chip; "Sensemaking Sprint" as the one name | brief §11; issues #460, #461, #468 — vault notes pending |

## Open questions / needs from others

- D1 by Oct 2 still decides the Showcase slice and every dated line; the decision pack #468 needs the executive meeting (#392) or a sibling.
- The two content scaffolds need one reviewer from each persona; labels and milestones (#402); wireframes (#446) before U and M are sized.

## Next

- Open the planning PR into `dev` (#401); create the missing labels; hold #392; then start lanes U and M off `origin/dev` (or run the §9 workflow).
