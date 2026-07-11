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

## Database

- [ ] No schema change, **or** a migration was added under `supabase/migrations/`
      (new number, `SCHEMA.md` updated). Prod migrations are applied by a maintainer.
