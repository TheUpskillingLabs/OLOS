# Invite-only cycles: merge `dev`, renumber to 00109, and fix the gaps found in testing

| | |
|---|---|
| **Date** | 2026-10-22 |
| **Ran by** | @fkloosterman (+ Claude Code) |
| **Branch / PR** | `claude/keen-mayer-zd89o9` · #499 |
| **Asked** | "I need to address the comments on PR 499." The comments were the author's own preview-testing notes on the PR. The brief was the minimum necessary fixes, with non-urgent items left for later unless easy. |

## What was done

- **Merged `dev` into the branch** (a merge, not a rebase: someone else started the branch, and a rebase would have needed a force-push). One conflict, in `app/page.tsx`: kept `dev`'s "what's next" banner logic and drove it from `bannerCycle`, so an invite-only cycle falls back to it instead of recruiting.
- **Renumbered the migration `00104` → `00109`** (`supabase/migrations/00109_cycle_config_invite_only.sql`). `dev` gained `00104`–`00106` (ambassadors) and `00108` (announcements), and `00107` is reserved for #470. Updated every reference in code comments, `SCHEMA.md` and `docs/ORG_CYCLES.md` §5a.
- **`/cycles/[cycle_id]/join`:** the invite-only check now runs before the Local Lab gate. Before, an invitee with no active lab was sent to `/local-labs` and never reached their cycle; so was an uninvited member, who should land on `/cycles`. Open-registration cycles still go through the lab gate unchanged.
- **`/cycles`** (`app/(dashboard)/cycles/page.tsx`): once an invite-only cycle is active, its phase rail, "Open now" rows, Learning Log row and "View cycle" card are hidden from members who are not enrolled. Only the Register cards were hidden before.
- **Dashboard** (`app/(dashboard)/dashboard/page.tsx`): an invite-only cycle stays out of "Your groups", and the "Your cycle" quick link goes to `/cycles`, for members who are not enrolled.
- **`CHANGELOG.md`:** added the missing line for the feature.
- **PR #499:** title and description updated to `00109`, with an update section.

## What was verified

- `npm run test`: 733 passed. `npx tsc --noEmit`: clean. `npm run lint`: 0 errors. `npm run check:migrations`: 108 migrations, all prefixes unique. `npm run build` passed on the merged tree with the `join` and CHANGELOG changes; it was not re-run after the `/cycles` and dashboard fixes (tsc, lint and tests were).
- Manual, on a fresh Supabase project built from `dev` plus `00109`, with one lab-less member (on a city waitlist) and one owner:
  - Not invited, invite-only cycle upcoming: no card on `/cycles`; `/cycles/[id]` and `/join` redirect to `/cycles`; no dashboard card or task; `POST …/agreement` returns 403.
  - Invited (cycle-only invitation, accepted): enrollment is `registered`; the "You're registered" card opens the cycle page; `/join` redirects to `/cycles/[id]`; the dashboard shows the confirmation card.
  - Switching the cycle to open registration shows the card to an uninvited owner; switching back hides it. A lab-less member is still sent to `/local-labs` on an open cycle.
  - Cycle active, not invited: found the `/cycles`, "Your groups" and "Your cycle" leaks above and fixed them.
- Not verified by me: the Vercel preview after the final push, the home-page "what's next" banner in a browser, and `interest` and pod registration for an invitee (no pod existed; `interest` returned 403, most likely the Local Lab gate that runs first in that route).

## Decisions made → where they live

| Decision | Recorded in |
|---|---|
| Migration renumbered to `00109`, and `dev` merged instead of rebased | PR #499 description; this report |
| An invite-only cycle's invitees are exempt from the Local Lab gate (they were admitted by an admin, not self-registering) | Comment in `join/page.tsx` |
| The uninvited see nothing of an invite-only cycle on `/cycles`, the dashboard and the cycle's own page (extends the PR's "owner rule") | PR #499 description; `docs/ORG_CYCLES.md` §5a |
| The dogfooding quarter will run on a participant cycle, not an org cycle (team decision; #480 had chosen an org cycle for Cycle 4) | PR #499 description; `docs/ORG_CYCLES.md` §5a |

## Open questions / needs from others

- **Ending a member's cycle enrollment is not possible in any cycle; out of scope for this PR.** There is no admin "remove from cycle" action and no member "step back" action (`stepped_back` is reserved and unused, #433). Enrollments end only through the engagement sweep (missed Learning Logs, recoverable), owner archive (every cycle, plus roles and pods) or a manual SQL update. It shows up in this PR because on an invite-only cycle the enrollment *is* the admission, so revoking an accepted invitation (`PATCH /api/invitations/{id}`, which only sets the invitation to `revoked`) leaves the member in with their cards and access. Interim workaround, run by hand: `UPDATE cycle_enrollments SET status = 'revoked' WHERE cycle_id = <id> AND participant_id = <id>;` — it blocks the invite-only guard, the reconciler leaves it alone, and Reactivate can undo it. It writes no `access_revocations` row (the #115 audit gap). Needs a decision with the enrollment state-machine work (#408, #433): the supported way to end an enrollment, and whether revoking an accepted invitation should call it.
- **Overlap with #478** (`registration_audience`: public / members / invite). `invite_only` is the `invite` case as a boolean. A general per-cycle eligibility model (specific people, labs, past participants) was discussed as a better design; it belongs on #478.
- **Local Labs policy:** confirm that invitees should not need an active lab. The code applies the lab gate only at `join`, `agreement` and `interest`; invitation acceptance has never checked it.

## Observations outside this PR (not fixed here; worth an issue each)

- `/cycles/[id]/join` redirects a member with no active Local Lab to `/local-labs` with no explanation (`join/page.tsx:80` and `:86`, the only silent redirects to it). The API routes behind the same gate (`agreement`, `interest`, pod registration) return a 403 with a message, which the ceremony shows.
- `POST /api/cycles` inserts `cycle_config` with the session client (`app/api/cycles/route.ts:144`) after the cycle row with the service client. A non-admin lab lead creating an org cycle fails RLS and leaves a cycle without config.
- Draft cycles are listed under "Past cycles" for every member and their detail pages open. Closed cycles' config can still be edited, and invitations can be created for them.
- A registered lab-less member's card links through `/join`; if registration is later opened, that link goes to `/local-labs` again.
- **No documented bootstrap for the first owner on a fresh project.** `lib/auth/CLAUDE.md` says to insert a `participant_roles` row, but RLS (`is_admin_or_owner()` = `has_permission('cycles:write')`) also needs `participant_permissions` rows. `supabase/README.md` says not to `db push`, which is right for dev and prod but not for a new project.
- `lib/labs/membership.ts` calls the lab gate "the hard gate for all cycle participation"; the code applies it at three self-serve entry points only.
- `npm audit` after `npm install`: 17 vulnerabilities (1 critical, 12 high), mostly nested under `next`. Not touched.

## Next

- Review and merge #499 into `dev`.
- A maintainer applies `00109` to the dev database by hand (Studio SQL Editor, then the ledger row; not `supabase db push`, per `supabase/README.md`) and records the prod apply under **Ops** in `CHANGELOG.md` at promotion.
- @fkloosterman: file the issues above.
