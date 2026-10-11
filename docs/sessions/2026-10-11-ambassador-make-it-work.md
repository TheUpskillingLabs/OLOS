# Make the Ambassador feature work against the dev database

| | |
|---|---|
| **Date** | 2026-10-11 |
| **Ran by** | Brendan Whitaker + Claude Code (https://claude.ai/code/session_01QZ9W42V8U1Dc1Q8w3gZSTv) |
| **Branch / PR** | `brendan-cld/charming-einstein-0tsaej` (restarted from `dev` after PR #495) · PR not opened yet |
| **Asked** | "Make it work" — get the merged Ambassador build running against Supabase. Slack is not a priority. |

## What was done

- **Database** — migrations `00104`–`00106` applied to `OLOS-dev` (project `cethihabtddiujzayaxe`), in pieces named
  `00104_ambassadors_part1/2/3`, `00105_ambassador_reviews`, `00106_ambassador_invite_approval`. Prod untouched.
  `OLOS-dev` already carries two other migrations numbered `00104`/`00105` (`slack_identity_mapping`,
  `slack_interaction_receipts`) that are not in the repo — their owner must renumber before merging.
- **Audit** — four of ten read-only audit slices reported before the run was stopped as too heavy (data layer, applicant
  routes, coordinator routes, coordinator pages). Their findings were checked against the live schema and fixed directly.
- **Fixes** — note length (`decision_note` is varchar(500)); invite self-approval blocked and admit step blocked for the
  approver; invite approval now repeatable (repairs a half-finished approval); a review that already decides an
  application heals a stuck `pending`; `reviewsFor` no longer hides read errors; an invited applicant's Lab is the
  invite's Lab; a directly-granted ambassador's `ready` normalises their application row; nominations can be invited
  only while open; open invites are always listed; next-session time read as wall time (it was shifted 4–5 hours).
- **Tests** — `session.test.ts`, `validations/ambassador.test.ts`, a self-approval case in `invite-admit.test.ts`.

## What was verified

- `tsc`, `eslint` (0 errors), `vitest` (708 pass), `npm run build` (placeholder env) all clean.
- Live-schema checks by the audit agents: columns, FK names used as embed hints, constraints, role/trigger behaviour.
- **Not verified:** a signed-in click-through (needs Google sign-in); the three audit slices that never finished (member
  pages, integration, database behaviour tests) and the deployed-health check; Slack.

## Open

- **Erasure** — `delete_participant` leaves an invitee's name/email/note and a coordinator's typed name in
  `ambassador_invites`, and a coordinator who granted roles hits an FK error (`participant_roles.granted_by`/`revoked_by`
  are NO ACTION, which also affects older roles). Needs a migration `00107`+ that redefines `delete_participant`; owner review.
- An invited applicant whose invite is not yet approved is still reviewable in the two-reviewer queue (decision pending).
- `settleApplication` still grants the role and updates the status in two steps; it now self-heals on the next review.
- The Vercel project has a variable whose comment holds what looks like a live API secret — rotate it and clear the comment.
