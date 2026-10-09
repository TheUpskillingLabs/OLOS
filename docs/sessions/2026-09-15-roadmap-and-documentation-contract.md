# Roadmap for the next phase, the audit, and the documentation contract

| | |
|---|---|
| **Date** | 2026-09-15 |
| **Ran by** | dev@theupskillinglabs.org with Claude Code (web) — session `01Br1xPM7fXAQzMrZTaBL7Xa` |
| **Branch / PR** | `claude/olos-roadmap-documentation-yjebim` · PR not yet opened |
| **Asked** | As lead architect / product designer: audit the repo and its documentation retroactively, propose the next development sprint (pre-registration persona first; poderator outreach; admin engagement/retention metrics), adopt an industry-standard documentation and decision framework with enforcement, rein in the ad hoc data pipelines, and brief a separate curriculum session (persona + tool stack). |

## What was done

- Read every Markdown doc, the lifecycle migrations, the enrollment write paths, the
  cron routes, open issues (20) and PRs (9); ran the unit suite and lint for a baseline.
- Wrote `docs/roadmap/`: `2026-09-audit.md` (14 ranked findings), `next-sprint.md`
  (Sprint 0/1/2, 11 owner decisions, 27 issue seeds), `pre-registration-persona.md`,
  `personas-and-journeys.md`, `documentation-framework.md`, `data-strategy.md`,
  `onboarding-curriculum-brief.md`, and the folder `README.md`.
- Added the enforcement layer: `.github/workflows/docs-check.yml` (PR title, migration
  ⇒ `SCHEMA.md`, code ⇒ `CHANGELOG.md`, new doc ⇒ map, relative links, vault frontmatter),
  `.github/workflows/docs-steward.yml` (weekly Claude drift issue; inert until the API key
  secret exists), `scripts/check-doc-links.mjs`, `scripts/check-vault-frontmatter.mjs`,
  `npm run check:docs`; updated the PR template (Issue, Docs & decisions), added the
  *Decision needed* issue template, revised the feature template and issue config.
- Seeded `CHANGELOG.md` (Keep a Changelog + CalVer; generated from the merge log for
  2026-07-12 →, reconstructed from docs for April–July).
- Added `docs/README.md` (the doc map) and `docs/archive/` (10 session artifacts moved,
  inbound links fixed); historical banners on the April roadmap, `audit/PROGRESS.md`,
  `personas.md`, the login PRD; stale lines fixed in `ARCHITECTURE.md`,
  `environments.md` (ledger-drift warning), `lib/auth/CLAUDE.md`,
  `poderator-dashboard/CLAUDE.md`; orientation links in `CLAUDE.md` and `CONTRIBUTING.md`.

## What was verified

- `npx vitest run`: 68 files, 627 tests passed. `npm run lint`: 0 errors, 8 warnings
  (pre-existing). `npm run check:migrations`: 103 unique. `npm run check:docs`: all
  relative links in 95 Markdown files resolve. Workflow YAML parses.
- Three commits pushed: `018bb44`, `74b2cba`, `006c1e7`.

## Decisions made → where they live

| Decision | Recorded in |
|---|---|
| Adopt PR #391's `docs/vault/` as the single decision register; close #390 as a subset | `documentation-framework.md` §2 — needs a vault note once #391 merges |
| `docs/roadmap/` is the plan of record; April roadmap and July audit are historical | `docs/README.md`, banners |
| CalVer release tags on `dev → main`; changelog line required for code PRs | `documentation-framework.md` §6 — needs a vault note |
| Session artifacts live in `docs/archive/` (now superseded by the knowledge-repo topology, 2026-09-25) | `docs/archive/README.md` |

## Open questions / needs from others

- Owner decisions D1–D11 in `next-sprint.md` §7 (kickoff date, at-risk ownership,
  docs owner, …).
- PR #391 merge; the six orphaned docs PRs' dispositions (`2026-09-audit.md` §5.2).
- `ANTHROPIC_API_KEY` secret for the steward, or a Claude Routine instead.

## Next

- Open the PR into `dev`; ratify Sprint 0; file the issue seeds.
