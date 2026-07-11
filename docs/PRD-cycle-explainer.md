# PRD — Cycle explainer: page, phase graphic, insights hub, expectations

| | |
|---|---|
| Status | Draft |
| Author | Drafted by Claude from the July 11 testing session (owner-triaged) |
| Last updated | 2026-07-11 |
| Source feedback | [`testing-feedback-2026-07-11.md`](testing-feedback-2026-07-11.md) — Feature Requests (Cycle): explainer page; insights hub linked from it; a graphic on the Cycle page showing where the current Cycle is; "What to expect in a Cycle" resource |
| Related code | `app/(dashboard)/cycles/cycle-phase-indicator.tsx` (existing member phase rail), `app/c/[cycle_id]/page.tsx` + `app/components/cycle/cycle-info.tsx` (public cycle info), `docs/dev-report-cycle-process.md` (the 6-phase machine), `app/(public)/build-cycles/page.tsx` (public pitch) |
| Related PRDs | [`PRD-dashboard.md`](PRD-dashboard.md) §2.3 ("Learn how the Labs work" — one artifact should serve both), [`PRD-cycle-registration.md`](PRD-cycle-registration.md) (context step links here) |

## 1. Problem

Members (and prospects) have no single place that explains what a Build
Cycle *is*, where the current one stands, and what participating feels
like week to week. The pieces exist scattered: a public pitch
(`/build-cycles`), a per-cycle info page (`/c/[id]`), a phase rail on the
member cycles page, and a process writeup in the docs folder — but no
narrative explainer, no at-a-glance "you are here", and no insights.

## 2. Requirements

- **R1. Cycle explainer page** — one canonical page (public; recommended
  route `/build-cycles/how-it-works` or fold into `/build-cycles`)
  narrating the cycle arc: registration → problem statements → voting →
  pods → building → milestones → showcase, with the anchor-event rhythm and
  time expectations. Program-team-owned copy; the page is the single
  artifact the dashboard's "Learn how the Labs work" link (PRD-dashboard
  §2.3) and the ceremony's context step (PRD-cycle-registration R1) point at.
- **R2. Phase-position graphic** — the cycle page(s) show where the current
  cycle sits in that arc: reuse/extend `cycle-phase-indicator.tsx`
  (already computes phase from `cycle_config` windows) into a compact
  visual (labeled arc/track with a "you are here" marker) usable on both
  the member cycle page and the public explainer (public variant shows
  phase only, no member CTAs).
- **R3. "What to expect in a Cycle" resource** — a member-facing companion
  (Library entry or a section of R1) covering weekly time commitment, the
  Learning Log ritual, pod dynamics, and the events. Where it lives follows
  the Library gating decision ([`PRD-library.md`](PRD-library.md)); content
  should be linkable from the registration confirmation email.
- **R4. Insights hub (v1: modest)** — linked from the explainer: a page
  aggregating what past/current cycles produced — problem statements
  count, pods formed, projects shipped (with links), showcase artifacts.
  Source from existing tables (`problem_statements`, `pods`, `projects`);
  no new analytics infrastructure. Editorial highlights beat dashboards
  for v1.

## 3. Acceptance criteria

- A prospect can read one page and correctly answer: what a cycle is, how
  long it runs, what's expected of them, and what phase the current cycle
  is in today.
- The dashboard link, ceremony context step, and confirmation email all
  resolve to the same artifact (no forked explanations to maintain).
- The phase graphic derives from `cycle_config` — no hand-updated state.

## 4. Open questions

1. Public vs gated for R3 (ties to the Library preview decision).
2. Insights hub scope: per-cycle pages vs one rolling hub (recommended:
   one hub, sectioned by cycle).
3. Who owns the explainer copy long-term — same "prototype first" rule as
   the ceremony, or does this page become the canonical source?
