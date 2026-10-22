# Invite-only cycles: rebuild on a clean branch off `main` and fix the gaps found in testing

| | |
|---|---|
| **Date** | 2026-10-22 |
| **Ran by** | @fkloosterman (+ Claude Code) |
| **Branch / PR** | `feat/invite-only-cycles` · #501 (replaces #499) |
| **Asked** | "I need to address the comments on PR 499." The comments were the author's own preview-testing notes. The brief was the minimum necessary fixes, leaving non-urgent items for later unless easy. The PR was then rebuilt on a clean branch because it must ship to `main` ahead of `dev`. |

## What was done

- **Rebuilt the feature on `main`.** #499 targeted `main` (the author meant to ship it ahead of `dev`) but had picked up a merge of `dev`, which would have promoted all unreleased `dev` work. `feat/invite-only-cycles` is cut from `main`, takes the author's three commits, and adds the fixes below. One conflict, in `app/page.tsx` (the landing banner): kept `main`'s "what's next" logic and drove it from `bannerCycle`, so an invite-only cycle is not recruited publicly.
- **Migration renumbered `00104` → `00109`** (`supabase/migrations/00109_cycle_config_invite_only.sql`). `dev` uses `00104`–`00106` and `00108`, and `00107` is reserved for #470. References updated in code comments, `SCHEMA.md` and `docs/ORG_CYCLES.md` §5a.
- **`/cycles/[cycle_id]/join`:** the invite-only check runs before the Local Lab gate. Before, an invitee with no active lab was sent to `/local-labs` and never reached their cycle; so was an uninvited member, who should land on `/cycles`. Open-registration cycles still go through the lab gate unchanged.
- **`/cycles`:** once an invite-only cycle is active, its phase rail, "Open now" rows, Learning Log row and "View cycle" card are hidden from members who are not enrolled (only the Register cards were hidden before).
- **Dashboard:** an invite-only cycle stays out of "Your groups", and the "Your cycle" quick link goes to `/cycles`, for members who are not enrolled.
- **`CHANGELOG.md`:** added the missing line.

## What was verified

- On this branch: `npm run test` 711 passed; `npm run lint` 0 errors; `npx tsc --noEmit` clean after a fresh `npm run build` (which passed); `npm run check:migrations` and `npm run check:docs` pass.
- Manual, earlier, on the #499 branch (merged with `dev`) against a fresh Supabase project built from `dev` plus `00109`, with one lab-less member and one owner:
  - Not invited, cycle upcoming: no card on `/cycles`; `/cycles/[id]` and `/join` redirect to `/cycles`; no dashboard card or task; `POST …/agreement` returns 403.
  - Invited (cycle-only invitation, accepted): enrollment `registered`; the "You're registered" card opens the cycle page; `/join` redirects to `/cycles/[id]`; the dashboard shows the confirmation.
  - Switching to open registration shows the card to an uninvited owner and back hides it; a lab-less member is still sent to `/local-labs` on an open cycle.
  - Cycle active, not invited: found the `/cycles`, "Your groups" and "Your cycle" leaks above and fixed them.
- **Not verified:** the manual paths above on a `main`-based build (the ported fixes were exercised on `dev`'s code); the Vercel preview of #501; `interest` and pod registration for an invitee (no pod existed; `interest` returned 403, most likely the Local Lab gate that runs first in that route).

## Decisions made → where they live

| Decision | Recorded in |
|---|---|
| Ship the feature to `main` ahead of `dev`, from a clean branch; #499 replaced | PR #501 description |
| Migration numbered `00109` | `00109` header; `SCHEMA.md` |
| Invitees are exempt from the Local Lab gate (they were admitted by an admin, not self-registering) | Comment in `join/page.tsx` |
| The uninvited see nothing of an invite-only cycle on `/cycles`, the dashboard and the cycle's own page | PR #501 description; `docs/ORG_CYCLES.md` §5a |
| The dogfooding quarter runs on a participant cycle, not an org cycle (team decision; #480 had chosen an org cycle for Cycle 4) | PR #501 description; `docs/ORG_CYCLES.md` §5a |

## Open questions / needs from others

- **Ending a member's cycle enrollment is not possible in any cycle; out of scope for this PR.** There is no admin "remove from cycle" action and no member "step back" action (`stepped_back` is reserved and unused, #433). Enrollments end only through the engagement sweep (missed Learning Logs, recoverable), owner archive (every cycle, plus roles and pods) or a manual SQL update. It shows up here because on an invite-only cycle the enrollment *is* the admission, so revoking an accepted invitation (`PATCH /api/invitations/{id}`, which only sets the invitation to `revoked`) leaves the member in with their cards and access. Interim workaround, by hand: `UPDATE cycle_enrollments SET status = 'revoked' WHERE cycle_id = <id> AND participant_id = <id>;` — it blocks the invite-only guard, the reconciler leaves it alone, and Reactivate can undo it. It writes no `access_revocations` row (the #115 audit gap). Needs a decision with the enrollment state-machine work (#408, #433).
- **Overlap with #478** (`registration_audience`: public / members / invite). `invite_only` is the `invite` case as a boolean; a general per-cycle eligibility model (specific people, labs, past participants) belongs on #478.
- **Local Labs policy:** confirm that invitees should not need an active lab. The lab gate applies only at `join`, `agreement` and `interest`; invitation acceptance has never checked it.

## Observations outside this PR (not fixed here; worth an issue each)

- `/cycles/[id]/join` redirects a member with no active Local Lab to `/local-labs` with no explanation (`join/page.tsx`, the only silent redirects to it). The API routes behind the same gate (`agreement`, `interest`, pod registration) return a 403 with a message, which the ceremony shows.
- `POST /api/cycles` inserts `cycle_config` with the session client (`app/api/cycles/route.ts`) after the cycle row with the service client. A non-admin lab lead creating an org cycle fails RLS and leaves a cycle without config.
- Draft cycles are listed under "Past cycles" for every member and their detail pages open. Closed cycles' config can still be edited, and invitations can be created for them.
- A registered lab-less member's card links through `/join`; if registration is later opened, that link goes to `/local-labs` again.
- No documented bootstrap for the first owner on a fresh project: `lib/auth/CLAUDE.md` says to insert a `participant_roles` row, but RLS (`is_admin_or_owner()` = `has_permission('cycles:write')`) also needs `participant_permissions` rows. `supabase/README.md` says not to `db push`, which is right for dev and prod but not for a new project.
- `lib/labs/membership.ts` calls the lab gate "the hard gate for all cycle participation"; the code applies it at three self-serve entry points only.
- `npm audit` after `npm install`: 17 vulnerabilities (1 critical, 12 high), mostly nested under `next`. Not touched.

## Next

- Test #501 on its preview (a `main`-based build), then merge into `main`.
- **Apply `00109` to the production database before the deploy** (Studio SQL Editor, then the ledger row; not `supabase db push`, per `supabase/README.md`), and record it under **Ops** in `CHANGELOG.md` at the next promotion.
- Open a `main → dev` back-merge PR right after; expect conflicts in `app/page.tsx`, the dashboard and `/cycles` pages, and `CHANGELOG.md`. After it, `dev`'s next free migration number is `00110`.
- Close #499 once #501 is accepted.
- @fkloosterman: file the issues above.
