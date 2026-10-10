# Ambassador UI/UX plan

> **Status:** proposal (2026-10-10), written against the code on `brendan-cld/charming-einstein-0tsaej`
> after the invite-approval change (`00106`). Nothing here is built. Read
> [`CLAUDE.md`](CLAUDE.md) first for how the role works today.
> **Evidence:** a read of the current screens (not a live usability test) and a scan of similar products
> (Greenhouse, LaunchDarkly, Palantir Foundry, GOV.UK/NHS patterns, Google Summer of Code, GitHub Campus
> Experts, Mozilla Reps, Discord). Section 9 lists what is vendor-reported or unverified.

## 1. What "amazing" means here

Six principles. The first three are OLOS's own constitution, so they bind every item below.

1. **Shepherd, not manager.** Nothing shames anyone who is behind. A slow reviewer gets a quiet,
   human-sent nudge, never a public "overdue" badge.
2. **No engagement machinery.** No streaks, leaderboards, badges-as-clout, countdown theatre, or
   notifications-as-hooks. No read-tracking ("seen by…") and no activity telemetry. Ambassador "impact" stays a
   plain count, never a ranking.
3. **Consent first.** Every email is consent-gated (`contact_consent`), one call to action, idempotent through
   `email_log`, dry-run by default, as the other OLOS emails are.
4. **Always say what happens next, and who to ask.** Every waiting, declined or approved state names the next
   step, a rough timeframe, and a person.
5. **The queue leads.** Each role's home answers "what needs me?" before anything else.
6. **Same words everywhere.** One status vocabulary shared by the applicant, the coordinator and the admin
   (section 4). Copy rules: "The Labs" (never "TUL"), "Upskiller", "Poderator"; never course, class, student,
   lesson or module.

## 2. Who uses it, and what each needs

| Person | Their job | Today's biggest gap |
|---|---|---|
| **Visitor / applicant** | Understand the role, apply, know where they stand | Waiting screen is generic; a decline is a dead end |
| **Invitee** | Accept a personal invitation without friction | Told "two reviewers" when they are really waiting on an invite approval |
| **Ambassador** | Get ready, get the button, bring people in | Coordinator is anonymous; handover is off-screen; nominee status invisible |
| **Coordinator (Lab lead)** | Review, approve invites, hand over buttons | Six equal sections; invites to approve are buried; silent failures; browser pop-ups |
| **Admin / HQ** | Break ties, see across Labs, keep things moving | No cross-Lab view, no "stuck" signal, no audit trail screen |
| **Nominator (an ambassador)** | Suggest someone, trust it went somewhere | Never hears what happened |

## 3. The journeys, as they should feel

**Applicant.** Land on the program page → "Become an ambassador" → quiz and agreement (progress shown as
"step 2 of 4", save-and-resume) → a confirmation that follows the GOV.UK pattern: *what you did, what happens
next, roughly when, who to ask, and that nothing more is needed from them* → a status page they can bookmark →
an email when it changes. A decline reads like Google Summer of Code's best notices: thanks, a plain outcome,
a non-personal framing, how and when they can be considered again, and a named contact.

**Invitee.** The invite banner says exactly what is true: "{name} invited you. Once a second coordinator
approves the invite, you're in." After finishing, they see "You're done. We're waiting on the invite approval"
(not "two reviewers"), and an email the moment it is approved.

**Ambassador.** Home leads with the single next action. A **Your coordinator** card gives their name, Lab and
how to reach them. The button handover is a visible state: "Ready — {coordinator} will arrange your button"
then "Given {date}". A **People you've brought in** panel shows plain counts and neutral statuses for their
nominations and share-link joins.

**Coordinator.** One workbench. The default view is **Needs you**, a single prioritised list mixing:
applications to review, invites to approve, ambassadors ready for a button, and open nominations. Each row has
what it is, who, how long it has waited, and one clear action. Tabs sit beside it: People, Invites,
Nominations, History. Everything works on a phone.

**Admin.** The same workbench with a Lab filter, plus a **Lab overview** (counts by status per Lab, median
days to decision, items older than a threshold) and a **tie-break** lane. An **Audit** view shows, for any
ambassador, who invited, who approved, who reviewed and who decided.

## 4. One status model

Applicant-facing labels (and their coordinator/admin meaning):

| Label shown | Internal state | What the page says next |
|---|---|---|
| Getting started | `started` | Finish the quiz and agreement |
| In review | `pending`, no invite | "Two reviewers look at every application, usually within {n} days." |
| Waiting on your invite | `pending`, invite not yet approved | "{inviter}'s invite is being confirmed by a second coordinator." |
| You're an ambassador | `approved` | Guide, coordinator card, button state |
| Not this time | `declined` | Thanks, outcome, when to reapply, who to ask |
| Stepped back | `stepped_back` | How to come back |

Coordinators see the same labels plus the count ("1 of 2 reviews"), never reviewer names to the applicant.
The `{n} days` figure comes from real timestamps (median `submitted_at` → `decided_at`), not a promise.

## 5. Notifications (all consent-gated, one CTA each)

| Event | To | Channel | Notes |
|---|---|---|---|
| Application submitted | Lab's coordinators | In-app task now; email **only if decision 6 allows**, as a daily digest | Digest, not one email per item. Opt-out per person |
| Invite drafted | Other coordinators of that Lab | Digest + in-app | Author excluded |
| Invite approved | Invitee (if email on invite) and the author | Email | "You're approved to finish" |
| Decision made | Applicant | Email + status page | Uses the kind decline template |
| Reviewer slow (> {n} days) | The reviewer, privately | A **manual** "nudge" button for coordinators/admins, plus one automatic reminder | One reminder, then silence. No public "overdue" label and no "seen" tracking |
| Ready for button | Coordinator | Digest + in-app | |

**Conflicts with a recorded decision.** [`CLAUDE.md`](CLAUDE.md) says "No emails to coordinators" (the
queue is a dashboard task and a page). Everything in the table that emails a coordinator or reviewer is
therefore **proposed, not decided**; the default without an owner decision is in-app only (dashboard task,
badge, and the manual nudge as a message the coordinator sends themselves). Emails to applicants and invitees
do not conflict with it.

Reuses the existing `lib/email` templates and `email_log`; no new channel infrastructure is needed for email.
Slack approve-from-message (LaunchDarkly style) is a later option and needs its own decision (ADR-0003 limits
Slack DMs).

## 6. Roadmap

Sizes: S ≈ ≤ 1 day, M ≈ 2–4 days, L ≈ 1–2 weeks. **A wireframe lands before each new page or mode**
(`documentation-framework.md` §5); the wireframe tasks are listed explicitly.

### Phase 0 — Correctness fixes (S–M, do in the current PR or the next)
- Waiting-on-invite wording on the apply "Almost there" screen and the Ambassador home (section 4).
- Surface server errors on every coordinator action (approve, withdraw, nominations, step back).
- Replace `window.prompt` / `window.confirm` with an accessible dialog (focus trap, Esc, labelled).
- Declined state: drop the "Their note" line that never has content; show the kind decline copy and a contact.
- Show invites awaiting approval inside "Waiting for you" (the badge already counts them).
- Show the approver the Lab, note and nomination context; record and show "approved by".

### Phase 1 — The coordinator workbench (L)
- **Wireframes:** Needs-you list, mobile card layout, invite detail, review page.
- One **Needs you** list with filters (Lab, type) and counts per tab; cards on phones instead of wide tables.
- Invite drawer: details, approve, or decline-with-reason (a new `declined` path for invites).
- Review page: a summary header (quiz, agreement, referrer, invite trail) and a confirm step with a result
  banner. Allow editing your own review until the round settles (open decision, section 8).
- Pagination and search beyond 100 invites.
- Acceptance: a coordinator can clear a day's items on a phone using only the Needs-you list.

### Phase 2 — Status and communication (M–L)
- **Wireframes:** applicant status page, confirmation page, decline page.
- Applicant status page with the section 4 labels and a "What happens next" block (GOV.UK/NHS pattern).
- Email templates and the digest job (section 5), consent-gated and dry-run by default.
- Coordinator "nudge" action and a single automatic reviewer reminder.
- Acceptance: no applicant state lacks a next step, a rough timeframe, and a named contact.

### Phase 3 — The ambassador's home (M)
- **Wireframe:** Ambassador home with the coordinator card.
- **Your coordinator** card; visible button-handover states; step-back flow with an optional note.
- **People you've brought in:** counts and neutral statuses for nominations and share-link joins.
- Export/import for practice work kept on the device (a file the person owns), with a short explanation of why
  it is not stored on the server.

### Phase 4 — Admin and HQ (M–L)
- **Wireframes:** Lab overview, audit view.
- Lab overview: counts by status per Lab, median days to decision, items older than a threshold.
- Audit view per ambassador: invited by, invite approved by, reviews, decider, dates.
- Tie-break lane for admins.
- Acceptance: an admin can answer "which Labs are stuck, and on what?" in under a minute.

### Phase 5 — Quality bar (M, run alongside every phase)
- WCAG 2.1 AA pass: keyboard-only runs of the apply flow and the workbench, table semantics or card
  alternatives, dialog focus, colour contrast, status not conveyed by colour alone.
- Check at 390px and 768px; no horizontal page scroll.
- Empty, loading and error states for every list.
- Usability sessions: about five coordinators and five applicants before the full rollout. No personal
  names are committed to the repo.

## 7. How we will know it works (no telemetry)

All from records that already exist:
- Median and 90th-percentile days from `submitted_at` to `decided_at`.
- Share of `pending` applications older than 7 days.
- Days from invite created → approved → used.
- Coordinator and applicant "where do I…?" questions, tallied by hand in `docs/feedback-running-list.md`.

## 8. Decisions needed from the owner

1. May an applicant see *any* reason for a decline? Today reviewer notes are internal. Options: a kind generic
   message only; or a coordinator-sent short message chosen from vetted templates.
2. May a reviewer change their own review until the round settles? Better usability; slightly weaker "decided
   independently" guarantee.
3. Should a declined applicant be able to ask to be considered again (after how long), or only via a coordinator?
4. Hide a pending application with an unapproved invite from the two-reviewer queue until its invite is
   approved? (Currently both routes work.)
5. Should invites support a decline-with-reason (needed for Phase 1), or only withdraw?
6. Lift "No emails to coordinators" for an opt-in daily digest (section 5)? If not, coordinator
   notification stays in-app only.
7. Is a Slack approve-from-message worth building once email works?

## 9. Evidence and limits

- Strongest, on-point patterns: Greenhouse (reviews hidden until you submit yours, plus reminders; the
  3.6% figure is Greenhouse's own), LaunchDarkly and Palantir Foundry (approval inbox with a "waiting on me"
  filter, multi-channel notifications), GOV.UK and NHS confirmation pages ("what happens next", people
  bookmark them), Google Summer of Code decline notices.
- Programs closest to ours (GitHub Campus Experts, Mozilla Reps, Discord moderators) have staged onboarding and
  named mentors. Some pages are dated (2016–2021) and Reps has admitted mentoring capacity limits.
- I found **no** public, detailed UX case study of a coordinator dashboard for a community ambassador program.
  Talking directly to a comparable program's organisers would add more than further searching.
- The current-state critique comes from reading the code; it has not been checked in a browser or with users.
