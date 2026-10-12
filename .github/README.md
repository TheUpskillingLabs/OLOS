# `.github/` — CI, the documentation checks, issue and PR templates, code owners

| | |
|---|---|
| **What this is** | The four GitHub Actions workflows that run on every PR, merge, or schedule, plus the templates that shape issues and PRs and the CODEOWNERS file that routes reviews. |
| **Zone / owner** | Not a zone in the [file-ownership map](../docs/agent-teams.md#file-ownership-map-avoid-conflicts); the maintainers own it, and `CODEOWNERS` routes every review to them. |
| **Conventions** | No `CLAUDE.md` here. PR titles are Conventional-Commit shaped (`feat(admin): …`); every opt-out label needs a one-line reason in the PR body; secrets are referenced by name only, never pasted anywhere. |
| **Last verified** | 2026-10-02 |

## What is here

| Path | What it does | Notes |
|---|---|---|
| [`workflows/ci.yml`](workflows/ci.yml) | On PR to and push to `dev`/`main`: `npm ci`, `check:migrations`, `lint`, `tsc --noEmit`, `test`, `build`. | No secrets: pages that read Supabase are force-dynamic, so the build queries nothing. The `ci` check is the one branch protection should require. |
| [`workflows/docs-check.yml`](workflows/docs-check.yml) | On PR to `dev`/`main`: PR title is Conventional-Commit shaped; a migration change needs a `SCHEMA.md` change (opt-out label `schema-doc-exempt`); a code change under `app/`, `lib/`, `supabase/`, `proxy.ts`, `vercel.json` needs a `CHANGELOG.md` line (`skip-changelog`); a new doc under `docs/` must be listed in `docs/README.md`; relative links resolve in changed Markdown; vault frontmatter is valid; migration numbers are unique. | Checks *presence* of a doc change, never its content. No secrets. The mechanical half of the contract: [framework §7.1](../docs/roadmap/documentation-framework.md#71-docs-check--on-every-pull-request). |
| [`workflows/docs-steward.yml`](workflows/docs-steward.yml) | Mondays 13:00 UTC and on manual dispatch: Claude reads the week's merges to `dev` and files **one** issue (`docs`, `needs-triage`) listing documentation drift. Read-only; never pushes or edits. | **Inert until** the repository secret `ANTHROPIC_API_KEY` is set. The judgment half: [framework §7.2](../docs/roadmap/documentation-framework.md#72-the-docs-steward--weekly-claude). Turning it on is #411. |
| [`workflows/publish-artifacts.yml`](workflows/publish-artifacts.yml) | `publish` job on push to `dev` and on `v*` tags (or dispatch): runs [`scripts/publish-artifacts.mjs`](../scripts/publish-artifacts.mjs) into a checkout of the knowledge repo and pushes there. `sweep` job on the 1st of the month 14:00 UTC (or dispatch with `sweep = true`): opens a PR on OLOS removing files the knowledge repo already holds verbatim. | **Inert until** the secret `KNOWLEDGE_REPO_TOKEN` is set; the repository variable `KNOWLEDGE_REPO` overrides the manifest's default destination. Design: [topology §4](../docs/roadmap/documentation-topology.md#4-the-mechanism), setup: [topology §7](../docs/roadmap/documentation-topology.md#7-setup-checklist-one-afternoon-owner--docs-owner). First run is #410. |
| [`ISSUE_TEMPLATE/bug_report.md`](ISSUE_TEMPLATE/bug_report.md) | What happened, steps, expected, environment (local / dev preview / prod). | Labels `bug`, `needs-triage`. |
| [`ISSUE_TEMPLATE/feature_or_task.md`](ISSUE_TEMPLATE/feature_or_task.md) | What & why, who it serves (a persona), scope, acceptance, references. | Labels `enhancement`, `needs-triage`. Claim a migration number in its Notes. |
| [`ISSUE_TEMPLATE/decision.md`](ISSUE_TEMPLATE/decision.md) | The question, context, an options table, a recommendation, owner and decide-by date; resolved by a PR that adds a vault note. | Title prefix `Decision: `; labels `needs-decision`, `needs-triage`. |
| [`ISSUE_TEMPLATE/config.yml`](ISSUE_TEMPLATE/config.yml) | Blank issues allowed; three contact links (roadmap, contributing guide, documentation contract). | |
| [`pull_request_template.md`](pull_request_template.md) | What / Issue / Changes / Verify (lint, test, build, `check:docs`) / Manual testing / Database / Docs & decisions. | Mirrors the definition of done in [framework §5](../docs/roadmap/documentation-framework.md#5-pull-requests--the-definition-of-done). |
| [`CODEOWNERS`](CODEOWNERS) | `*` routes review requests to the three maintainers; any one can approve. | A `docs/**` line is a commented placeholder until the docs owner is named ([framework §9](../docs/roadmap/documentation-framework.md#9-ownership)). |

**"Inert until"** means the workflow's first step reads the named secret; when it is
empty the step logs that fact and every later step is skipped, so the run is green and
does nothing. Setting the secret in the repository settings turns the workflow on with no
code change. Neither workflow needs anything else to start.

## How it fits

`ci.yml` and `docs-check.yml` are the two status checks a PR into `dev` must pass
([`CONTRIBUTING.md`](../CONTRIBUTING.md#branch--pr-workflow)). `docs-check` calls the
checkers in [`scripts/`](../scripts/README.md) (`check-doc-links.mjs`,
`check-vault-frontmatter.mjs`, `check-migration-numbers.mjs`); the same `check:docs`
and `check:migrations` npm scripts run locally. `publish-artifacts.yml` is the bridge to
the team knowledge repo described in
[`docs/roadmap/documentation-topology.md`](../docs/roadmap/documentation-topology.md),
driven by [`docs/publish.manifest.json`](../docs/publish.manifest.json). Label and
milestone hygiene is #402.

## Open issues in this area (snapshot 2026-10-02)

Live view: [label `area/ops`](https://github.com/TheUpskillingLabs/OLOS/issues?q=is%3Aopen+label%3Aarea%2Fops) ·
[all open issues](https://github.com/TheUpskillingLabs/OLOS/issues).

- [#410](https://github.com/TheUpskillingLabs/OLOS/issues/410) — Knowledge-repo bridge: the token, the first automated publish, the first sweep PR, and archiving `docs-archive` (`priority/p1, size/s`)
- [#411](https://github.com/TheUpskillingLabs/OLOS/issues/411) — Turn on the docs steward (secret or Claude Routine) and run the first weekly triage (`priority/p2`)
- [#77](https://github.com/TheUpskillingLabs/OLOS/issues/77) — [ops] auto-apply Supabase migrations on merge to dev + main
- [#432](https://github.com/TheUpskillingLabs/OLOS/issues/432) — D2 — Apply migrations to dev automatically on merge to `dev` (the dev half of #77), once the ledger is reconciled (`priority/p2, size/s`)
- [#401](https://github.com/TheUpskillingLabs/OLOS/issues/401) — Adopt the planning layer: open the roadmap branch as a PR into dev; merge #391; close #390 (`priority/p1`)
- [#402](https://github.com/TheUpskillingLabs/OLOS/issues/402) — Labels, milestones, and a project board; label sweep on every open issue; break #361 into sub-issues (`priority/p1`)
- [#403](https://github.com/TheUpskillingLabs/OLOS/issues/403) — Dispose of the six orphaned documentation PRs (#173, #185, #199, #243, #244, #248, #286) (`priority/p2`)

This list is a snapshot; the live view above is the truth. Refreshed at each sprint
boundary ([`docs/roadmap/documentation-framework.md` §9.1](../docs/roadmap/documentation-framework.md#91-the-sprint-boundary-refresh-onboarding-is-part-of-the-update-process)).

## Before you change something

- A workflow change has no unit test; run the commands it runs (`npm run lint`,
  `npm run test`, `npm run build`, `npm run check:docs`, `npm run check:migrations`)
  locally, then watch the first run on your PR.
- Keep the gate pattern: a workflow that needs a secret checks for it first and skips
  cleanly when it is missing, so a fork or a fresh clone stays green.
- Never echo a secret; reference it as `${{ secrets.NAME }}` and mention only the name
  in comments and docs.
- A new opt-out label or a new required check belongs in
  [`docs/roadmap/documentation-framework.md` §7](../docs/roadmap/documentation-framework.md#7-enforcement)
  in the same PR, and templates that change the contributor's checklist belong in
  [`CONTRIBUTING.md`](../CONTRIBUTING.md) too.
- Copy in templates follows the repo rules: "The Labs" (never "TUL"), "Upskiller",
  "Poderator"; no real participants' names (the repo is public).
- Workflow: branch off `dev`, one issue, one PR — [`CONTRIBUTING.md`](../CONTRIBUTING.md).
