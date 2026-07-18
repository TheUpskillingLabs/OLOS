<!--
  Branch off `dev` and target `dev` (not `main`). CI (lint + test + build) must
  pass before merge. Keep PRs to one logical change.
-->

## What

<!-- One or two sentences: what does this change and why? -->

## Changes

<!-- Bullet the notable changes. Link the issue if there is one (e.g. Closes #123). -->

-

## Verify

<!-- How you checked it works — commands run, pages exercised, tests added. -->

- [ ] `npm run lint` passes
- [ ] `npm run test` passes
- [ ] `npm run build` passes

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
      (new number, `SCHEMA.md` updated). Prod migrations are applied by a maintainer.
