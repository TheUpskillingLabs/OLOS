<!--
  Branch off `dev` and target `dev` (not `main`). CI (lint + test + build) and
  docs-check must pass before merge. Keep PRs to one logical change. Title the PR
  like a Conventional Commit — `feat(admin): …`, `fix(cycle): …`, `docs(roadmap): …` —
  squash-merge turns it into the commit everyone reads later.
-->

## What

<!-- One or two sentences: what does this change and why? -->

## Issue

<!-- `Closes #123`, or "no issue: <why>". Umbrella issues: link the sub-issue. -->

## Changes

<!-- Bullet the notable changes. -->

-

## Verify

<!-- How you checked it works — commands run, pages exercised, tests added. -->

- [ ] `npm run lint` passes
- [ ] `npm run test` passes
- [ ] `npm run build` passes
- [ ] `npm run check:docs` passes (relative links, vault frontmatter)

## Manual testing

<!--
  Step-by-step instructions for the key user-facing flows this PR touches, so
  a reviewer (or whoever promotes to prod) can exercise them without reading
  the diff: where to click, what to enter, and what should happen — including
  the error/edge paths (e.g. "expect a friendly 409, not a 500"). Note which
  environment each step assumes (local / dev preview / prod after deploy).
  If the PR has no user-facing surface (docs, refactor), say "None" and why.
-->

1.

## Database

- [ ] No schema change, **or** a migration was added under `supabase/migrations/`
      (new number claimed on the issue, `SCHEMA.md` updated). Prod migrations are
      applied by a maintainer.

## Docs & decisions

<!-- The documentation contract: docs/roadmap/documentation-framework.md §5.
     Tick what applies; say "n/a" for the rest. Opt-out labels (`skip-changelog`,
     `schema-doc-exempt`) need a one-line reason here. -->

- [ ] `CHANGELOG.md` — one line under **Unreleased** ending in `(#PR)` (code changes)
- [ ] Decision made, or the build moved off a spec/PRD → note in `docs/vault/`
      (`decisions/ADR-NNNN-…` or `divergence/…`), or "no decision in this PR"
- [ ] Area `CLAUDE.md` updated if a convention changed (`lib/auth/`, `supabase/`,
      `scripts/*`, `docs/poderator-dashboard/`)
- [ ] `docs/roadmap/next-sprint.md` / the requirements doc updated if scope changed
- [ ] New doc under `docs/` → added to the map in `docs/README.md`
