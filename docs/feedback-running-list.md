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
| 6 | 2026-07-12 | Profile | Should be able to auto-fill state from zipcode (state lookup from zip) instead of entering it manually. | 🆕 |
| 7 | 2026-07-12 | Profile | Availability isn't populating in the profile after completing cycle registration — the availability captured during registration should carry through to the profile. | 🆕 |
| 8 | 2026-07-12 | Dashboard | The "You're pre-registered" card is a dead end — it should link through to the cycle page. | 🆕 |
| 9 | 2026-07-12 | Pages / admins | Adding page admins shouldn't happen from a page's "view" page — removed from the pod page for now; decide where page-admin management belongs. | 🆕 |
| 10 | 2026-07-12 | Auth / login | The intro/welcome screen shows even when signing back in — it should only appear when creating an account, not on return login. | 🆕 |
| 11 | 2026-07-12 | Labs / waitlist | Decide what additional information to collect when someone joins the waitlist for a lab in a city that doesn't have one yet. | 🆕 |
| 12 | 2026-07-12 | Profile / nav | Profile back link still lands in the Directory, not the page I came from. #229 fixed the owner `/profile` route (→ dashboard) but viewing your own profile via `/u/[handle]` still shows "Back to the Directory"; back should be referrer-aware. | 🆕 |
| 13 | 2026-07-12 | Dashboard | New user's setup / to-do list showed **collapsed** on first login (prod) — a brand-new member should see it expanded. | 🆕 |
| 14 | 2026-07-13 | Auth / login | Logging in with no account fails ungracefully — it should detect there's no account and direct you to create one. | 🆕 |

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

### 6 — Auto-fill state from zipcode on profile (2026-07-12)
**Observed:** The profile asks for state separately; entering a zipcode should be enough to derive the state.

**Expected:** A zip → state lookup so the state field auto-populates from the entered zipcode (manual entry as fallback).

**To investigate:** the profile edit form (`app/(dashboard)/profile/edit/`) and whatever registration/profile forms collect location — where zip and state are captured, and whether a zip→state mapping/util already exists in `lib/`.

### 7 — Availability not carried from cycle registration into profile (2026-07-12)
**Observed:** After completing cycle registration (which captures availability), the profile doesn't show that availability — it reads as empty/unpopulated.

**Expected:** Availability entered during cycle registration should persist to and display on the profile.

**To investigate:** where the cycle-registration/join flow (`/cycles/[id]/join` + `api/cycles/[id]/agreement`) stores availability vs. where the profile reads it — likely a mismatch between the registration-captured field and the profile's source column (or it's saved on an enrollment/agreement row but never surfaced on the participant profile).

### 8 — "Pre-registered" card should link to the cycle page (2026-07-12)
**Observed:** When the dashboard shows the "You're pre-registered" state for an upcoming cohort, the card is static — there's no way to click through to the cycle's page to see details.

**Expected:** The pre-registered card should be (or contain) a link to `/cycles/[cycle_id]` so a member can open the cohort page from it.

**To investigate:** `preRegisteredCard` in `app/(dashboard)/dashboard/page.tsx` (~line 610) renders a plain `<div>` with no link — wrap it in a `<Link href={\`/cycles/${cycle.id}\`}>` (or add a "View cycle" CTA), matching the clickable `joinCycleCard` right above it.

### 9 — Page-admin management doesn't belong on the "view" page (2026-07-12)
**Observed:** The pod view page (`/pods/[id]`) exposed the "Page admins" manager (add/remove admins) inline. Adding page admins from the public-ish view surface is the wrong place for it.

**Done for now:** Hidden on the pod page (#225) via a new `showAdminsManager={false}` prop on the shared `PageUpdatesSection` (`app/(dashboard)/page-updates-section.tsx`); the update composer stays. The manager still renders on other page types (lab/sector/workstream/project) until we decide holistically.

**To figure out later:** Where page-admin management *should* live — a dedicated page-settings/manage surface rather than the view page — and apply it consistently across all page types (`PageAdminsManager` / `app/api/pages/[type]/[id]/admins`). Then remove the temporary prop.

### 10 — Login shows the intro screen on return sign-in (2026-07-12)
**Observed:** The intro/welcome screen (meant for account creation) also appears when an existing member signs back in. A returning user shouldn't have to pass the onboarding intro to log in.

**Expected:** Show the intro only on account creation / first-time sign-up; on return login, go straight to the login step (and on to the dashboard).

**To investigate:** the sign-in flow under `app/(auth)/` and `lib/auth/` — where the intro/welcome step is rendered and whether it can branch on new-account vs. existing-account (e.g. distinguish sign-up from sign-in, or skip the intro when the auth user already has a participant record). See `lib/auth/CLAUDE.md` for the sign-in/role-resolution flow.

### 11 — What to collect when joining the waitlist for a lab in another city (2026-07-12)
**Needs judgement:** When someone is in a city without a Local Lab and joins the waitlist, decide what else we should capture beyond the basics — e.g. specific city/metro, how many others they know who'd join, willingness to help start/lead a lab, sector interest, contact/notify preferences. The answers shape whether/when we stand up a new lab.

**To figure out:** the intended data model + form for the no-lab / waitlist path (relates to the Local Labs model, `docs/LOCAL_LABS.md`, and the active-lab gate that currently holds lab-less members out of cycle registration). Define the fields, then wire the waitlist capture.

### 12 — Profile back link isn't referrer-aware (2026-07-12)
**Observed:** Viewing/editing my profile, the "back" still takes me to the Directory, not the dashboard (or page) I came from. #229 only fixed the owner `/profile` route.

**Root cause:** `member-profile-view.tsx` has two fixed back bars — owner (`/profile`) → `/dashboard`, visitor (`/u/[handle]`) → `/directory`. Reaching your *own* profile via `/u/[handle]` (e.g. clicking your name in the Directory) renders the visitor bar, so it says "← Back to the Directory." The Edit page also returns to a fixed default (`app/(dashboard)/profile/edit/page.tsx` back helper → `/dashboard`).

**Expected:** Back should return to wherever the user actually came from, regardless of which route rendered the profile — not a hardcoded `/directory` or `/dashboard`.

**To investigate:** make the back target referrer/`?next=`-aware across the profile view (both routes) and edit; and detect "this is my own profile" on `/u/[handle]` so the owner affordances (and a sensible back) apply there too.

### 13 — Setup/to-do list collapsed for a brand-new user (2026-07-12, prod)
**Observed:** On first login as a new user in production, the setup / to-do checklist rendered **collapsed**. A first-time member (nothing completed yet) should land with it **expanded**.

**Likely cause:** the collapse preference persists in `localStorage` (`olos.setupChecklistCollapsed.v1`, added in #228) which is **per-browser, not per-user**. A new account signed into a browser that previously collapsed — or completed — the checklist inherits the stored "collapsed" flag; the "completing setup cements the collapse" effect writes `"1"`, which then applies to the next user in that browser. `setup-checklist.tsx`: `collapsed = stored ?? allDone`.

**Fix direction:** make collapse state per-user (key the storage entry by participant id, or persist server-side), and/or always start expanded for a brand-new member with no completed items regardless of a stale flag.

### 14 — "Log in" with no account fails ungracefully (2026-07-13)
**Observed:** Choosing "Log in" when you don't have an account yet fails without a helpful path forward — it should recognize there's no account and route you to create one.

**Expected:** On a sign-in attempt for an email/identity with no participant account, degrade gracefully: a clear "no account yet — create one" message and a link/redirect into the sign-up / account-creation flow (rather than a dead-end error).

**To investigate:** the sign-in path under `app/(auth)/` and `lib/auth/` — how a login with no matching account is handled and where to branch to account creation. Relates to the recent "login doors" work (join explainer vs. straight sign-in, account chooser, no-account notice) already on dev; check whether that covers this case or leaves a gap. See also #10 (login intro on return) in the same area.

Folded in from the earlier `testing-feedback-2026-07-11.md` so all hands-on feedback lives in one doc; the original triage structure is preserved. **✅ = fixed on a branch/PR (not necessarily merged yet)**, with the PR noted inline; ⏳ = partially addressed; unmarked = still open.

### Fix Now (blocks or breaks initial Cycle registration)

**Registration**
- Remove helper text on names/zip — *Confusing interaction* — ✅ (#227)
- Fix broken links in Participant Agreement — *Bug*
- Fix "Washington, DC, DC" location rendering — *Bug*

**Registering for Cycle**
- First page needs to explain the Theme before asking what draws them to it — *Confusing interaction*
- Add a description of what the Cycle will cover — *Missing behavior*
- Fix helper text (Jennifer flagged as confusing) — *Confusing interaction*
- Soften date language ("I'll make my best effort to be there") — *Copy* — ✅ (#226)
- List dates out more clearly — *Copy* — ✅ (#226)
- "All Cycles" view still shows "Register" for a Cycle the user is already registered in — *Bug* — ⏳ (#226 touched the Register CTA — verify) · see table #1
- Fix "active" definition — participants should be active by default until proven inactive — *Bug*

**Dashboard**
- Reorder To Do list so civics/elections registration comes first — *Confusing interaction* — ✅ (#228)
- Soften "Locked in" language on Your Commitments (e.g., "Key dates") — *Copy* — ✅ (#228)
- "Choose a pod" appears on To Do list after Cycle registration when no pod is open yet — *Bug* — ✅ (#228, window-gated pod row)

**Learning Log** *(flagged — Friday deadline)*
- First Learning Log needs to be live and set a baseline pegged to SDT — *Missing behavior*

**Events** *(flagged — data-integrity call)*
- App registration for events skips the Luma registration questions — *Data integrity*

### Fix Soon (post-registration UX, polish, bugs)

**Registration**
- Prefill names from Google Account — *Missing behavior* — ✅ (#227)

**Registering for Cycle**
- "Add events" at end of registration should pull in Luma events with one-click register — *Missing behavior*

**Profile**
- Slug numbers (do we need them?) — *UX polish*
- Prefill zip, role, hours based on sign-up and Cycle registration — *Missing behavior* — ⏳ hours ✅ (#238); zip→state is table #6; role open
- Save Profile scrolls to top but success message is at bottom — *Bug*
- Add pinned "back" button — *Missing behavior*
- Fix Profile "back" — should return to dashboard, not directory — *Bug*
- Consolidate View and Edit Profile — *Confusing interaction*

**Directory**
- Rework Active/Forming/Inactive labels — *Confusing interaction*
- Follow count doesn't update without hard refresh — *Bug*
- Move Follow and follower count inside the card — *UX polish*
- Clicking Pods fails and toggles back to "All" — *Bug* — ✅ (#225)
- Pod page in Directory shows the poderator view to all viewers (pulse completion, avg energy) — *Bug* — ✅ (#225)
- Broader permissions logic isn't following intent — *Bug* — ⏳ (partially #225)

**Dashboard**
- Make Update/Learning Log toggle more obvious — *Confusing interaction*
- Strike the "view your full profile" CTA in the header — *UX polish* — ✅ (#228)
- Make the big blue hero dismissible — *UX polish* — ✅ (#228)
- Pin "back to dashboard" on every page — *Missing behavior*
- Keep Show/Collapse control in the same spot — *UX polish* — ✅ (#228)
- Match Learning Log prominence to its required status — *Confusing interaction*
- Hide "find your local lab" quick link when user is already registered to a lab — *Bug* — ✅ (#228)
- More prominent Support button, and add it to the footer — *UX polish* — ✅ (#228, dashboard footer)
- To Do list reopens when a new Cycle is added — *Bug* — ✅ (#228, persistent collapse)
- Link each commitment in "Your Commitments" to its event — *Missing behavior*

**Events**
- Reduce load time and fix landing at the footer — *Bug*
- Shorten Upcoming/Past pill — *UX polish*
- Bigger search bar — *UX polish*
- Fix jumping pill size as results filter — *Bug*
- Photo rendering as rectangle instead of square — *Bug*
- Clarify what the scroll of photos is pulling from — *Confusing interaction*

**Library**
- Put Learning Library behind login (with preview navigable to non-logged-in visitors) — *Missing behavior*

**Problem Statements**
- Submitting problem statements doesn't work in production — *Bug* (root cause likely environmental — see #224 notes)
- Re-evaluate what the submission process should look like — *Confusing interaction*
- Problem registration form scrolls to the bottom on each advancement — should stay at top — *Bug* — ✅ (#224)
- Redo the problem registration form — question order / relevance (e.g. impact tracks) — *Confusing interaction*
- After submitting, offer a "back to dashboard" button (or similar next step) — *Missing behavior* — see table #2

**Problem Voting**
- Voting is buggy — vote allocation doesn't match the rules — *Bug* — ✅ (#224)
- Helper text broken: submitters 3 / non-submitters 1, but a submitter got only 1 — *Bug* — ✅ (#224)
- Voting doesn't allow stacking multiple votes on one problem — *Bug* — ✅ (#224)
- Can't undo/retract a vote once cast — *Missing behavior* — ✅ (#224) · table #5
- Over-allocation error shows at the top — move next to submit / toast — *Confusing interaction* — ⏳ (#224 made over-budget unreachable + clearer copy; exact reposition/toast open)
- No visible indication of where you've already voted — *Missing behavior* — ✅ (#224) · table #4

### Outside the App
- Add nudge on Luma directing people to register for the Cycle

### Feature Request

**Cycle**
- Cycle explainer page
- Insights hub linked from the explainer page
- Graphic on the Cycle page showing where the current Cycle is (phase/position indicator)
- "What to expect in a Cycle" resource to direct people to

**Profile**
- Public vs private toggle on the profile view
- Durable photo storage and contact consent capture

**Directory**
- Move Follow action to the main directory page
- Suggested follows based on local lab and pod membership

**Dashboard**
- Define when the To Do list fully dismisses
- "Learn how the Labs work" resource, prominently linked from dashboard

**Feedback**
- Structured feedback channels for Events and Library
