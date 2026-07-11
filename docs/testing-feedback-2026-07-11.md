# OLOS Testing Feedback — Triage

## Fix Now (blocks or breaks initial Cycle registration)

**Registration**
- Remove helper text on names/zip — *Confusing interaction* — **addressed** (#227)
- Fix broken links in Participant Agreement — *Bug* — **addressed** (verified in #226: links now resolve to on-site /terms, /privacy, /code-of-conduct — the breakage predated the on-site pages migration)
- Fix "Washington, DC, DC" location rendering — *Bug* — **addressed** (#229)

**Registering for Cycle**
- First page needs to explain the Theme before asking what draws them to it — *Confusing interaction* — *requirements: [PRD-cycle-registration.md](PRD-cycle-registration.md)*
- Add a description of what the Cycle will cover — *Missing behavior* — *requirements: [PRD-cycle-registration.md](PRD-cycle-registration.md)*
- Fix helper text (Jennifer flagged as confusing) — *Confusing interaction* — *requirements: [PRD-cycle-registration.md](PRD-cycle-registration.md)*
- Soften date language ("I'll make my best effort to be there") — *Copy* — **addressed** (#226)
- List dates out more clearly — *Copy* (Cycle date logic exists in a separate requirements doc — locate and pull in) — **addressed** (#226: dates render as a list in the agreement; source is lib/cycles/anchor-events.ts)
- "All Cycles" view still shows "Register" for a Cycle the user is already registered in — *Bug* — **addressed** (#226)
- Fix "active" definition — participants should be active by default until proven inactive; currently nobody reads as active even when the first Learning Log isn't due yet — *Bug* — *requirements: [PRD-enrollment-activation.md](PRD-enrollment-activation.md) (moved to spec per owner call; rule decided: active from enrollment, pulse-driven demotion)*

**Dashboard**
- Reorder To Do list so civics/elections registration comes first — *Confusing interaction* — **addressed** (#228)
- Soften "Locked in" language on Your Commitments (e.g., "Key dates") — *Copy* — **addressed** (#228: now "Key dates")
- "Choose a pod" appears on To Do list after Cycle registration when no pod is open yet — *Bug* — **addressed** (#228: gated on the pod-registration window)

**Learning Log** *(flagged — Friday deadline)*
- First Learning Log needs to be live and set a baseline pegged to SDT — *Missing behavior* — *requirements: [PRD-learning-log.md](PRD-learning-log.md) — time-boxed, first log due next week*

**Events** *(flagged — data-integrity call)*
- App registration for events skips the Luma registration questions — *Data integrity* — *requirements: [PRD-events.md](PRD-events.md) §2.1*

---

## Fix Soon (post-registration UX, polish, bugs)

**Registration**
- Prefill names from Google Account — *Missing behavior* — **addressed** (#227)

**Registering for Cycle**
- "Add events" at end of registration should pull in Luma events with one-click register — *Missing behavior* — *requirements: [PRD-luma-event-registration.md](PRD-luma-event-registration.md)*

**Profile**
- Slug numbers (do we need them?) — *UX polish* — **addressed** (#229, migration 00078 — de-suffixes handles without live collisions; note in PR re: changed URLs)
- Prefill zip, role, hours based on sign-up and Cycle registration — *Missing behavior* — **addressed** (#229: zip/role already loaded; hours now preselects from the cycle-registration answer)
- Save Profile scrolls to top but success message is at bottom — *Bug* — **addressed** (#229)
- Add pinned "back" button — *Missing behavior* — *requirements: [PRD-dashboard.md](PRD-dashboard.md) §2.1*
- Fix Profile "back" — should return to dashboard, not directory — *Bug* — **addressed** (#229)
- Consolidate View and Edit Profile — *Confusing interaction* — *requirements: [PRD-profile.md](PRD-profile.md)*

**Directory**
- Rework Active/Forming/Inactive labels — *Confusing interaction* — *requirements: [PRD-directory.md](PRD-directory.md)*
- Follow count doesn't update without hard refresh — *Bug* — **addressed** (#229)
- Move Follow and follower count inside the card — *UX polish* — **addressed** (#229)
- Clicking Pods fails and toggles back to "All" — *Bug* — **addressed** (#225 — root-cause fix for the URL-sync race; confirm on the dev preview)
- Pod page in Directory shows the poderator view to all viewers (pulse check completion, avg energy shouldn't be exposed) — *Bug* — **addressed** (#225: pulse dashboard removed from the public pod page; the poderator surface is /moderator/pods/[id])
- Broader permissions logic isn't following intent (see requirements in the repo) — *Bug* — **partially addressed** (#225 fixed the pulse-data leak); four-tier visibility specced in [PRD-directory.md](PRD-directory.md) §2.2

**Dashboard**
- Make Update/Learning Log toggle more obvious — *Confusing interaction* — *requirements: [PRD-learning-log.md](PRD-learning-log.md) §3.2*
- Strike the "view your full profile" CTA in the header — *UX polish* — **addressed** (#228)
- Make the big blue hero dismissible — *UX polish* — **addressed** (#228)
- Pin "back to dashboard" on every page — *Missing behavior* — *requirements: [PRD-dashboard.md](PRD-dashboard.md) §2.1*
- Keep Show/Collapse control in the same spot — *UX polish* — **addressed** (#228)
- Match Learning Log prominence to its required status — *Confusing interaction* — *requirements: [PRD-learning-log.md](PRD-learning-log.md) §3.2*
- Hide "find your local lab" quick link when user is already registered to a lab — *Bug* — **addressed** (#228)
- More prominent Support button, and add it to the footer — *UX polish* — **addressed** (#228: new dashboard footer with support + feedback launcher)
- To Do list reopens when a new Cycle is added (likely unintended) — *Bug* — **addressed** (#228: collapse persists; new items surface as a count on the strip)
- Link each commitment in "Your Commitments" to its event (Luma is still the required registration path) — *Missing behavior* — *requirements: [PRD-luma-event-registration.md](PRD-luma-event-registration.md) §3.2*

**Events**
- Reduce load time and fix landing at the footer — *Bug* — **addressed** (#230: skeleton fallback fixes the footer landing; load-time caveat in the PR — the route is inherently dynamic)
- Shorten Upcoming/Past pill — *UX polish* — **addressed** (#230)
- Bigger search bar — *UX polish* — **addressed** (#230)
- Fix jumping pill size as results filter — *Bug* — **addressed** (#230)
- Photo rendering as rectangle instead of square — *Bug* — **addressed** (#230: gallery slides now 1:1, width-capped)
- Clarify what the scroll of photos is pulling from — *Confusing interaction* — *requirements: [PRD-events.md](PRD-events.md) §2.2*

**Library**
- Put Learning Library behind login (with preview navigable to non-logged-in visitors) — *Missing behavior* — *requirements: [PRD-library.md](PRD-library.md)*

**Problem Statements**
- Submitting problem statements doesn't work in production — *Bug* — **addressed** (#224: config reads hardened + explicit not-configured messaging; ops checklist in the PR)
- Re-evaluate what the submission process should look like — *Confusing interaction* — *requirements: [PRD-problem-statements.md](PRD-problem-statements.md)*
- Problem registration form scrolls to the bottom on each advancement — should stay at top — *Bug* — **addressed** (#224)
- Redo the problem registration form — question order doesn't make sense, and some questions aren't relevant (e.g. impact tracks) — *Confusing interaction* — *requirements: [PRD-problem-statements.md](PRD-problem-statements.md)*
- After submitting a problem registration form, offer a "back to dashboard" button (or similar next step) — *Missing behavior* — *requirements: [PRD-problem-statements.md](PRD-problem-statements.md) §2.3*

**Problem Voting**
- Voting is buggy — vote allocation doesn't match the rules — *Bug* — **addressed** (#224: budgets are config-driven and shown correctly)
- Helper text is broken/inaccurate: says submitters get 3 votes and non-submitters get 1, but a submitter received only 1 vote — *Bug* — **addressed** (#224)
- Voting doesn't allow stacking multiple votes on one problem — it should — *Bug* — **addressed** (#224)
- Can't undo/retract a vote once cast — users need to be able to — *Missing behavior* — *requirements: [PRD-problem-voting.md](PRD-problem-voting.md)*
- Over-allocation error shows at the top — move it next to the submit button, or make it a toast — *Confusing interaction* — *requirements: [PRD-problem-voting.md](PRD-problem-voting.md)*
- No visible indication of where you've already voted — *Missing behavior* — *requirements: [PRD-problem-voting.md](PRD-problem-voting.md)*

---

## Outside the App

- Add nudge on Luma directing people to register for the Cycle

---

## Feature Request

**Cycle**
- Cycle explainer page — *requirements: [PRD-cycle-explainer.md](PRD-cycle-explainer.md)*
- Insights hub linked from the explainer page — *requirements: [PRD-cycle-explainer.md](PRD-cycle-explainer.md)*
- Graphic on the Cycle page showing where the current Cycle is (phase/position indicator) — *requirements: [PRD-cycle-explainer.md](PRD-cycle-explainer.md)*
- "What to expect in a Cycle" resource to direct people to — *requirements: [PRD-cycle-explainer.md](PRD-cycle-explainer.md)*

**Profile**
- Public vs private toggle on the profile view — *requirements: [PRD-profile.md](PRD-profile.md)*
- Durable photo storage and contact consent capture — *requirements: [PRD-profile.md](PRD-profile.md)*

**Directory**
- Move Follow action to the main directory page — *requirements: [PRD-directory.md](PRD-directory.md)*
- Suggested follows based on local lab and pod membership — *requirements: [PRD-directory.md](PRD-directory.md)*

**Dashboard**
- Define when the To Do list fully dismisses — *requirements: [PRD-dashboard.md](PRD-dashboard.md)*
- "Learn how the Labs work" resource, prominently linked from dashboard — *requirements: [PRD-dashboard.md](PRD-dashboard.md)*

**Feedback**
- Structured feedback channels for Events and Library — *requirements: [PRD-events.md](PRD-events.md) §2.3 + [PRD-library.md](PRD-library.md) R5*
