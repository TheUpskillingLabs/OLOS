# OLOS Pages — Current State (dev)

Reference map of every page live on dev today, so the reorg requirements in
[`requirements.md`](./requirements.md) have a shared baseline. Captured
2026-07-05 from branch `claude/pages-reorg-37i9gh`.

## App-wide model

- **One app, three personas**, switched from the avatar menu's "View as"
  (UI convenience only — real access is enforced server-side on every
  page/API): **Upskiller** (member, default), **Poderator** (moderator;
  internal term is "moderator"), **Admin**.
- **Member top nav:** Home · My Cycle · Pulse Check. "My Cycle" and
  "Pulse Check" appear only once enrolled. Entering `/admin` or `/moderator`
  swaps the nav for a persona pill + "Exit to member view."
- **Two forced redirects wrap every signed-in page** (`app/(dashboard)/layout.tsx`):
  (1) placeholder-name gate → `/profile/edit` if name is still `Unknown`;
  (2) pulse-check enforcement → locked to `/pulse-check` when 7+ days overdue.
- **The core object is a Cycle** — a 13-week Build Cycle (Problem Discovery →
  Exploration → Prototype Building) moved through in phase-gated windows.
- **No pre-login/marketing surface.** Logged-out visitors are funneled
  straight to `/login`; `/` hard-redirects there. There is no anonymous page.

## Public / Auth

| URL | What lives there |
|---|---|
| `/` | No UI — router. Signed out → `/login`; no participant row → `/register`; else → `/dashboard`. |
| `/login` | Single "Continue with Google" sheet. Invite badge on `?invite=`, error banner on `?error=auth_failed`. The pre-login screen. |
| `/register` | Onboarding funnel (authed, no participant row). Intent pick (Cycle / Events / Volunteer / Mentor) → profile steps → Participant Agreement + consent. **Mentor/Volunteer flows are stubbed.** |

## Upskiller (member)

| URL | What lives there |
|---|---|
| `/dashboard` | Adaptive home. States: `no_cycle` · `no_enrollment` (welcome + "Join {cycle}" hero) · `interest_submitted_window_closed/open` · `active` (phase timeline + pulse CTA + My Pods + past cycles). |
| `/cycles` | Cycle index: active-cycle timeline + past cycles. |
| `/cycles/:id` | Cycle overview: live open-window CTAs, enrolled/active/pods stat cards, pods grid. |
| `/cycles/:id/join` | Registration ceremony — full-screen "sign the Open Cycle Agreement" flow + `.ics` export. |
| `/cycles/:id/propose` | 6-step problem-statement proposal wizard. |
| `/cycles/:id/vote` | Problem-statement voting — incremental, live tallies, dual budgets. |
| `/cycles/:id/register-pods` | Join up to 2 pods. |
| `/cycles/:id/solutions` | Submit one project ("solution") pitch for your pod; editable until close. |
| `/cycles/:id/solution-vote` | Blind, all-at-once ballot on pod's project proposals. Submitters only. |
| `/cycles/:id/register-projects` | Register for one project. Requires active enrollment. |
| `/pods/:id` | Pod detail: problem statement, members table, projects grid, pulse dashboard (privileged viewers). |
| `/projects/:id` | Project detail: members table + pulse dashboard (admin / pod-moderator only). |
| `/profile` | Read-only own profile. No edit button on the page itself. |
| `/profile/edit` | **Name fields only** (first/last/preferred). Two modes: voluntary + required (placeholder gate). |
| `/pulse-check` | Weekly check-in (keeps access active) + the "locked" overdue screen + history. |

## Poderator (`/moderator`)

| URL | What lives there |
|---|---|
| `/moderator` | All-pods view: switcher, pod summary cards (health/trend/phase/deadline), attention rollup, cross-pod insights, AI-summary clipboard block. |
| `/moderator/pods/:id` | Per-pod dashboard: status/health header, at-risk nudges, pod pulse insights, roster (filter/sort → pulse side panel) + recent-pulses feed. |
| `/moderator/cycles/:id/vote-progress` | Per-project vote tallies during solution voting. Aggregate-only. |

## Admin (`/admin`)

| URL | What lives there |
|---|---|
| `/admin` | All-cycles table + create-cycle + links to Invitations / Participants / Explore. |
| `/admin/cycles/:id` | Full cycle console: status advance, schedule/windows, voting params, finalize pod voting, testing-mode stepper, pods (assign moderators), participants (reconciler), revocations. |
| `/admin/invitations` | Create / send / resend / revoke invitations. |
| `/admin/participants` | Global participant directory (admin) — search, role filter, links to permissions. |
| `/admin/participants/:id/permissions` | Edit name, role presets, individual permissions. |
| `/admin/explore` + `/admin/explore/:entity/:id` | Read-only Entity Explorer. Behind off-by-default flag `ENTITY_EXPLORER_ENABLED`. |

## Known gaps / drift (pre-reorg)

- Profile editing is name-only; the rich `/profile` data has no edit surface.
- Pod vs. project pulse-dashboard access is asymmetric; project pulse cards
  never show nomination counts (data not fetched).
- Register funnel has dead Mentor/Volunteer branches.
- Nav references "ghost" destinations **Learning** and **Directory** that
  don't exist yet.
- Two different voting UX models coexist (visible incremental for problems;
  blind all-at-once for solutions).
- Placeholder-name (`Unknown`) participants and enrollment state-machine
  edges are tracked in
  [`docs/architecture-review-onboarding-state-machine.md`](../architecture-review-onboarding-state-machine.md).
