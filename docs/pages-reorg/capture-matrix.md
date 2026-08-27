# OLOS Current-Flow Capture Matrix

Every screen worth a screenshot in the **current** app, labelled by **user
(persona)** and **state**, with the exact URL and the preconditions needed to
reach that state. Use this as the shot-list; file each capture as
`<ID>.png`.

> **Why a shot-list and not the images:** captures require a browser that can
> reach the app + Supabase and hold a real Google session. Auth is Google-OAuth
> only (no test-login bypass), and this reorg sandbox's network policy blocks
> Supabase + the app host, so automated capture must run from an environment
> with DB access and a signed-in Google account.

Personas: **Anon** (logged out) · **New** (authed, no participant row) ·
**Upskiller** (member) · **Poderator** (moderator) · **Admin**.

How to switch persona: real gating is server-side, but Admin/Poderator use the
avatar menu's **View as** (needs the role). To hit member states you need seeded
accounts in each state (see [§ Seeding notes](#seeding-notes)).

---

## 1. Anonymous / entry

| ID | Persona | URL | State | Preconditions / notes |
|---|---|---|---|---|
| A-01 | Anon | `/login` | Default sign-in | Logged out. |
| A-02 | Anon | `/login?invite=<token>` | Invited | Any string as `invite` triggers the invite badge + "Sign in to accept invitation" button. |
| A-03 | Anon | `/login?error=auth_failed` | Auth failed | Shows the red error alert. |
| A-04 | Anon | `/` | Redirect (no shot) | Redirects to `/login` (logged out). Note only. |
| A-05 | Anon | (throw in `(auth)`) | Auth error boundary | `app/(auth)/error.tsx` — hard to force; capture opportunistically. |

## 2. Registration funnel — Persona: **New**

Authed via Google but **no `participants` row** (or you'll be redirected to
`/dashboard`).

| ID | Persona | URL | State | Preconditions / notes |
|---|---|---|---|---|
| N-01 | New | `/register` | Stage 1 — role intent (empty) | No roles selected; Continue disabled. |
| N-02 | New | `/register` | Stage 1 — role selected | ≥1 role chosen; Continue enabled. |
| N-03 | New | `/register` | Stage 2 — email step | Shows the Google email. |
| N-04 | New | `/register` | Stage 2 — about (name/zip) | |
| N-05 | New | `/register` | Stage 2 — work situation | |
| N-06 | New | `/register` | Stage 2 — how heard (+ referral follow-up) | Pick referral/invited to reveal the follow-up field. |
| N-07 | New | `/register` | Stage 2 — consent / Participant Agreement | Scroll-gated agreement + checkbox. |
| N-08 | New | `/register` | "Already registered" | Reached when a row already exists mid-flow. |

## 3. Home / Dashboard — Persona: **Upskiller**

`/dashboard` is a state machine. Each row is a distinct seeded state.

| ID | Persona | URL | State | Preconditions / notes |
|---|---|---|---|---|
| H-01 | Upskiller | `/dashboard` | `no_cycle` | No `active` cycle exists. |
| H-02 | Upskiller | `/dashboard` | `no_enrollment` (fresh joiner) | Active cycle exists; user has **no** `cycle_enrollments` row. Welcome + "Join {cycle}" hero. |
| H-03 | Upskiller | `/dashboard` | `interest_submitted_window_closed` | Enrollment `inactive`; pod-registration window closed. |
| H-04 | Upskiller | `/dashboard` | `interest_submitted_window_open` | Enrollment `inactive`; pod-reg window open → `PodJoinSection`, <2 pods. |
| H-05 | Upskiller | `/dashboard` | `active` (full) | Enrollment `active` or ≥1 pod. Phase timeline + pulse CTA + My Pods. |
| H-06 | Upskiller | `/dashboard` → `/profile/edit` | Placeholder-name gate | `first_name`/`last_name` = `Unknown` → forced redirect. Capture the redirect target. |
| H-07 | Upskiller | `/dashboard` → `/pulse-check` | Overdue lock gate | Pulse >7 days overdue → forced redirect to locked pulse. |

## 4. Cycle pages — Persona: **Upskiller**

| ID | Persona | URL | State | Preconditions / notes |
|---|---|---|---|---|
| C-01 | Upskiller | `/cycles` | Index — active + past | Active cycle + ≥1 past. Timeline hero + past grid. |
| C-02 | Upskiller | `/cycles` | Index — empty | No cycles. |
| C-03 | Upskiller | `/cycles/:id` | Overview — windows open | ≥1 participation window open → pulsing CTAs + stat cards + pods. |
| C-04 | Upskiller | `/cycles/:id` | Overview — no windows open | All windows closed. |

### 4a. Cycle phase-flow pages (each has open + closed states)

| ID | Persona | URL | State | Preconditions / notes |
|---|---|---|---|---|
| CF-01 | Upskiller | `/cycles/:id/join` | Ceremony — beat 1 (`ts1`) | Cycle `active`, no `cycle_agreements` row. |
| CF-02 | Upskiller | `/cycles/:id/join` | Ceremony — beat 2 (`ts2`, commitments) | |
| CF-03 | Upskiller | `/cycles/:id/join` | Ceremony — flow (questions) | 5-step FlowScreen. |
| CF-04 | Upskiller | `/cycles/:id/join` | Ceremony — signature step | Scroll-gated agreement. |
| CF-05 | Upskiller | `/cycles/:id/join` | Ceremony — signed ✓ | After submit (or existing agreement → opens here). |
| CF-06 | Upskiller | `/cycles/:id/join?from=signup` | Ceremony — from-signup eyebrow | |
| CF-07 | Upskiller | `/cycles/:id/propose` | Open — wizard steps 1–6 | `problem_statement` window open. Capture a couple of steps + success. |
| CF-08 | Upskiller | `/cycles/:id/propose` | Closed window | |
| CF-09 | Upskiller | `/cycles/:id/vote` | Open — ballot (budget bar, cards) | `voting` window open, statements exist. |
| CF-10 | Upskiller | `/cycles/:id/vote` | Open — empty (no statements) | |
| CF-11 | Upskiller | `/cycles/:id/vote` | Closed window | |
| CF-12 | Upskiller | `/cycles/:id/register-pods` | Open — pod grid + counter | `pod_registration` open. |
| CF-13 | Upskiller | `/cycles/:id/register-pods` | Closed window | |
| CF-14 | Upskiller | `/cycles/:id/register-projects` | Open — projects grouped by pod | `project_registration` open + enrollment `active`. |
| CF-15 | Upskiller | `/cycles/:id/register-projects` | Not an active participant | Window open but enrollment ≠ active. |
| CF-16 | Upskiller | `/cycles/:id/register-projects` | Closed window | |
| CF-17 | Upskiller | `/cycles/:id/solutions` | Open — proposal form | `solution_proposal` open + member of ≥1 pod. |
| CF-18 | Upskiller | `/cycles/:id/solutions` | Open — submitted / edit | Existing `solution_proposals` row (prefill + "Edit"). |
| CF-19 | Upskiller | `/cycles/:id/solutions` | Warning banner (T-2 to close, not submitted) | |
| CF-20 | Upskiller | `/cycles/:id/solutions` | Not a member of any pod | |
| CF-21 | Upskiller | `/cycles/:id/solutions` | Closed window | |
| CF-22 | Upskiller | `/cycles/:id/solution-vote` | Open — blind ballot | `solution_voting` open + pod member + **submitted** a proposal. |
| CF-23 | Upskiller | `/cycles/:id/solution-vote` | Not a submitter (ineligible) | Pod member but no proposal submitted. |
| CF-24 | Upskiller | `/cycles/:id/solution-vote` | Already voted | 409 state. |
| CF-25 | Upskiller | `/cycles/:id/solution-vote` | No pods / closed | |

## 5. Pods & Projects — Persona: **Upskiller**

| ID | Persona | URL | State | Preconditions / notes |
|---|---|---|---|---|
| P-01 | Upskiller | `/pods/:id` | Member view (no pulse dashboard) | Plain member. Problem statement + members + projects. |
| P-02 | Upskiller (privileged) | `/pods/:id` | With pulse dashboard | Viewer is admin / this pod's moderator / `participants:read`. |
| P-03 | Upskiller | `/projects/:id` | Member view | |
| P-04 | Upskiller (privileged) | `/projects/:id` | With pulse dashboard | Admin / pod-moderator only. |

## 6. Profile & Pulse — Persona: **Upskiller**

| ID | Persona | URL | State | Preconditions / notes |
|---|---|---|---|---|
| PR-01 | Upskiller | `/profile` | Read-only profile (populated) | Profile with location/AI/fit fields set. |
| PR-02 | Upskiller | `/profile/edit` | Mode A — voluntary | Reached from nav; Cancel + "Saved." possible. |
| PR-03 | Upskiller | `/profile/edit?required=true&next=…` | Mode B — required | Placeholder name; "Complete your profile to continue". |
| PU-01 | Upskiller | `/pulse-check` | Normal — form + history | Not overdue; has past check-ins. |
| PU-02 | Upskiller | `/pulse-check` | Locked overlay | Overdue → "Your access is paused". |
| PU-03 | Upskiller | `/pulse-check` | Confirmation view | After submit (nomination thanks + return CTA). |
| PU-04 | Upskiller | `/pulse-check` | Not-registered fallback | No participant id. |

## 7. Poderator surfaces — Persona: **Poderator**

Requires a moderator account (has `moderator_assignments`). Use **View as →
Poderator**.

| ID | Persona | URL | State | Preconditions / notes |
|---|---|---|---|---|
| M-01 | Poderator | `/moderator?view=all` | All-pods (multi-pod) | ≥2 assigned pods → cards + rollup + cross-pod insights. |
| M-02 | Poderator | `/moderator` | Single-pod (auto-redirect) | 1 pod → redirects to its per-pod page; note the behavior. |
| M-03 | Poderator | `/moderator` | Empty (no pods) | Assigned to none. |
| M-04 | Poderator | `/moderator/pods/:id` | Per-pod — roster tab | Status header + at-risk + insights + roster. |
| M-05 | Poderator | `/moderator/pods/:id` | Per-pod — recent-pulses tab | |
| M-06 | Poderator | `/moderator/pods/:id` | At-risk nudge cards | A member past the consecutive-miss threshold. |
| M-07 | Poderator | `/moderator/pods/:id` | Pulse review side panel | Open from a roster row. |
| M-08 | Poderator | `/moderator/cycles/:id/vote-progress` | Open — tallies by pod | `solution_voting` window open. |
| M-09 | Poderator | `/moderator/cycles/:id/vote-progress` | Closed / empty | |

## 8. Admin surfaces — Persona: **Admin**

Requires admin (`cycles:write`). Use **View as → Admin**.

| ID | Persona | URL | State | Preconditions / notes |
|---|---|---|---|---|
| AD-01 | Admin | `/admin` | Cycles list | + create-cycle button; Explore button only if `ENTITY_EXPLORER_ENABLED`. |
| AD-02 | Admin | `/admin` | Create-cycle form expanded | |
| AD-03 | Admin | `/admin/cycles/:id` | Full console | Capture full page: status, schedule, params, pod voting, testing mode, pods, participants, revocations. May need multiple shots. |
| AD-04 | Admin | `/admin/cycles/:id` | Participants — "stuck inactive" filter on | |
| AD-05 | Admin | `/admin/invitations` | Invitations table + create form | |
| AD-06 | Admin | `/admin/invitations` | Status filter states | pending / accepted / expired / revoked. |
| AD-07 | Admin | `/admin/participants` | Global participant directory | |
| AD-08 | Admin | `/admin/participants/:id/permissions` | Permissions editor + name edit | |
| AD-09 | Admin | `/admin/explore` | Entity Explorer list | Requires `ENTITY_EXPLORER_ENABLED=true`. Note DEV/PROD env banner. |
| AD-10 | Admin | `/admin/explore/:entity/:id` | Entity detail (relations) | |

## 9. Global chrome (capture across personas)

| ID | Persona | Where | State | Preconditions / notes |
|---|---|---|---|---|
| G-01 | Upskiller | any dashboard page | Top nav — member | Home · My Cycle · Pulse (enrollment-gated). |
| G-02 | Upskiller | any | Avatar menu open | Profile + View as + feedback + sign out. |
| G-03 | Upskiller | any | Pulse nav warning states | `warning_3day` / `warning_1day` / `overdue` (label + red dot/bg). |
| G-04 | Admin/Poderator | `/admin` or `/moderator` | Persona nav (pill + "Exit to member view") | |
| G-05 | Upskiller | mobile viewport | Bottom tab bar | <768px. Home/Cycle/Pulse/Me. |
| G-06 | Upskiller | any | Feedback widget open | Triggered from avatar menu → "Send feedback". |
| G-07 | Upskiller | dashboard route | Loading + error boundaries | `loading.tsx` / `error.tsx` — opportunistic. |

---

## Seeding notes

To reach the member states you need seeded dev accounts (Supabase project
`cethihabtddiujzayaxe`). Minimum set:

- **New** — authed Google user with **no** `participants` row (for §2).
- **Fresh joiner** — participant, real name, **no** `cycle_enrollments` row, with
  an `active` cycle present (H-02).
- **Interest-submitted** — enrollment `inactive`, no pods (H-03/H-04; toggle the
  `pod_registration` window in `cycle_config` for open vs closed).
- **Active member** — enrollment `active`, ≥1 pod, recent pulse (H-05, P-01,
  PU-01).
- **Placeholder-name** — `first_name='Unknown'` (H-06, PR-03).
- **Overdue** — `last_pulse_completed_at` >7 days ago (H-07, PU-02).
- **Poderator** — the above + `moderator_assignments` rows (1 pod and ≥2 pods to
  hit M-01 vs M-02).
- **Admin** — `cycles:write` permission (§8). Set `ENTITY_EXPLORER_ENABLED=true`
  for AD-09/10.

Phase-flow states (§4a) are driven by the `cycle_config` window timestamps —
open/close a window by editing its `*_open` / `*_close` columns (or via the
admin cycle console / testing-mode stepper) to flip each page between its open
and closed captures.

## Suggested filing

`docs/pages-reorg/screenshots/<ID>-<slug>.png`, e.g.
`H-02-dashboard-fresh-joiner.png`. Keep the ID prefix so shots sort by flow and
map back to this matrix.
