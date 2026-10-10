# Ambassador invites: a second coordinator approves, then onboarding makes the invitee an ambassador

| | |
|---|---|
| **Date** | 2026-10-10 |
| **Ran by** | Brendan Whitaker + Claude Code (https://claude.ai/code/session_01QZ9W42V8U1Dc1Q8w3gZSTv) |
| **Branch / PR** | `brendan-cld/charming-einstein-0tsaej` · PR not opened yet |
| **Asked** | Review the branch; open applications stay reviewed, but an invited person should become an ambassador once onboarding is done, and "the invite itself needs reviewed before extension". |

## What was done

- **Review of the branch** (Ambassador role into OLOS, PR #489 line): design sound; two issues found in the
  invite path (non-atomic single-use claim; claim before the writes that depend on it).
- **Invite rule changed** — an open application still takes two reviewers. An invite is approved once, by a
  coordinator other than its author (`PATCH /api/ambassadors/invites/[id]`); the link works meanwhile but grants
  nothing. The invitee is admitted when the invite is approved *and* the quiz and agreement are done, whichever
  comes last (`admitInvitee`, `lib/ambassador/data.ts`). The approval is kept as a `source = 'invite'` review row.
- **Single-use claim made atomic** — the invite is claimed with a conditional update whose row count is checked.
- **Migration `00106`** — `ambassador_invites.approved_at` / `approved_by`; earlier invites backfilled as approved.
  `SCHEMA.md`, `docs/ambassadors/CLAUDE.md`, copy (`apply.json`, `invite.json`) and `CHANGELOG.md` updated.
- **Coordinator UI** — invites table shows "Waiting for a second coordinator to approve" with an Approve button
  (hidden from the author); the dashboard count includes invites awaiting this coordinator.
- **Tests** — `lib/ambassador/invite-admit.test.ts` (admit grants role and approves, retry-safe; invite problems).
- **Merged `origin/dev`** into the branch (clean); migration numbers `00104`–`00106` are free on `dev`.

## What was verified

- `npx tsc --noEmit` clean; `eslint` on the ambassador code clean; `vitest run lib/ambassador` — 45 tests pass.
- Not run: `npm run build`, the migrations against a database, or the new routes end to end.

## Decisions

- Invite review replaces "an invite counts as one approval" (owner decision, 2026-10-10). Recorded in
  `docs/ambassadors/CLAUDE.md`.
- Chosen with the owner: one other coordinator approves; the link works before approval but grants no role.

## Open

- A pending application with an unapproved invite is still in the normal two-reviewer queue, so reviewers can
  approve it that way. Hide until the invite is approved?
- `admitInvitee` / `settleApplication` grant the role and update the application in two steps, not one
  transaction; a failure between them can leave the role granted with the application still `pending`
  (a retry repairs it). A single RPC would close it.
- No route-level tests for the invite `PATCH` or the submit branch.
- Apply `00104`–`00106` to the dev database before testing.

## Next

Open one PR into `dev`; reviewers (Madhu, Aaron) check the invite and review routes and the auth-adjacent
`proxy.ts` / `return_to` changes, then test with a few accounts (open apply, invite approved by another
coordinator, the same link in two browsers, author trying to approve their own invite).
