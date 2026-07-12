# Feedback — Running List

Raw feedback thoughts captured during hands-on testing. **Not yet deduped** against changes already made — review and reconcile before acting.

Status legend: 🆕 new · 🔍 needs-dedupe · ✅ addressed · ❌ won't-do

| # | Date | Area | Feedback | Status |
|---|------|------|----------|--------|
| 1 | 2026-07-12 | Cycle registration | Can't register for a cycle while the problem-statement window is open, but registration *should* be allowed during that window. **Root cause confirmed** — Register CTA only renders for `status='upcoming'` cycles; disappears once cycle goes `active`. | 🔍 |
| 2 | 2026-07-12 | Problem statements | After submitting a problem statement, I should be able to see my own submission (confirmation / list of what I submitted). | 🆕 |
| 3 | 2026-07-12 | Voting UX | Exceeding vote budget: interaction is confusing (shows "can't click" icon, buffers, then applies one vote anyway), and the follow-up error message on trying again isn't clear. Should say "You have used all of your votes. Remove votes from a problem statement before adding them to a new one." | ✅ |
| 4 | 2026-07-12 | Voting UX | Can't see where my votes went — no visibility into which problem statement(s) I've allocated votes to. | ✅ |
| 5 | 2026-07-12 | Voting UX | No ability to remove/undo votes once cast on a problem statement. | ✅ |

## Details

### 1 — Registration blocked while problem statements are open (2026-07-12)
**Observed:** While a cycle's problem-statement window is open, cycle registration is unavailable. Expectation is that a participant should still be able to register during that window (registration and problem-statement submission windows should overlap, or registration shouldn't be gated closed by the problem-statement phase).

**Root cause (confirmed 2026-07-12):** There is *no* registration-window gate — enrollment is gated purely on cycle `status`. The only "Register" CTA in the UI is in `app/(dashboard)/cycles/page.tsx` (`upcomingCycles` filter, ~lines 80-82):
```js
const upcomingCycles = otherCycles.filter(
  (c) => c.mode !== "org" && c.status === "upcoming"
);
```
Once a cycle flips `upcoming` → `active` (which is also when the problem-statement window opens), it's rendered instead as a read-only "View cycle" quick-link to `cycles/[cycle_id]/page.tsx`, which has **no Register/Join button**. The join flow itself (`/cycles/[id]/join` + `api/cycles/[id]/agreement`) still *accepts* `status='active'` — it's purely that nothing in the UI links to it anymore.

**Possible fixes:** (a) surface the Register CTA for `active` open cycles too; or (b) gate registration on a real registration window (`registration_open`/`registration_close` — note these columns do **not** currently exist in `cycle_config`) instead of `status`.

**To dedupe against:** the pod-registration redesign (two status-keyed windows, decoupling membership from enrollment) — likely the intended home for a proper registration window. Reconcile before implementing.

### 2 — Can't see my own problem statement after submitting (2026-07-12)
**Observed:** After submitting a problem statement, there's no way to view my own submission — no confirmation showing what I submitted, and it doesn't appear in a "my submissions" list. Expectation is that once submitted, I can see my problem statement(s) back.

**To investigate:** whether the propose flow shows a post-submit confirmation of the actual text, and whether the cycle page / a "my problem statements" view lists the current user's own submissions. The GET route (`app/api/problem-statements/[cycle_id]/route.ts`) filters by the viewer's `metro_id`/lab — check whether that filtering hides the user's own just-submitted statement (e.g. metro mismatch, or listing only surfaces during the voting phase).

### 3 — Confusing UX when a vote exceeds the vote budget (2026-07-12)
**Observed:** When casting a vote that would exceed the participant's vote budget, the UI shows a "can't click" cursor icon, buffers, and then applies one vote anyway (inconsistent with the disabled-looking state). Trying to vote again afterward shows an error, but the error message isn't clear about *why*.

**Expected:** A clear, actionable error: "You have used all of your votes. Remove votes from a problem statement before adding them to a new one."

**To investigate:** the vote-casting client component and API route for problem-statement votes — likely near `submitter_votes`/`non_submitter_votes`/`vote_threshold` in `cycle_config` and wherever votes are POSTed. Check: (a) why a vote is applied despite the disabled-looking cursor state (race condition / stale disabled check?), and (b) what error message/copy the API currently returns on budget-exceeded vs. what's rendered client-side.

**Addressed (2026-07-12):** Made over-budget voting unreachable in the UI rather than relying on the server's cryptic 400. In `app/(dashboard)/cycles/[cycle_id]/vote/vote-ballot.tsx`: the number input now clamps typed values to `[0, remaining]` (typing a higher number reverts to your max), the input and Vote button are disabled once `remaining <= 0`, and the budget bar shows "You've used all of your votes for this cycle." The server budget check in `app/api/votes/route.ts` stays as a defense-in-depth backstop. Vote removal (the "remove votes…" half of the proposed copy) is **not** built — tracked separately as #5.

### 4 — No visibility into where my votes went (2026-07-12)
**Observed:** After casting votes on problem statements, there's no way to see which statement(s) currently have my votes allocated to them — no per-statement "you voted N here" indicator, no summary of my own vote allocation.

**Expected:** Some clear indication (e.g. a per-card badge/counter, or a "your votes" summary) showing how the participant's vote budget is currently distributed across statements.

**To investigate:** likely the same voting UI area as #3 — check whether the votes-cast data is even fetched/returned to the client per-statement, or only aggregate totals are shown.

**Addressed (2026-07-12):** Each ballot card now shows the viewer's own allocation. `GET /api/votes/[cycle_id]` already returned `my_votes` (per-statement), but `vote-ballot.tsx` discarded everything except the sum — it now keeps a `myVotes` map and renders "· you: N" on the tally line plus a "Your votes: N" state on the vote control. No server change was needed for visibility. Delivered together with #5.

### 5 — No ability to remove votes (2026-07-12)
**Observed:** Once a vote is cast on a problem statement, there's no way to remove/undo it. Combined with #3 (unclear budget-exceeded error) and #4 (can't see vote allocation), a participant who accidentally uses up their vote budget has no path to correct it.

**Expected:** Ability to remove/decrement a vote from a statement, freeing up budget to reallocate elsewhere — this is also a prerequisite for the error message proposed in #3 ("remove votes from a problem statement before adding them to a new one") to actually be actionable.

**To investigate:** the vote POST/DELETE API surface for problem-statement votes — check whether a remove/decrement endpoint exists at all, or only additive voting is implemented.

**Addressed (2026-07-12):** Only additive `POST` existed. Added a **set-absolute** `PUT /api/votes` (`app/api/votes/route.ts`) that takes the desired total for a statement (`voteSetSchema`, `vote_count >= 0`); one path covers add / increase / decrease / remove, and `vote_count = 0` deletes the row. It reuses POST's full guard chain (window, enrollment, revocation, same-lab, budget) and routes updates/deletes through the service client (`votes` has no UPDATE/DELETE RLS policy — same pattern as the existing increment); the budget check nets out this statement's current allocation so lowering it always frees budget. In `vote-ballot.tsx` the number-input + Vote button became a stepper (− N +) with an explicit Vote/Save submit: unvoted cards show the stepper directly; voted cards rest at "Your votes: N" with an Edit button that reopens the stepper (dial to 0 to remove, Cancel to back out). This also makes the #3 error copy ("remove votes… before adding them to a new one") actionable. Original `POST` left in place as a backstop; the ballot now uses `PUT` exclusively.
