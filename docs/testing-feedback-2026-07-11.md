# OLOS Testing Feedback — Triage

## Fix Now (blocks or breaks initial Cycle registration)

**Registration**
- Remove helper text on names/zip — *Confusing interaction*
- Fix broken links in Participant Agreement — *Bug*
- Fix "Washington, DC, DC" location rendering — *Bug*

**Registering for Cycle**
- First page needs to explain the Theme before asking what draws them to it — *Confusing interaction*
- Add a description of what the Cycle will cover — *Missing behavior*
- Fix helper text (Jennifer flagged as confusing) — *Confusing interaction*
- Soften date language ("I'll make my best effort to be there") — *Copy*
- List dates out more clearly — *Copy* (Cycle date logic exists in a separate requirements doc — locate and pull in)
- "All Cycles" view still shows "Register" for a Cycle the user is already registered in — *Bug*
- Fix "active" definition — participants should be active by default until proven inactive; currently nobody reads as active even when the first Learning Log isn't due yet — *Bug*

**Dashboard**
- Reorder To Do list so civics/elections registration comes first — *Confusing interaction*
- Soften "Locked in" language on Your Commitments (e.g., "Key dates") — *Copy*
- "Choose a pod" appears on To Do list after Cycle registration when no pod is open yet — *Bug*

**Learning Log** *(flagged — Friday deadline)*
- First Learning Log needs to be live and set a baseline pegged to SDT — *Missing behavior*

**Events** *(flagged — data-integrity call)*
- App registration for events skips the Luma registration questions — *Data integrity*

---

## Fix Soon (post-registration UX, polish, bugs)

**Registration**
- Prefill names from Google Account — *Missing behavior*

**Registering for Cycle**
- "Add events" at end of registration should pull in Luma events with one-click register — *Missing behavior*

**Profile**
- Slug numbers (do we need them?) — *UX polish*
- Prefill zip, role, hours based on sign-up and Cycle registration — *Missing behavior*
- Save Profile scrolls to top but success message is at bottom — *Bug*
- Add pinned "back" button — *Missing behavior*
- Fix Profile "back" — should return to dashboard, not directory — *Bug*
- Consolidate View and Edit Profile — *Confusing interaction*

**Directory**
- Rework Active/Forming/Inactive labels — *Confusing interaction*
- Follow count doesn't update without hard refresh — *Bug*
- Move Follow and follower count inside the card — *UX polish*
- Clicking Pods fails and toggles back to "All" — *Bug*
- Pod page in Directory shows the poderator view to all viewers (pulse check completion, avg energy shouldn't be exposed) — *Bug*
- Broader permissions logic isn't following intent (see requirements in the repo) — *Bug*

**Dashboard**
- Make Update/Learning Log toggle more obvious — *Confusing interaction*
- Strike the "view your full profile" CTA in the header — *UX polish*
- Make the big blue hero dismissible — *UX polish*
- Pin "back to dashboard" on every page — *Missing behavior*
- Keep Show/Collapse control in the same spot — *UX polish*
- Match Learning Log prominence to its required status — *Confusing interaction*
- Hide "find your local lab" quick link when user is already registered to a lab — *Bug*
- More prominent Support button, and add it to the footer — *UX polish*
- To Do list reopens when a new Cycle is added (likely unintended) — *Bug*
- Link each commitment in "Your Commitments" to its event (Luma is still the required registration path) — *Missing behavior*

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
- Submitting problem statements doesn't work in production — *Bug*
- Re-evaluate what the submission process should look like — *Confusing interaction*
- Problem registration form scrolls to the bottom on each advancement — should stay at top — *Bug*
- Redo the problem registration form — question order doesn't make sense, and some questions aren't relevant (e.g. impact tracks) — *Confusing interaction*
- After submitting a problem registration form, offer a "back to dashboard" button (or similar next step) — *Missing behavior*

---

## Outside the App

- Add nudge on Luma directing people to register for the Cycle

---

## Feature Request

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
