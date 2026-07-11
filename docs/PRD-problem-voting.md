# PRD — Problem voting: undo, error placement, voted indicators

| | |
|---|---|
| Status | Draft |
| Author | Drafted by Claude from the July 11 testing session (owner-triaged) |
| Last updated | 2026-07-11 |
| Source feedback | [`testing-feedback-2026-07-11.md`](testing-feedback-2026-07-11.md) — Problem Voting: can't undo a vote (Missing behavior); over-allocation error shows at the top, should sit by the submit button or be a toast (Confusing interaction); no indication of where you've already voted (Missing behavior) |
| Related code | `app/(dashboard)/cycles/[cycle_id]/vote/vote-ballot.tsx`, `app/api/votes/route.ts` (POST only), `app/api/votes/[cycle_id]/route.ts` (GET; returns `my_votes` since PR #224), `votes` table (`00001`, `UNIQUE(voter_id, problem_statement_id, cycle_id)`; RLS: SELECT + INSERT only) |
| Shipped separately | Correct budgets, stacking, truthful helper text, `my_votes` in GET — PR #224 |

## 1. Problem

After PR #224 members can stack votes and see a correct budget, but voting
is still one-directional and low-feedback:

1. **No undo.** No DELETE/unvote path exists anywhere (routes export only
   POST/GET; members have no UPDATE/DELETE RLS on `votes`). A mis-tap is
   permanent for the whole window.
2. **Error placement.** The over-allocation error renders in a banner at
   the top of the ballot (`vote-ballot.tsx` `{error && …}` above the list),
   far from the Vote button the member just pressed — on a long ballot they
   never see it.
3. **No persistent "you voted here."** The GET now returns `my_votes`, but
   the ballot only uses it for budget math; per-problem allocations aren't
   rendered after a reload.

## 2. Requirements

- **R1. Retract/adjust votes while the window is open.**
  `DELETE /api/votes` (body: `cycle_id`, `problem_statement_id`, optional
  `vote_count` to decrement; absent = remove the row). Server-side guards
  mirror POST: window open (`checkWindow`), enrolled, not revoked. Like the
  stacking increment, the write goes through the service client after
  validation (members hold no DELETE RLS) — or add a scoped RLS policy
  (`voter_id = current participant AND window open` is not expressible in
  RLS; prefer the service-client route pattern already established).
- **R2.** Ballot UI: each problem the member has votes on shows "Your
  votes: N" with − / + steppers (bounded by remaining budget) instead of a
  bare number input; zeroing out removes the row.
- **R3. Error placement:** validation errors render **inline at the
  problem row** that triggered them (under its Vote controls), with the
  top banner reserved for page-level failures (network, window closed).
  Client-side pre-check prevents most over-allocations from ever hitting
  the server (input `max` already binds to remaining — enforce on the
  button too).
- **R4. Voted indicators:** on load, `my_votes` marks each voted problem
  ("Your votes: N" badge) and the budget line shows allocated/total.
- **R5.** Tallies keep counting retracted votes correctly (recompute or
  decrement on DELETE response, matching the POST path's optimistic
  update).

## 3. Acceptance criteria

- Cast 3 votes on A, retract 2, add 2 to B — budget and tallies correct
  throughout and after reload; closing the window freezes both directions.
- An over-allocation attempt shows the message at the row, next to the
  control that caused it; the page-top banner appears only for
  network/window errors.
- A returning voter sees exactly where their votes sit without casting
  anything.

## 4. Open questions

1. Should retraction be disabled in the window's final N hours to prevent
   last-second strategic churn? (Program call; default: no restriction.)
2. Is an audit trail of retractions needed (a `votes_log`), or is the
   current-state row enough? Current-state recommended for v1.
