# PRD — Dashboard: navigation and dismissal semantics

| | |
|---|---|
| Status | Draft |
| Author | Drafted by Claude from the July 11 testing session (owner-triaged) |
| Last updated | 2026-07-11 |
| Source feedback | [`testing-feedback-2026-07-11.md`](testing-feedback-2026-07-11.md) — "Pin 'back to dashboard' on every page" (Fix Soon, also Profile's "Add pinned 'back' button"); "Define when the To Do list fully dismisses" (Feature Request); "'Learn how the Labs work' resource, prominently linked from dashboard" (Feature Request) |
| Shipped separately | Checklist order/gating, persistent collapse, dismissible hero, footer, "Key dates", quick-link hiding — PR `fix/dashboard-checklist` (#228). Learning-Log prominence + composer toggle live in [`PRD-learning-log.md`](PRD-learning-log.md) §3.2 |

## 1. Problem

1. **No constant way home.** Deep pages (profile, directory, cycle pages,
   events) rely on per-page back links that testers kept losing; two
   separate feedback items ask for a pinned "back to dashboard".
2. **To-Do dismissal is undefined.** PR #228 made the setup checklist's
   collapse persistent, but "when does the list go away for good?" is a
   product decision nobody has made — the strip currently lives forever.
3. **No orientation resource.** New members have nowhere on the dashboard
   that explains how the Labs works end-to-end.

## 2. Requirements

### 2.1 Pinned way home

- **R1.** The signed-in chrome guarantees a one-tap route to `/dashboard`
  from every `(dashboard)`-group page. Preferred: make the AppNav
  wordmark/home affordance explicit and *sticky on mobile scroll*, rather
  than adding a floating button per page. If the nav already satisfies this
  technically, the requirement becomes visibility (testers didn't find it —
  treat as a discoverability fix, validated with the next test group).
- **R2.** Pages that open outside the shell (the ceremony's fixed-overlay
  flow, survey flows) keep their explicit exit affordances — audit that
  each full-screen flow has one.

### 2.2 To-Do (setup checklist) end-of-life

- **R3.** Define and implement full dismissal: once every item is done
  **and** the member has seen the all-done strip once, the strip disappears
  after N days (recommendation: 7) or on explicit "Don't show again".
  State stays member-local (localStorage, matching PR #228's
  `olos.setupChecklistCollapsed.v1`) until a server-side preference store
  exists.
- **R4.** A new cycle's registration row may re-surface the strip (count
  form, collapsed — per PR #228) but never the expanded list uninvited.

### 2.3 "Learn how the Labs work"

- **R5.** A prominently linked orientation resource: dashboard Quick links
  entry + a slot in the hero/empty states for brand-new members. Content
  itself is program-team-owned (likely a Library page or the cycle
  explainer — coordinate with [`PRD-cycle-explainer.md`](PRD-cycle-explainer.md)
  so one artifact serves both asks).

## 3. Acceptance criteria

- From any signed-in page, one visible tap reaches the dashboard (mobile
  and desktop).
- A member who finished setup and dismissed the strip never sees it again;
  a new cycle surfaces at most the collapsed count strip.
- A brand-new member can reach "how the Labs works" from the dashboard
  without searching.

## 4. Open questions

1. Server-persisted UI preferences (a `member_ui_state` table mirroring
   `moderator_ui_state`) vs staying localStorage — cross-device members will
   eventually notice resets. Decide before more per-member dismissals pile up.
2. Does the orientation resource live in the Library (gated per
   [`PRD-library.md`](PRD-library.md)) or public marketing? Public
   recommended — it's also a recruitment artifact.
