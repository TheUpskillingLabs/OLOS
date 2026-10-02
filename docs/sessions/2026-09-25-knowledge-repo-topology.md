# Re-baseline after ten days, and the two-repository documentation topology

| | |
|---|---|
| **Date** | 2026-09-25 |
| **Ran by** | dev@theupskillinglabs.org with Claude Code (web) — session `01Br1xPM7fXAQzMrZTaBL7Xa` (continued) |
| **Branch / PR** | `claude/olos-roadmap-documentation-yjebim` · PR not yet opened |
| **Asked** | Update the plan for what changed since Sep 15; design a framework for pushing the extra documentation and schema work to a different private repository on the team's GitHub so OLOS stays lean while artifacts of completed work exist; keep the roadmap in OLOS as the alignment layer; file a high-priority ticket for an executive meeting on project setup, context documents, and an auditable decision trail; think through what the team still needs to provide. |

## What was done

- Re-verified `dev`/`main`: nothing merged since 2026-09-10; PRs #390/#391 still open;
  the planning branch not yet opened as a PR; label taxonomy absent. Re-baselined
  `next-sprint.md` (Sprint 0 → Sep 28–Oct 9, Sprint 1 → Oct 12–Nov 20 with a
  decision-gated Oct 13 Showcase slice, Sprint 2 → Nov 30–Jan 22); added items 0.12–0.14,
  decisions D12–D13, and a dated status table. Appended the audit addendum (F15: no
  team-facing home; F16-class input: OLOS is public — see topology §2.3).
- Found the org's existing private `TheUpskillingLabs/docs-archive` (README from
  2026-06-18 describing exactly this archive; no files ever pushed). Later the same day
  the owner created `TheUpskillingLabs/Docs-repository` as the destination; the topology
  (`docs/roadmap/documentation-topology.md`) targets it. First publish plus the
  hand-authored `program/` (curriculum, research, design) and `governance/` spaces were
  pushed there by hand; the publisher now writes a README in every generated folder.
- Built the bridge: `docs/publish.manifest.json` (rules + modes), `scripts/publish-artifacts.mjs`
  (provenance headers, sha-pinned link rewriting, `PUBLISHED.md`, snapshots, prune plan),
  `.github/workflows/publish-artifacts.yml` (publish on `dev`/tags; monthly sweep PR);
  inert until `KNOWLEDGE_REPO_TOKEN` is set.
- Added the session-report convention (`docs/sessions/README.md`) with reports for the
  Sep 15 and Sep 25 sessions; `docs-check` exempts the inbox from the doc-map rule.
- Wired the topology into `documentation-framework.md` (§3.3, §7.3), both READMEs,
  `CLAUDE.md`, and the changelog.
- **Filed the issue tracker for the phase** (later the same day): the executive-meeting
  ticket [#392](https://github.com/TheUpskillingLabs/OLOS/issues/392); eight epics [#393](https://github.com/TheUpskillingLabs/OLOS/issues/393)–[#400](https://github.com/TheUpskillingLabs/OLOS/issues/400) (Sprint 0, Workstreams
  A–D, Sprint 2, the research & design practice, the onboarding curriculum); 58
  sub-issues [#401](https://github.com/TheUpskillingLabs/OLOS/issues/401)–[#458](https://github.com/TheUpskillingLabs/OLOS/issues/458) attached to their epics, each with context,
  scope, acceptance, dependencies, size, and a branch name off `dev`. The map is
  `next-sprint.md` §10 (replacing the issue-seed table). Labels: only the first
  creation auto-created labels (`epic`, `persona/pre-registrant`); `area/database`,
  `area/docs`, the other `persona/*`, and `needs-decision` do not exist yet, so those
  issues carry the existing labels only — the taxonomy and milestones are [#402](https://github.com/TheUpskillingLabs/OLOS/issues/402).
- Hand-authored the team spaces in Docs-repository: `program/curriculum/` (readiness
  ladder v0 with all nine steps populated, M0 welcome, M1 Slack, M2 GitHub, M3 AI
  assistant, the pod `CONTEXT.md` template), `program/research/` (process on the cycle
  calendar, ethics, six templates), `program/design/` (wireframe rule, tool
  recommendation, checklist), `governance/` (meetings template, decisions log).

## What was verified

- Dry-run publish to a scratch directory: 58 files (later 75 with the extended
  manifest); provenance header present; link to `DESIGN_SYSTEM.md` rewritten to a
  sha-pinned OLOS URL; in-set links kept relative; release snapshot carries only the
  newest section; prune plan lists the archive and corpus files.
- `npm run check:docs` (107 Markdown files, all relative links resolve), `npm run
  check:migrations` (103 unique), workflow YAML + manifest JSON parse, `eslint` clean on
  the scripts, `vitest`: 68 files / 627 tests passed.

## Decisions made → where they live

| Decision | Recorded in |
|---|---|
| `Docs-repository` is the knowledge repo (owner, 2026-09-25); one-way publish; sweep by PR | topology §1–§4 — needs a vault note |
| Session reports are the unit of "what was completed" | `docs/sessions/README.md`; `CLAUDE.md` |
| OLOS is public, so internal detail moves to the private repo | topology §2.3 — needs a vault note and the steward check |

## Open questions / needs from others

- Everything in topology §8 (people, timelines, scope, governance cadence, privacy
  posture, curriculum ownership, tooling). D1 (next cycle date) by Oct 2 decides whether
  the Showcase slice exists.
- The executive-meeting ticket is [#392](https://github.com/TheUpskillingLabs/OLOS/issues/392) (`priority/p1`): agenda, pre-reads, and the decisions to leave with.

## Next

- Open the planning PR into `dev`; merge #391; set the token; first publish and sweep;
  hold the executive meeting before Sprint 1.
- Create the missing labels and the three milestones (#402), then re-label the
  sub-issues; decide D1 by Oct 2 so the Showcase slice (#414, #416, #453) is on or off.
- Name the research/design lead (#443) and run the curriculum session (#450) — both
  gate Sprint 1 content.
