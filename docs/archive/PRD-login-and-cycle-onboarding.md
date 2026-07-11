> **📁 ARCHIVED — historical record.** Pre-implementation PRD. The onboarding it proposes shipped via the onboarding-proto port (funnel registration, Open Cycle Agreement) and the #110 phases (enrollment reconciler, placeholder-name remediation). Current truth: [docs/ARCHITECTURE.md](../ARCHITECTURE.md) + [lib/auth/CLAUDE.md](../../lib/auth/CLAUDE.md). See [docs/EVOLUTION.md](../EVOLUTION.md) for the full story of how the app got here.

# PRD — Login, Profile, and Cycle Onboarding

| | |
|---|---|
| Status | Draft |
| Author | Madhu (drafted with Claude) |
| Last updated | 2026-05-19 |
| Related spec | [`TUL_MVP_Spec.md`](../TUL_MVP_Spec.md) §Registration & Enrollment, §Pod Registration, §Dashboard |
| Related code | [`app/(auth)/register/`](../app/(auth)/register/), [`app/(dashboard)/cycles/`](../app/(dashboard)/cycles/), [`lib/auth/CLAUDE.md`](../lib/auth/CLAUDE.md) |
| Related issues | TBD (file at implementation kickoff) |

## Overview

Today the OLOS sign-in path is: Google OAuth → if no `participants` row, redirect to `/register` → fill a ~25-field form → land on `/cycles` (a list of cycles). The form is doing too much work at the wrong moment: it asks for identity, location, professional context, AI background, and cycle-fit signal *before* the user has seen a single thing inside the product. And once a user is in, the landing page (`/cycles`) is a cycle directory rather than a personalized "here's what's happening for *you* right now" view.

This PRD proposes five tightly related changes that re-flow that experience:

1. **Shorten the login-time form** to the minimum needed to create a participant identity.
2. **Move the rest of the existing form into a longer "cycle interest" form** that fires when a user signals they want to join a specific Build Cycle.
3. **Send an email when a user submits that long form**, so the team has signal that someone wants in.
4. **Replace `/cycles` with a personalized dashboard** showing the current cycle and the user's status inside it.
5. **Surface the pod-join action on that dashboard**, capped at 2 active pods per cycle (matching the existing spec and DB constraint).

The features ship as one coordinated change because the new short form only makes sense alongside the new long-form gate, and the personalized dashboard is what stitches them together.

## Goals

- Reduce the time from "click Sign in with Google" to "successfully logged in" to a single screen with ≤ 5 fields.
- Move cycle-fit data collection to the moment it's relevant (when the user opts into a cycle), not the moment they create an account.
- Give every logged-in user a clear, personalized first view: which cycle is running, am I in it, what's my next action.
- Preserve the existing 2-pod-per-cycle cap and existing pod-registration window logic. No spec deviation.

## Non-goals

- Changing the OAuth flow itself (Google sign-in stays as-is, per [`lib/auth/CLAUDE.md`](../lib/auth/CLAUDE.md)).
- Changing the data the long form collects. We're moving fields between forms, not adding or removing them.
- Building admin tooling for reviewing cycle-join requests (separate work — see Open Questions).
- Changing the pod-cap from 2 to anything else.

## Glossary

- **Participant**: any row in `participants` — a user who has completed the short login form. Doesn't imply enrollment in any cycle.
- **Cycle enrollment**: a row in `cycle_enrollments` for `(participant_id, cycle_id)`. This is what gives a participant access to a specific Build Cycle.
- **Pod membership**: a row in `pod_memberships` for `(participant_id, pod_id)`. A participant can hold at most 2 active (not-`inactive_at`) memberships per cycle.

---

## Feature 1 — Shorter login-time form

### Goal

A new user can complete sign-in and be inside the product in under 30 seconds, with a form short enough to fit above the fold on a laptop.

### User flow

1. User clicks **Sign in with Google** on `/login`.
2. OAuth completes; callback at `/api/auth/callback` runs as today.
3. If `participants` row exists for that email → redirect to the personalized dashboard (Feature 4).
4. If no `participants` row → redirect to `/register` (this is the existing route, but the form behind it is now the *short* form).
5. User fills the short form. Submit creates a `participants` row.
6. User lands on the personalized dashboard (Feature 4).

The callback logic in [`app/api/auth/callback/route.ts`](../app/api/auth/callback/route.ts) does not change. Only the form rendered at `/register` changes.

### Visual reference

The short form mirrors the existing public **Join The Labs** interest form on the marketing website — same title, same fields, same teal background and Caslon-display heading treatment. Keeping the two surfaces visually identical avoids the jarring shift where a user who is mid-funnel from the site lands on a differently-styled product form. The only structural difference is that the post-login version receives the email pre-filled from the Google session and renders it read-only.

### Functional requirements

- **Fields collected** (matches the public Join The Labs form):
  - `first_name` — required
  - `last_name` — required
  - `email` — required; **pre-filled and read-only**, sourced from the Supabase session (`user.email`). The public site asks the user to type it; the post-login version does not, because OAuth has already verified the address.
  - **Contact consent checkbox** — required, with the same copy as the public form: *"Yes, I'd like to receive updates, newsletters, and invites from The Upskilling Labs."* User cannot submit without checking it. Stored on a new column **`participants.contact_consent BOOLEAN NOT NULL`** (see Schema changes below).
- All other fields currently on `/register` move to Feature 2.
- Submitting hits **a new endpoint** — `POST /api/registrations/short` (proposed name) — rather than the existing `POST /api/registrations`. The new endpoint uses a relaxed Zod schema accepting only the four fields above plus `auth_user_id` / `google_id`. Keeping the existing `POST /api/registrations` untouched preserves anything that still hits it (admin tooling, scripts) and avoids a risky schema-loosening migration.
- **Triggers Email A** (Feature 3, Appendix §Email A): a confirmation email is sent to the new participant inviting them to complete the long form and choose their pods. The email fires only on a fresh registration; the duplicate-account path (below) sends Email B instead.

### Schema changes

Add one column to `participants`:

```sql
ALTER TABLE participants
  ADD COLUMN contact_consent BOOLEAN NOT NULL DEFAULT FALSE;
```

- `DEFAULT FALSE` is needed so existing rows backfill safely; the API path for the short form will always write `TRUE` (the checkbox is required to submit).
- A follow-up data check after the migration: any existing participant rows with `text_updates = TRUE` should *not* be auto-promoted to `contact_consent = TRUE`, because the two questions have different scopes (SMS updates vs. broader newsletter/invites). Treat existing rows as not-yet-consented to the broader scope.
- Update [`SCHEMA.md`](../SCHEMA.md) §Participants table to document the new column.
- On success, redirect to `/` (which routes to the personalized dashboard).
- On failure, show the error inline (existing pattern in [`register-form.tsx`](../app/(auth)/register/register-form.tsx)).

### Duplicate-account detection

Before inserting a new `participants` row, `POST /api/registrations/short` runs an email-based dedup check. If a row already exists with the same email (case-insensitive comparison on the normalized address):

- Do **not** insert a new row.
- Do **not** return an error to the form. The UI gets a 200 with a friendly success-shaped response.
- Send the *"You're already an Upskiller"* email (see Appendix §Email B) to the submitted address. The email contains a direct link back to `/login`.
- The form UI shows a non-alarming confirmation: *"Looks like you already have an account — we've sent you an email with a login link."*

This case is rare in the normal OAuth flow (the callback at [`/api/auth/callback`](../app/api/auth/callback/route.ts) does its own email-based lookup and links `auth_user_id` before redirecting), but it can fire when:

- A `participants` row was created by the public marketing-site form with a different email casing.
- Admin tooling inserted a row out-of-band between the user's callback and form submission.
- The user navigates directly to `/register` after a row was just linked.

The dedup check is defensive — it should rarely fire in production, but when it does, it produces the right outcome (no duplicate row, user gets pointed to the login flow) instead of a 500 from a unique-constraint violation.

**Implementation notes:**

- Add a unique index on `LOWER(email)` if one doesn't already exist, so the constraint also catches concurrent inserts.
- The "already registered" check must run as the *first* statement in the handler, before any other inserts.
- One email per check trigger. If the same email submits the form twice in close succession, only the first send should fire (rate-limit by `participants.last_login_email_sent_at` or similar — a small new column or in-memory cache).

### Acceptance criteria

- Short form renders in under one viewport height at 1440×900 (trivially true with 3 inputs + 1 checkbox).
- A user with a valid Google session can complete signup with 2 typed fields (first name, last name) + 1 checkbox click + 1 submit click.
- The contact-consent checkbox is required — clicking submit while it's unchecked produces an inline error, not a server round-trip.
- After submit, the user is on the personalized dashboard, not `/register` or `/cycles`.
- `participants` row exists with the four submitted values populated; all other columns are `NULL` (and the long form in Feature 2 will fill them in later).
- Visual diff against the public Join The Labs form on the marketing site: title, field set, copy, and checkbox label match exactly. Layout and colors should match within reason given the product's design tokens.
- Duplicate-account case: submitting the short form with an email that already exists in `participants` results in zero new rows, exactly one "already registered" email sent to that address, and a friendly in-app confirmation. No 500 errors, no constraint-violation responses surfaced to the user.

### Out of scope for this feature

- Asking for the long-form fields at this stage, even optionally.
- Changing the Google OAuth provider behavior or the `auth_user_id` linking.

---

## Feature 2 — Longer cycle-interest form

### Goal

When a participant decides they want to join the currently active Build Cycle, they fill out a fuller form whose questions actually help with pod placement and cycle-fit signal. This is the form that exists on `/register` today, minus the fields we just moved to the short form.

### User flow

1. Participant is on the personalized dashboard (Feature 4). The active cycle card shows a **Join this cycle** CTA (their `cycle_enrollments` row either doesn't exist or has `status='inactive'`).
2. Participant clicks **Join this cycle**. They land on `/cycles/{cycle_id}/join` (new route).
3. Participant fills the long form and submits.
4. Submit creates or updates a `cycle_enrollments` row with `status='inactive'` (per the existing spec — see [`TUL_MVP_Spec.md`](../TUL_MVP_Spec.md) §Data Flow / Registration) and writes the long-form fields onto the `participants` row (or a related table if the team prefers — see Open Questions).
5. The email in Feature 3 fires.
6. Participant lands back on the personalized dashboard with a "thanks, we'll be in touch" state.

### Functional requirements

- **Fields collected** — everything on the current `/register` form *except* the fields kept on the short form. Concretely:
  - `gender`, `neighborhood`, `dcpl_card`, `dcpl_info`
  - `work_situation`, `main_focus`, `sector`, `current_title`, `linkedin`
  - `ai_tool_familiarity`, `ai_tools[]`
  - `labs_goals[]`, `availability[]`, `work_style[]`, `group_strengths[]`
  - `participation_commitment`, `primary_expertise`, `volunteer_interest`
  - `source`
- Required-vs-optional split should match the current `/register` form. (Today: `neighborhood`, `dcpl_card`, `work_situation`, `main_focus`, `ai_tool_familiarity` are required; the rest are optional.)
- **New endpoint**: `POST /api/cycles/{cycle_id}/interest` (proposed name) that (a) upserts the long-form fields onto `participants` and (b) upserts `cycle_enrollments` to `status='inactive'`. No email fires on this submission; the confirmation email belongs to the short form (Feature 1 / Feature 3 / Email A).
- Idempotent: re-submitting overwrites the previous answers and does not create duplicate enrollment rows.
- If the cycle's `status` is not `'active'`, return 400 with a clear message; the dashboard should not surface the CTA in that case anyway.

### Acceptance criteria

- Submitting the long form on an active cycle results in: a `cycle_enrollments` row with `status='inactive'` for that participant + cycle, and the long-form fields populated on `participants`. No email fires on this endpoint.
- Submitting twice updates the row without side effects (no duplicate enrollment rows).
- A participant who hasn't filled the short form cannot reach this route; they are redirected to `/register` first.
- After submission, the dashboard either surfaces the pod-join section (if the pod-registration window is open) or an "Interest submitted, opens \<date\>" state (if it is not).

### Out of scope for this feature

- The status-flip mechanism itself. The activation rule is defined in Feature 5 §Activation behavior and the Decisions log.
- Admin review tooling for inbound registrations.

---

## Feature 3 — Registration confirmation email

### Goal

When a participant submits the short form (account creation), they receive a confirmation email that thanks them for registering and invites them to complete the long form and choose their pods if they want to join the current cycle.

### User flow

Triggered server-side as a side effect of `POST /api/registrations/short` (Feature 1), on the *fresh-registration* code path only. The duplicate-account path sends Email B instead. User-visible behavior in-app is the redirect to the personalized dashboard; the confirmation email lands in the participant's inbox within ~60 seconds.

### Functional requirements

- **Recipient: the participant only.** The participant's own email address (the one on the Supabase session, also stored on `participants.email`).
- Email dispatch uses the existing Resend HTTP path documented in [`lib/auth/CLAUDE.md`](../lib/auth/CLAUDE.md) §Issue #45. Reuses `getResendClient()` from [`lib/email/`](../lib/email/).
- Email content thanks the participant for registering and contains a single CTA inviting them to complete the long form (and then choose their pods on the dashboard).
- A new template lives alongside [`invitation-template.ts`](../lib/email/invitation-template.ts), proposed name `registration-confirmation-template.ts`. Both HTML and plain-text variants, matching the existing invitation-template pattern.
- Sender identity matches the invitation email: `RESEND_FROM_EMAIL` env var, default `noreply@enroll.theupskillinglabs.org`.
- The CTA link points at the current active cycle's join URL (e.g., `/cycles/{cycle_id}/join`). If there is no active cycle at send time, the email uses a fallback variant with no CTA that simply tells the user we will be in touch when the next cycle opens.
- Failure to send does **not** roll back the `participants` write. The participant record is the source of truth; the email is a notification. Log failures with a structured log line.
- One email per fresh registration. Re-submissions don't apply here because the short form is a one-time create.

### Acceptance criteria

- Submitting Feature 1's short form (fresh path) results in exactly one email landing in the participant's inbox within 60 seconds.
- The email greeting uses `preferred_name` if set, else `first_name`.
- The CTA links to the current active cycle's long-form page. If no active cycle exists, the email uses the fallback variant (no CTA).
- The duplicate-account path of Feature 1 does **not** trigger this email; Email B fires instead.
- If Resend errors, the `participants` row still exists, and the failure is logged with enough context to retry manually.

### Out of scope for this feature

- Admin-facing notification email (deliberately deferred; see Decisions log).
- A separate confirmation email on long-form submission. The dashboard handles the post-long-form state visually; no email fires there.
- Admin dashboard for triaging registrations.
- Automatic enrollment activation. The team decides who gets in.

---

## Feature 4 — Personalized dashboard

### Goal

When a logged-in participant lands on `/`, they see a page that is about *them*: which cycle is currently running, whether they're in it, what their pods are, and what their next action is. Today `/` redirects to `/cycles`, which is a directory of cycles — useful for admins, not personalized.

### User flow

1. Authenticated user navigates to `/` (or is redirected there post-login).
2. The page resolves the active cycle (single row in `cycles` with `status='active'`).
3. The page resolves the user's enrollment state for that cycle and their pod memberships within it.
4. The page renders one of four states (see below) based on the user's standing in the active cycle.

### Functional requirements

The dashboard is a server component that fetches everything it needs in one render. **Its composition is state-dependent — a user who has not yet joined the cycle sees a deliberately minimal page, while a user who is in the cycle gets the full chrome.**

**Empty state — user has no `cycle_enrollments` row for the active cycle**

This is the state a brand-new participant lands on right after finishing the short form. The page is intentionally bare. Nothing competes with the single next action.

What renders:

- The standard top app bar: logo on the left, user avatar + email + Logout on the right. **The "Cycles" and "Pulse Check" nav items are hidden** — they're not useful until the user is in a cycle.
- A short welcome line: `Welcome, {{preferred_name or first_name}}.`
- A single, prominent hero card with the cycle name as its heading, a one-line description, and a "Join {{cycle_name}}" button that opens Feature 2's long form. **The CTA renders only when an active cycle exists AND its pod-registration window is currently open** (i.e., `cycle_config.pod_registration_open <= NOW() <= cycle_config.pod_registration_close`).

What is **not** rendered in this state:

- The phase timeline / "X days to Showcase" countdown
- The pulse-check banner
- The "My pods" section
- The "Past cycles" grid
- Any secondary CTAs or marketing copy

If no active cycle exists, OR if the active cycle's pod-registration window has already closed or has not yet opened, the empty state instead shows "No Build Cycle is open for new participants right now. We'll let you know when the next one opens." with no CTA. The same gating logic applies to Email A's CTA (see Feature 3) so the dashboard and the email never disagree about whether there's an actionable cycle.

**Engaged state — user has a `cycle_enrollments` row for the active cycle**

Once the user has submitted the long form (Feature 2), the dashboard expands to the full chrome:

- **Header**: active cycle name + dates + phase indicator (reuse existing [`cycle-phase-indicator.tsx`](../app/(dashboard)/cycles/cycle-phase-indicator.tsx)).
- **Status block**, depending on the user's standing:
  - *`cycle_enrollments.status='inactive'` and pod-registration window is not yet open*: "Interest submitted, pod registration opens \<date\>" state.
  - *`cycle_enrollments.status='inactive'` and pod-registration window is open*: Pod-join section (Feature 5). Joining a pod will flip the participant to `'active'`.
  - *`cycle_enrollments.status='active'`*: Pod-join section (Feature 5), with already-joined pods shown as such.
- **Pulse check CTA** (always-on banner if the active cycle is in pulse-check territory; reuse the existing banner from [`cycles/page.tsx`](../app/(dashboard)/cycles/page.tsx)).
- **My pods** section listing the user's current active pod memberships (name + status + link to pod detail).
- **Past cycles** section: collapsed by default, mirrors today's "Past cycles" grid.
- Top nav shows "Dashboard", "Cycles", and "Pulse Check".

If a participant has no `participants` row at all, the route guard redirects to `/register` (Feature 1 short form). This matches today's `app/page.tsx` behavior.

### Acceptance criteria

- A new user with no `cycle_enrollments` row sees **only** the welcome greeting and the "Join {{cycle_name}}" hero card. The phase timeline, pulse-check banner, "My pods" section, past cycles, and the "Cycles" + "Pulse Check" top-nav items are all hidden.
- A participant who submitted the long form but the pod-registration window has not yet opened sees the "Interest submitted, pod registration opens \<date\>" state, with full dashboard chrome (phase timeline, pulse-check banner, my pods, past cycles, and all nav items).
- A participant who submitted the long form *and* the pod-registration window is open sees the pod-join section, with full chrome. Joining a pod from this state activates them.
- A participant whose `cycle_enrollments.status='active'` sees the pod-join section with their joined pods shown as joined, with full chrome.
- The pulse-check banner appears when the active cycle is in pulse-check phase, but only for users who have a `cycle_enrollments` row.
- Existing route `/cycles` continues to work (for admins/observers who want the directory view). Navigation from the dashboard links to it.

### Out of scope for this feature

- Admin-only dashboard widgets (those live at `/admin/...` already).
- Project-level surfacing (this PRD scopes to cycle + pods, not the project layer below).

---

## Feature 5 — Pod join on the dashboard

### Goal

When a participant has submitted the long form and the pod-registration window is open, they can join up to 2 pods directly from the personalized dashboard without navigating to a separate page.

### User flow

1. Participant with a `cycle_enrollments` row (`status='inactive'` or `'active'`) lands on the dashboard (Feature 4) during the pod-registration window.
2. The pod-join section lists all pods in the active cycle with `status` in `('forming', 'active')`, showing name, problem statement title, and current registrant count.
3. Participant clicks **Join** on a pod card. The card flips to a joined state.
4. If the pod they joined is `'active'` at that moment, the participant's `cycle_enrollments.status` flips from `'inactive'` to `'active'` on the same request. If the pod is still `'forming'`, the participant stays at their current status — they'll get activated when the pod itself activates (when its registrant count reaches `cycle_config.pod_min`), via the existing pod-activation block.
5. After joining 2 pods, the **Join** buttons on the remaining cards disable with a tooltip: "You can join at most 2 pods per cycle. Withdraw from one to switch."
6. Each joined pod card exposes a **Withdraw** action that removes the membership.

### Functional requirements

- The dashboard reuses the existing pod-registration code path: `POST /api/pods/{pod_id}/register` and `DELETE /api/pods/{pod_id}/register` ([`app/api/pods/[pod_id]/register/route.ts`](../app/api/pods/[pod_id]/register/route.ts)). The handler gets one small addition (see Activation behavior below); everything else is preserved.
- Pod cap is enforced server-side as today: the API returns 400 `"You are already registered in 2 pods for this cycle."` if the participant tries to join a third. The client also pre-disables the button — but the server check is the source of truth.
- Window enforcement is also server-side. If the window is closed, the dashboard shows "Pod registration opens \<date\>" instead of action buttons.
- The pod-join section is visually distinct on the dashboard, but the dedicated `/cycles/{cycle_id}/register-pods` page is retained as a deeper-detail view (per Decisions log).
- Withdrawing a pod removes the membership row and any side-effect Google Group membership, matching today's [`DELETE /api/pods/{pod_id}/register`](../app/api/pods/[pod_id]/register/route.ts) behavior. Withdrawal does **not** flip status back to `'inactive'`.

### Activation behavior

The existing handler already flips `cycle_enrollments.status` to `'active'` for all pod members when the *pod itself* transitions from `'forming'` → `'active'` (i.e., when its registrant count hits `cycle_config.pod_min`). Keep that block exactly as-is — it drives pod-level provisioning (Slack channel, Drive folder, GitHub repo, Google Group) and is the right hook for batch activation.

**Add one new case:** if a participant joins a pod that is already `'active'` at the time of the join, activate that one joining participant on the same request.

Concrete behavior matrix:

| Pod status when participant joins | Pod transitions due to this join? | Participant `cycle_enrollments.status` after |
|---|---|---|
| `'forming'`, count < `pod_min` after join | No | Unchanged (typically `'inactive'`) |
| `'forming'`, count reaches `pod_min` after join | Yes → `'active'` | `'active'` (existing batch activation block handles all current members, including this joiner) |
| `'active'` | No (already active) | `'active'` (**new** — single-participant activation on this request) |

Implementation note: the new case is a small addition near the end of the `POST` handler, inserted *after* the existing pod-min activation block. Pseudocode: `if (pod.status === 'active') { update cycle_enrollments set status='active' where participant_id = X and cycle_id = Y and status='inactive'; }`. If the existing block already activated this participant, the second update is a no-op (the `WHERE status='inactive'` filter prevents double-writes and won't error).

### Acceptance criteria

- A participant who joins a `'forming'` pod that does not reach `pod_min` stays at their current `cycle_enrollments.status`.
- A participant whose join causes a `'forming'` pod to transition to `'active'` becomes `'active'` along with all other current pod members, per existing behavior.
- A participant who joins a pod that is *already* `'active'` becomes `'active'` on the same request.
- Joining a second pod does not regress the status and does not produce duplicate side effects.
- Attempting a 3rd join produces the existing 400 error message; the UI prevents the click and surfaces the same copy.
- Joining a pod updates the **My pods** section without a full page reload (revalidate or optimistic update).
- Withdrawing all pods leaves the participant at `'active'`. Only pulse-check enforcement (or admin action) flips them back.
- The 2-pod cap and the pod-registration window both remain enforced at the API layer; UI is a convenience layer on top.
- The dedicated `/cycles/{cycle_id}/register-pods` page continues to work as a deeper-detail view.

### Out of scope for this feature

- Increasing the pod cap above 2.
- Pod self-creation by participants.
- Mid-cycle pod transfers (covered separately by withdraw + re-join).

---

## Decisions log

Locked in by the team:

- **Feature 3 email recipients** → **User only.** Confirmation email lands in the participant's inbox; admins discover new interest via the admin dashboard (no admin notification email in v1).
- **Long-form field storage** → **Stay on `participants` for v1.** The per-cycle question (a separate `cycle_interest_responses` table) is deferred.
- **Long-form endpoint** → **New `POST /api/cycles/{cycle_id}/interest` route.** Existing `POST /api/registrations` is not extended with a `cycle_id` param.
- **Contact-consent field mapping** → **Add a new `participants.contact_consent BOOLEAN NOT NULL DEFAULT FALSE` column.** Migration documented in Feature 1 §Schema changes. Do not reuse `text_updates`.
- **Downstream consumers of nullable `participants` columns** → **Accept for now.** No audit of admin tooling / scripts / exports before this ships. Treat any downstream breakage as a follow-up to fix if it surfaces.
- **Status flip mechanism** → **Joining an already-active pod activates the participant; joining a forming pod uses the existing `pod_min` behavior.** The existing handler at [`/api/pods/{pod_id}/register`](../app/api/pods/[pod_id]/register/route.ts) only activates participants when the pod itself transitions from `'forming'` to `'active'` (i.e., when registrants reach `cycle_config.pod_min`). This PRD adds one case: if the pod is already `'active'` at the time of the join, activate the joining participant immediately. All other behavior stays the same. No spec deviation — the spec's "active = ≥1 pod + pulse checks" still holds, and the `pod_min` gate still drives pod-level provisioning.
- **Dedicated pod-registration page** → **Keep `/cycles/{cycle_id}/register-pods` for v1.** Revisit removal once the dashboard pod-join section has bake time.

## Open questions

None at draft close. All decisions captured above.

## Out of scope (for the whole PRD)

- Admin UI for triaging cycle-interest submissions.
- Email templates beyond the two new templates listed in Appendix §Email templates.
- Changes to pulse-check flow, problem-statement submission, or any phase after pod registration.
- Mobile-specific layout tweaks (assumed: existing responsive patterns carry over).

## Rough sequencing

If the team wants to ship this in slices rather than all at once, recommended order:

1. Feature 1 + Feature 2 + Feature 3 together (the form split + email are tightly coupled).
2. Feature 4 personalized dashboard (depends on (1) being live so the CTAs make sense).
3. Feature 5 pod-join surfacing (depends on (4); is mostly UI plumbing onto existing APIs).

Each slice is independently testable and shippable behind a feature flag if needed.

---

## Appendix — Email templates (draft copy)

Two new email templates ship with this PRD. Both live in [`lib/email/`](../lib/email/) alongside the existing [`invitation-template.ts`](../lib/email/invitation-template.ts) and follow its HTML and plain-text pattern. Both use the existing Resend HTTP path (`getResendClient().emails.send`) and the `RESEND_FROM_EMAIL` sender, default `noreply@enroll.theupskillinglabs.org`.

The copy below is a draft. Final wording should go through whoever owns brand voice before launch. Tone target: friendly, simple, formal.

### Email A — Registration confirmation with cycle-join invitation

| | |
|---|---|
| Template file | `lib/email/registration-confirmation-template.ts` |
| Trigger | Successful fresh-registration path of `POST /api/registrations/short` (Feature 1). The duplicate-account path sends Email B instead. |
| Recipient | The submitting participant |
| Subject | `Welcome to The Upskilling Labs` |
| Sender | `The Upskilling Labs <noreply@enroll.theupskillinglabs.org>` |

**Body (used when an active cycle exists at send time):**

> Hello {{preferred_name or first_name}},
>
> We received your registration to The Upskilling Labs.
>
> If you would like to join the current cycle, **{{cycle_name}}**, please complete the form by clicking the button below, and then choose your pods.
>
> [**Complete the form**]({{cycle_join_url}})
>
> If you have any questions, please write to olos-help@theupskillinglabs.org and we will be glad to help.
>
> Best regards,
> The Upskilling Labs team
>
> ---
>
> *The Upskilling Labs · theupskillinglabs.org · You are receiving this because you registered with The Upskilling Labs.*

**Body (fallback, used when no active cycle exists at send time):**

> Hello {{preferred_name or first_name}},
>
> We received your registration to The Upskilling Labs.
>
> There is no Build Cycle currently open for new participants. We will email you when the next cycle opens, and you will be able to join from there.
>
> If you have any questions, please write to olos-help@theupskillinglabs.org and we will be glad to help.
>
> Best regards,
> The Upskilling Labs team
>
> ---
>
> *The Upskilling Labs · theupskillinglabs.org · You are receiving this because you registered with The Upskilling Labs.*

**Template variables required:**

- `preferred_name` (falls back to `first_name` if null)
- `cycle_name` (only used in the primary variant)
- `cycle_join_url` (only used in the primary variant; typically `https://olos.theupskillinglabs.org/cycles/{cycle_id}/join`)

**Conditional logic:**

- If a `cycles` row with `status='active'` exists at send time, use the primary variant.
- Otherwise, use the fallback variant. No CTA in the fallback.

---

### Email B — Already registered

| | |
|---|---|
| Template file | `lib/email/already-registered-template.ts` |
| Trigger | Duplicate-account hit on `POST /api/registrations/short` (Feature 1 §Duplicate-account detection) |
| Recipient | The email address submitted on the short form (which matches an existing `participants` row) |
| Subject | `Your Upskilling Labs account already exists` |
| Sender | `The Upskilling Labs <noreply@enroll.theupskillinglabs.org>` |

**Body:**

> Hello,
>
> A registration request was just submitted using this email address. Our records show that you are already registered with The Upskilling Labs, so no further action is needed to create an account.
>
> To access your dashboard, please use the link below to log in.
>
> [**Log in to OLOS**]({{login_url}})
>
> If you did not submit this request, you can safely disregard this message. No new account was created and your existing record has not changed.
>
> Best regards,
> The Upskilling Labs team
>
> ---
>
> *The Upskilling Labs · theupskillinglabs.org · You are receiving this because a registration request was submitted using your email address.*

**Template variables required:**

- `login_url` (typically `https://olos.theupskillinglabs.org/login`)

**Security notes:**

- The email greeting is "Hello" rather than the participant's name. Returning the registered name in this email would confirm to a stranger that the email maps to a known person, which is a small but real account-enumeration leak. Keep the greeting anonymous.
- Do not include the participant's email address anywhere in the body other than the To: header. Recipients can see their own address in the To: line.
