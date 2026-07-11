# PRD — Problem statements: submission process & form redesign

| | |
|---|---|
| Status | Draft |
| Author | Drafted by Claude from the July 11 testing session (owner-triaged) |
| Last updated | 2026-07-11 |
| Source feedback | [`testing-feedback-2026-07-11.md`](testing-feedback-2026-07-11.md) — Problem Statements (Fix Soon): re-evaluate what the submission process should look like; redo the form (question order, irrelevant questions e.g. impact tracks); post-submit "back to dashboard" |
| Related code | `app/(dashboard)/cycles/[cycle_id]/propose/propose-form.tsx` (6-step form, `IMPACT_TRACKS` at lines 14-21), `app/api/problem-statements/route.ts`, `lib/validations/votes.ts` (`problemStatementSchema`) |
| Shipped separately | Prod-failure hardening + step-scroll fix — PR #224 |

## 1. Problem

The propose flow is a six-step form ("About you → The problem → Your
problem statement → Where this problem lives → Context for voters → Before
you submit") whose middle sections outgrew their usefulness:

- **Impact tracks** (step 4) — a six-option taxonomy plus "Other" — is
  optional, unused downstream (nothing reads `proposal_data.context.
  impact_track` in-app), and testers found it irrelevant. Same for the
  theme-alignment radios in most cycles.
- The **order** buries the highest-value content: the actual problem
  articulation (step 2) and statement (step 3) sit behind a biographical
  step 1, and voters' context (step 5) duplicates prompts testers had
  already half-answered in step 2.
- After submitting, the only CTA is **"Submit another proposal"** — no way
  back to the dashboard or cycle, which reads as a dead end (most people
  submit exactly one).
- Bigger question the owner wants re-opened: is a long solo form the right
  **process** at all, versus something lighter that gets refined during the
  Problem Sprint event (July 28).

## 2. Requirements

### 2.1 Process re-evaluation (product decision first)

- **R1.** Decide the intake posture before rebuilding the form:
  - (a) **Light intake, refine live** — capture who/need/barrier + a draft
    statement (≈1 screen); the Problem Sprint session upgrades drafts to
    full proposals.
  - (b) **Keep full self-serve intake**, redesigned per 2.2.
  The anchor-event calendar (Problem Sprint, Jul 28) argues for (a) this
  cycle; record the decision here.

### 2.2 Form redesign (applies to either posture's form)

- **R2.** Order: problem first. Proposed steps: (1) The problem
  (who/need/barrier/success), (2) Your statement + HMW question, (3) About
  you (name prefilled, background, experience), (4) Pre-submit checklist.
- **R3.** Drop the impact-tracks question and theme-alignment radios from
  the member-facing form. If program reporting needs a taxonomy, admins
  tag statements after intake (admin explorer or the review surface) —
  members shouldn't guess categories.
- **R4.** Fold "Context for voters" prompts into step 1 helper text or an
  optional "anything else voters should know" single field — no separate
  step.
- **R5.** `proposal_data` stays backward-compatible: existing keys keep
  their meaning; removed questions simply stop being populated (the Zod
  schema already treats them as optional).

### 2.3 Post-submit

- **R6.** The success state offers, in order: **Back to dashboard**
  (primary), View the cycle, Submit another (tertiary). It also states
  what happens next and when (voting window dates from `cycle_config`).

## 3. Acceptance criteria

- A tester can articulate a problem and submit in ≤3 screens without
  encountering a category taxonomy.
- Submitted rows validate against the existing API schema; the voting
  ballot renders old and new `proposal_data` shapes identically.
- After submit, one tap reaches the dashboard.

## 4. Open questions

1. R1's posture — decide with the program team before the July 28 Problem
   Sprint.
2. Do existing submissions need re-shaping for the ballot if steps merge
   (current read paths tolerate missing keys — verify with a fixture)?
3. Should drafts be saveable (localStorage) given testers lost work to the
   scroll bug's era? Cheap and kind; recommended.
