# PRD — Cycle registration ceremony: context before questions

| | |
|---|---|
| Status | Draft |
| Author | Drafted by Claude from the July 11 testing session (owner-triaged) |
| Last updated | 2026-07-11 |
| Source feedback | [`testing-feedback-2026-07-11.md`](testing-feedback-2026-07-11.md) — Registering for Cycle (Fix Now): theme explained before the interest question; add a description of what the Cycle covers; fix confusing helper text (Jennifer) |
| Related code | `app/(dashboard)/cycles/[cycle_id]/join/ceremony.tsx` (steps), `app/components/cycle/cycle-info.tsx` + `lib/cycles/info.ts` + migration `00059_cycle_info_content.sql` (built-but-unused description content), `app/c/[cycle_id]/page.tsx` (only current CycleInfo consumer) |
| Shipped separately | Date-list + softened commitment copy and the registered-state CTA landed in PR `fix/cycle-registration-copy` (#226) |

## 1. Problem

The ceremony opens with *"What draws you to this cycle's theme?"* before
ever saying what the theme **is**. That was a deliberate owner decision
(the pitch lives on the public `/build-cycles` page — see the comment at
`ceremony.tsx:112-115`), but testers arriving from the dashboard CTA or an
email never pass through that pitch. There is no cycle description anywhere
in the flow, even though the content system for one is fully built
(`cycles.description` + `what_you_build` columns, `CycleInfo` component,
admin-editable with fallback copy) and simply not wired into the ceremony.
Separately, Jennifer flagged the flow's helper text as confusing.

## 2. Intent

A registrant should meet the theme before being asked to respond to it —
without rebuilding the pitch page inside the flow.

## 3. Requirements

- **R1.** The ceremony opens with a **context step** (flow `info` type)
  rendering the cycle's name, theme, and description — `CycleInfo` content
  (`cycles.description`, `what_you_build`, with `CYCLE_INFO_FALLBACK`)
  passed from `join/page.tsx`, which already fetches the cycle row. One
  screen, skimmable, "Continue" advances; no new content system.
- **R2.** The `theme_interest` question follows that step unchanged.
- **R3.** Helper-text pass over the four flow steps with the program team;
  current strings for review (`ceremony.tsx`):
  - theme_interest: "No wrong answer — 'the timing's finally right for me'
    counts. Skip it if you'd rather."
  - learning_goals: "A line is plenty."
  - professional_goals: "A line is plenty — a job, a portfolio piece, a new
    direction."
  - signature: "Signing is how your pod knows you mean it. It's short —
    read the whole thing."
  The feedback doesn't isolate which string confused Jennifer — collect
  that before rewriting (open question 1).
- **R4.** The prototype-first copy rule (`ceremony.tsx` header) is
  preserved: mirror final copy back into onboarding-proto.

## 4. Acceptance criteria

- A registrant deep-linked to `/cycles/[id]/join` sees theme + description
  before any question.
- Admin-edited `cycles.description` shows up in the ceremony without code
  changes; empty columns fall back to the canonical copy.
- Already-signed members still land on the confirmation, skipping the
  context step.

## 5. Open questions

1. Which helper string(s) confused Jennifer — and is the fix copy or
   interaction (e.g. the skip affordance)?
2. Should the context step show the anchor-event dates too, or leave dates
   to the signature step (which now lists them, PR #226)?
