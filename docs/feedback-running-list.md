# Feedback — Running List

Raw feedback thoughts captured during hands-on testing. Deduped against merged work in the 2026-07-15 triage pass (every line below was verified against code on main/dev; "triage branch" = the 2026-07-15 feedback-triage branch).

## How to add feedback

Add a row to the table below (next number, today's date) and, if there's more to say than fits in a row, a matching `### N — Title (date)` section under **Details**. Every entry should cover four things:

1. **Describe the issue** — what you observed and, where it isn't obvious, what you expected instead. Concrete beats general: name the page/flow and what you were doing.
2. **Urgency** — does it feel urgent (blocks or breaks something people are actively using) or can it wait? Say so explicitly.
3. **Needs more thought?** — is the fix clear-cut, or does it need design/product judgement before anyone implements it? Flag open questions rather than implying the fix is settled.
4. **Who's submitting** — your name, so follow-up questions have somewhere to go.

Status legend: 🆕 new · 🔍 needs-dedupe · ✅ addressed · ❌ won't-do · 🧭 needs a product decision

| # | Date | Area | Feedback | Status |
|---|------|------|----------|--------|
| 1 | 2026-07-12 | Cycle registration | Can't register for a cycle while the problem-statement window is open, but registration *should* be allowed during that window. **Root cause confirmed** — Register CTA only renders for `status='upcoming'` cycles; disappears once cycle goes `active`. | ✅ |
| 2 | 2026-07-12 | Problem statements | After submitting a problem statement, I should be able to see my own submission (confirmation / list of what I submitted). | ✅ |
| 3 | 2026-07-12 | Voting UX | Exceeding vote budget: interaction is confusing (shows "can't click" icon, buffers, then applies one vote anyway), and the follow-up error message on trying again isn't clear. Should say "You have used all of your votes. Remove votes from a problem statement before adding them to a new one." | ✅ |
| 4 | 2026-07-12 | Voting UX | Can't see where my votes went — no visibility into which problem statement(s) I've allocated votes to. | ✅ |
| 5 | 2026-07-12 | Voting UX | No ability to remove/undo votes once cast on a problem statement. | ✅ |
| 6 | 2026-07-12 | Profile | Should be able to auto-fill state from zipcode (state lookup from zip) instead of entering it manually. | ✅ |
| 7 | 2026-07-12 | Profile | Availability isn't populating in the profile after completing cycle registration — the availability captured during registration should carry through to the profile. | ✅ |
| 8 | 2026-07-12 | Dashboard | The "You're pre-registered" card is a dead end — it should link through to the cycle page. | ✅ |
| 9 | 2026-07-12 | Pages / admins | Adding page admins shouldn't happen from a page's "view" page — removed from the pod page for now; decide where page-admin management belongs. | 🧭 |
| 10 | 2026-07-12 | Auth / login | The intro/welcome screen shows even when signing back in — it should only appear when creating an account, not on return login. | ✅ |
| 11 | 2026-07-12 | Labs / waitlist | Decide what additional information to collect when someone joins the waitlist for a lab in a city that doesn't have one yet. | 🧭 |
| 12 | 2026-07-14 | Cycles / pods | Closing a cycle doesn't touch its pods — the Energy & Climate pods still showed `active` in prod after the cycle went `closed`. Rule: when a cycle's status flips to `closed`, set its pods `inactive` in the same admin action. | ✅ |
| 13 | 2026-07-15 | Problem statements | Users should be able to **view and edit** their problem statements after submission — right now there's just a small card/preview of what they submitted. Extends #2. | 🆕 |
| 14 | 2026-07-17 | Org Cycle | I am very confused about how org cycles are created and staffed. I am not sure what chartered means. | 🆕 |
| 15 | 2026-07-17 | Learning Log | I opened the learning log from My Cycle and it went back to my dashboard to show it to me. This doesn't feel like the right UX. I would prefer for it to open right there. | 🆕 |
| 16 | 2026-07-17 | Poderator Learning Log View | This is really confusing as it shows both the Pulse Check and Learning Log - only one should show based on the cycle. | 🆕 |

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

**Addressed (2026-07-15):** The pod-registration redesign had already delivered (b) — the derived D-10 window (`registrationWindow()` in `lib/cycles/schedule.ts`, reading `cycle_phases`/`cycle_config`) — and the dashboard already surfaced a window-gated Register into the active cycle. The remaining UI gap was parity: `/cycles` still keyed its Register cards on `status='upcoming'`, and the cycle detail page had no Register entry at all. Triage branch: `/cycles` now includes the active cycle in "Open for registration" when the viewer hasn't signed its agreement and the window is open, and the cycle detail page gets the same window-gated Register card.

### 2 — Can't see my own problem statement after submitting (2026-07-12)
**Observed:** After submitting a problem statement, there's no way to view my own submission — no confirmation showing what I submitted, and it doesn't appear in a "my submissions" list. Expectation is that once submitted, I can see my problem statement(s) back.

**To investigate:** whether the propose flow shows a post-submit confirmation of the actual text, and whether the cycle page / a "my problem statements" view lists the current user's own submissions. The GET route (`app/api/problem-statements/[cycle_id]/route.ts`) filters by the viewer's `metro_id`/lab — check whether that filtering hides the user's own just-submitted statement (e.g. metro mismatch, or listing only surfaces during the voting phase).

**Addressed (2026-07-15, triage branch):** Confirmed statements were only ever listed on the vote ballot during voting. Two additions: (a) the propose form's submitted screen now echoes the statement + how-might-we question back, with a Back-to-dashboard action; (b) the cycle detail page shows a "Your problem statements" section in every phase — an owner-scoped query on the page itself, deliberately not a change to the shared GET route (its per-lab filter shapes the ballot and stays as designed). Residual edge: a member who changes labs after submitting still won't see their old-lab statement on the *ballot* — by design under per-lab voting, and the cycle page now covers visibility.

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

**Addressed (2026-07-15, triage branch):** No zip→state util existed (`metroFromZip` maps zip→lab, not state). Added `lib/zip-state.ts` — a 3-digit-prefix map covering the DC-metro set the state field actually allows (MD/DC/VA/Other, incl. the 201-is-VA wrinkle), with tests — and the profile edit form now sets the state select when a 5-digit zip is completed; the select stays editable as the manual fallback.

### 7 — Availability not carried from cycle registration into profile (2026-07-12)
**Observed:** After completing cycle registration (which captures availability), the profile doesn't show that availability — it reads as empty/unpopulated.

**Expected:** Availability entered during cycle registration should persist to and display on the profile.

**To investigate:** where the cycle-registration/join flow (`/cycles/[id]/join` + `api/cycles/[id]/agreement`) stores availability vs. where the profile reads it — likely a mismatch between the registration-captured field and the profile's source column (or it's saved on an enrollment/agreement row but never surfaced on the participant profile).

**Addressed (already fixed, verified 2026-07-15):** Exactly the suspected mismatch — the ceremony captured `"2–4 hrs / week"`-style strings while the `availability` option list held older `"< 2 hrs/week"` values, so the agreement route's mirror silently no-op'd. Migration `00082_availability_reg_hours.sql` rebuilt the option list to match the ceremony strings byte-for-byte; the full capture (`ceremony.tsx` HOURS) → mirror (`agreement/route.ts`) → read (`participant_options` → profile) chain is intact. **Verify 00082 is applied in prod.**

### 8 — "Pre-registered" card should link to the cycle page (2026-07-12)
**Observed:** When the dashboard shows the "You're pre-registered" state for an upcoming cohort, the card is static — there's no way to click through to the cycle's page to see details.

**Expected:** The pre-registered card should be (or contain) a link to `/cycles/[cycle_id]` so a member can open the cohort page from it.

**To investigate:** `preRegisteredCard` in `app/(dashboard)/dashboard/page.tsx` (~line 610) renders a plain `<div>` with no link — wrap it in a `<Link href={\`/cycles/${cycle.id}\`}>` (or add a "View cycle" CTA), matching the clickable `joinCycleCard` right above it.

**Addressed (2026-07-15, triage branch):** Exactly that — the card is now a `<Link>` to `/cycles/[id]` with a "View cycle" CTA and the join card's hover affordance.

### 9 — Page-admin management doesn't belong on the "view" page (2026-07-12)
**Observed:** The pod view page (`/pods/[id]`) exposed the "Page admins" manager (add/remove admins) inline. Adding page admins from the public-ish view surface is the wrong place for it.

**Done for now:** Hidden on the pod page (#225) via a new `showAdminsManager={false}` prop on the shared `PageUpdatesSection` (`app/(dashboard)/page-updates-section.tsx`); the update composer stays. The manager still renders on other page types (lab/sector/workstream/project) until we decide holistically.

**To figure out later:** Where page-admin management *should* live — a dedicated page-settings/manage surface rather than the view page — and apply it consistently across all page types (`PageAdminsManager` / `app/api/pages/[type]/[id]/admins`). Then remove the temporary prop.

### 10 — Login shows the intro screen on return sign-in (2026-07-12)
**Observed:** The intro/welcome screen (meant for account creation) also appears when an existing member signs back in. A returning user shouldn't have to pass the onboarding intro to log in.

**Expected:** Show the intro only on account creation / first-time sign-up; on return login, go straight to the login step (and on to the dashboard).

**To investigate:** the sign-in flow under `app/(auth)/` and `lib/auth/` — where the intro/welcome step is rendered and whether it can branch on new-account vs. existing-account (e.g. distinguish sign-up from sign-in, or skip the intro when the auth user already has a participant record). See `lib/auth/CLAUDE.md` for the sign-in/role-resolution flow.

**Addressed (already fixed, verified 2026-07-15):** The July "two doors" login rework resolved this — `login-card.tsx` renders a bare sign-in for the Log-in door (intro/benefits only behind `?intent=join`/invites), `api/auth/callback` sends returning members straight to `/dashboard`, and `/register` redirects existing participants away. If a tester still hits an intro on return login, capture the exact URL — the branch logic is in place.

### 11 — What to collect when joining the waitlist for a lab in another city (2026-07-12)
**Needs judgement:** When someone is in a city without a Local Lab and joins the waitlist, decide what else we should capture beyond the basics — e.g. specific city/metro, how many others they know who'd join, willingness to help start/lead a lab, sector interest, contact/notify preferences. The answers shape whether/when we stand up a new lab.

**To figure out:** the intended data model + form for the no-lab / waitlist path (relates to the Local Labs model, `docs/LOCAL_LABS.md`, and the active-lab gate that currently holds lab-less members out of cycle registration). Define the fields, then wire the waitlist capture.

### 12 — Pods stay `active` after their cycle closes (2026-07-14)
**Observed:** All four Energy & Climate pods (prod cycle 1, `status='closed'`) still carried `pods.status='active'` and rendered active badges everywhere. Same latent state on the three HQ org pods (`active` under a `draft` cycle).

**Root cause (confirmed 2026-07-14):** `pods.status` is an independent, manually-managed column — no cascade exists anywhere (admin cycle routes, triggers, migrations) that touches pods when a cycle's status changes. Every surface renders `pods.status` straight from the table.

**Data fix (applied by hand to prod, 2026-07-14):** `UPDATE pods SET status = 'inactive' WHERE cycle_id = 1 AND status = 'active';` — note `pods_status_check` (00063) allows only `forming/active/inactive/dissolved`; `'closed'` exists in UI badge mappings (`POD_STATUS_VARIANT`) but not in the DB constraint. First attempt with `'closed'` bounced off the CHECK.

**Rule to implement:** when an admin sets a cycle's status to `closed`, set its pods `inactive` in the same action (in the admin cycle-update route — keep `pods.status` authoritative rather than deriving the badge from the cycle, so the column keeps one meaning). While there, reconcile the UI's phantom `closed` pod status with the DB's actual value set.

**Addressed (verified 2026-07-15):** The cascade already exists — `/api/cycles/[cycle_id]/status` calls `closeOutCycle()` (`lib/cycle/closeout.ts`) on `closed`/`archived`, which sets pods → **`dissolved`** (not `inactive` — a deliberate distinction), stamps memberships/moderator assignments, and graduates projects. The prod Energy & Climate pods predated this. The phantom-`closed` cleanup landed on the triage branch: every pod/project badge map now carries `dissolved` and drops `closed` (neither DB CHECK ever allowed it), and the directory's "inactive" filter matches `dissolved`. Note for admins: closed-cycle pods read **dissolved**, not inactive.

### 13 — View and edit problem statements after submission (2026-07-15)
**Observed:** After submitting a problem statement, all you get back is a small card/preview of what you submitted. There's no way to open the full submission, and no way to edit it after the fact.

**Expected:** A full view of your own submitted problem statement(s), plus the ability to edit them after submission (at least while the submission window is still open).

**To investigate:** Extends #2, whose fix (propose-form echo + the "Your problem statements" section on the cycle page) covers *seeing* the submission — a full detail view and editing are still missing. For edit: whether any update path exists on the problem-statements API (likely only POST today), what edit window makes sense (e.g. until the submission window closes / voting opens — editing after votes are cast is problematic), and where the edit surface should live (the cycle page card → detail view → edit form).

Folded in from the earlier `testing-feedback-2026-07-11.md` so all hands-on feedback lives in one doc; the original triage structure is preserved. **✅ = fixed on a branch/PR (not necessarily merged yet)**, with the PR noted inline; ⏳ = partially addressed; unmarked = still open.

### Fix Now (blocks or breaks initial Cycle registration)

**Registration**
- Remove helper text on names/zip — *Confusing interaction* — ✅ (#227)
- Fix broken links in Participant Agreement — *Bug* — ✅ (verified 2026-07-15: agreement body has no inline links; its references — /terms, /privacy, /code-of-conduct — all exist as pages and render as real anchors in `flow-screen.tsx`; the feedback likely predated those pages)
- Fix "Washington, DC, DC" location rendering — *Bug* — ✅ (`lib/metros-label.ts` `metroLabel()`, with tests)

**Registering for Cycle**
- First page needs to explain the Theme before asking what draws them to it — *Confusing interaction* — ✅ (ceremony steps 1–2 explain the cycle + theme before `theme_interest`; copy from `lib/cycles/info.ts` + `cycle_config.theme_description`, 00084)
- Add a description of what the Cycle will cover — *Missing behavior* — ✅ (same — `what_is_a_build_cycle` step)
- Fix helper text (Jennifer flagged as confusing) — *Confusing interaction* — 🧭 which string? Candidates are the `help` fields in `ceremony.tsx` (theme_interest, learning_goals, professional_goals, signature) — ask Jennifer to point at it, then it's a copy-only fix
- Soften date language ("I'll make my best effort to be there") — *Copy* — ✅ (#226)
- List dates out more clearly — *Copy* — ✅ (#226)
- "All Cycles" view still shows "Register" for a Cycle the user is already registered in — *Bug* — ✅ (verified: `registeredCycleIds` flips the CTA to "You're registered — view details") · see table #1
- Fix "active" definition — participants should be active by default until proven inactive — *Bug* — 🧭 **high-risk, needs product definition first**: current behavior is the opposite by design (`cycle_enrollments` default `'inactive'`; only an active pod membership promotes via `lib/enrollment/reconciler.ts`). Redefining touches the DB default, the shared reconciler, revocation paths, and directory/moderator surfaces — define "proven inactive" before any code

**Dashboard**
- Reorder To Do list so civics/elections registration comes first — *Confusing interaction* — ✅ (#228)
- Soften "Locked in" language on Your Commitments (e.g., "Key dates") — *Copy* — ✅ (#228)
- "Choose a pod" appears on To Do list after Cycle registration when no pod is open yet — *Bug* — ✅ (#228, window-gated pod row)

**Learning Log** *(flagged — Friday deadline)*
- First Learning Log needs to be live and set a baseline pegged to SDT — *Missing behavior* — ✅ (#264, merged to main and dev)

**Events** *(flagged — data-integrity call)*
- App registration for events skips the Luma registration questions — *Data integrity* — 🧭 **verified to be a documented design decision**, not a bug: `api/events/[event_id]/rsvp/route.ts` deliberately one-tap-registers signed-in members via the Luma guest-list API without Luma's questions (rationale: the Participant Agreement, incl. photo clause, already covers consent; anonymous visitors are linked out to Luma's own page, which does ask). Confirm the rationale holds or reverse it (reversal = a sizable Luma-API integration)

### Fix Soon (post-registration UX, polish, bugs)

**Registration**
- Prefill names from Google Account — *Missing behavior* — ✅ (#227)

**Registering for Cycle**
- "Add events" at end of registration should pull in Luma events with one-click register — *Missing behavior*

**Profile**
- Slug numbers (do we need them?) — *UX polish* — ✅ (00083 desuffixes handles where the base is unclaimed; the 00044 trigger still suffixes genuine collisions). ⚠️ **Prod decision**: applying 00083 changes `/u/[handle]` URLs with no redirect — previously shared numbered links 404
- Prefill zip, role, hours based on sign-up and Cycle registration — *Missing behavior* — ✅ hours (#238); zip→state (triage branch, table #6); role was already wired — `participants.role_intents` is a shared column that flows sign-up → profile edit, nothing to build
- Save Profile scrolls to top but success message is at bottom — *Bug* — ✅ (confirmation now renders at the top of the form, comment cites this feedback)
- Add pinned "back" button — *Missing behavior* — 🧭 the profile back link exists but isn't sticky; decide whether the persistent chrome (logo + Home nav + mobile tab, all → /dashboard) already satisfies this before adding another affordance
- Fix Profile "back" — should return to dashboard, not directory — *Bug* — ✅ (`member-profile-view.tsx` owner mode: "← Back to dashboard")
- Consolidate View and Edit Profile — *Confusing interaction* — ⏳ #268 made the dashboard profile card a single link and consolidated the actions; a true merged view+edit surface is a 🧭 product call (recommend keeping the two surfaces)

**Directory**
- Rework Active/Forming/Inactive labels — *Confusing interaction* — 🧭 needs the label taxonomy decided first (note: closed-cycle pods now read `dissolved`)
- Follow count doesn't update without hard refresh — *Bug* — ✅ profile/network/PYMK counts already refreshed; triage branch added `refreshOnChange` to the remaining count-bearing surfaces (project, pod, sector, local lab, workstream)
- Move Follow and follower count inside the card — *UX polish* — 🧭 directory rows currently have no follow control at all; net-new addition, watch per-row count query cost (`lib/directory/data.ts`)
- Clicking Pods fails and toggles back to "All" — *Bug* — ✅ (#225)
- Pod page in Directory shows the poderator view to all viewers (pulse completion, avg energy) — *Bug* — ✅ (#225)
- Broader permissions logic isn't following intent — *Bug* — ⏳ (partially #225)

**Dashboard**
- Make Update/Learning Log toggle more obvious — *Confusing interaction* — ⏳ the gated/baseline states already emphasize the log (red border, pip, default tab — #264 wiring); the ungated state keeps equal-weight tabs, which is a 🧭 call (recommend leaving until usage data says otherwise)
- Strike the "view your full profile" CTA in the header — *UX polish* — ✅ (#228)
- Make the big blue hero dismissible — *UX polish* — ✅ (#228)
- Pin "back to dashboard" on every page — *Missing behavior* — 🧭 see the Profile "pinned back" note — the shared nav already links Home/logo → /dashboard on every dashboard page
- Keep Show/Collapse control in the same spot — *UX polish* — ✅ (#228)
- Match Learning Log prominence to its required status — *Confusing interaction* — ⏳ same as the toggle note above
- Hide "find your local lab" quick link when user is already registered to a lab — *Bug* — ✅ (#228)
- More prominent Support button, and add it to the footer — *UX polish* — ✅ (#228, dashboard footer)
- To Do list reopens when a new Cycle is added — *Bug* — ✅ (#228, persistent collapse)
- Link each commitment in "Your Commitments" to its event — *Missing behavior* — 🧭 blocked on data, not markup: commitments render from the hardcoded `lib/cycles/anchor-events.ts` constants (placeholder ids, interim by its own header note), whose slugs aren't guaranteed to match real `/events/[slug]` pages — reconcile anchors with the synced `events` table first (recommend waiting for the Luma events cache work rather than linking to guessy slugs)

**Events**
- Reduce load time and fix landing at the footer — *Bug* — ✅ events are served from the DB cache (Luma sync cron), and a height-holding `AgendaSkeleton` was added specifically for the footer-landing (comment cites this feedback)
- Shorten Upcoming/Past pill — *UX polish* — ✅ (labels dropped their live counts; "N of M" readout carries the number)
- Bigger search bar — *UX polish* — ✅ (triage branch)
- Fix jumping pill size as results filter — *Bug* — ✅ (same count-free pills change)
- Photo rendering as rectangle instead of square — *Bug* — ✅ (`EventTeaser` passes `square` to `MediaFrame`)
- Clarify what the scroll of photos is pulling from — *Confusing interaction*

**Library**
- Put Learning Library behind login (with preview navigable to non-logged-in visitors) — *Missing behavior* — 🧭 currently fully public; needs "preview" defined (recommend: index stays public as the teaser, `[slug]` detail gated) before building the gate

**Problem Statements**
- Submitting problem statements doesn't work in production — *Bug* — ✅ (triage branch) root cause: the POST insert was the one participant write still going through the RLS user client, whose `WITH CHECK (participant_id = current_participant_id())` rejects in prod; now uses the service client like the agreement/votes writes (the route's own guard chain covers what the policy checked). **Verify end-to-end in prod once deployed**
- Re-evaluate what the submission process should look like — *Confusing interaction* — 🧭 pairs with the redo below
- Problem registration form scrolls to the bottom on each advancement — should stay at top — *Bug* — ✅ (#224)
- Redo the problem registration form — question order / relevance (e.g. impact tracks) — *Confusing interaction* — 🧭 needs an owner walkthrough of the current 6 steps (note: `proposal_data` JSONB keys constrain renames)
- After submitting, offer a "back to dashboard" button (or similar next step) — *Missing behavior* — ✅ (triage branch, with the submitted-text echo) · see table #2

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
- Insights hub linked from the explainer page — ⏳ the survey/insights work on dev (#270–#272: field surveys tied to cycles, share links, cycle-overview explainer) started this direction
- Graphic on the Cycle page showing where the current Cycle is (phase/position indicator) — ✅ `CyclePhaseIndicator` is the hero of `/cycles`
- "What to expect in a Cycle" resource to direct people to

**Profile**
- Public vs private toggle on the profile view
- Durable photo storage and contact consent capture

**Directory**
- Move Follow action to the main directory page
- Suggested follows based on local lab and pod membership

**Dashboard**
- Define when the To Do list fully dismisses — 🧭 today it collapses to a persistent "Setup · N/M" strip and never disappears (the #228 persistence is working as designed); recommend auto-hiding the strip some days after 100% completion
- "Learn how the Labs work" resource, prominently linked from dashboard

**Feedback**
- Structured feedback channels for Events and Library
