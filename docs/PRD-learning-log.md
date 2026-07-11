# PRD — Learning Log: first-log baseline (SDT) + prominence

> **⏰ TIME-BOXED: the cohort's first Learning Log is due NEXT WEEK
> (w/c July 13, 2026). The baseline must be live before that log opens, or
> the cycle loses its pre-programme measurement point permanently.**

| | |
|---|---|
| Status | Draft — build immediately after the July 11 fix batch |
| Author | Drafted by Claude from the July 11 testing session (owner-triaged) |
| Last updated | 2026-07-11 |
| Source feedback | [`testing-feedback-2026-07-11.md`](testing-feedback-2026-07-11.md) — Learning Log (Fix Now, deadline flag); Dashboard items "Make Update/Learning Log toggle more obvious", "Match Learning Log prominence to its required status" (Fix Soon) |
| Related code | `app/(dashboard)/dashboard/learning-log-card.tsx` (form), `app/(dashboard)/dashboard/feed-composer.tsx:136-161` (Update/Log tabs), `lib/learning-logs/gate-logic.ts` + `gate.ts` (due-window gate), `lib/validations/learning-logs.ts`, `app/api/learning-logs/route.ts`, crons `app/api/cron/learning-log-window` + `learning-log-reminder`, migration `00040_learning_logs.sql` |

## 1. Problem

Three related gaps:

1. **No first-log baseline exists.** The learning-log system (weekly +
   milestone kinds, clarity/alignment 1–5 scales, blocked flag, reflection
   prompts) is built and gated, but nothing distinguishes a member's *first*
   log or captures a pre-programme baseline. Searching the repo for SDT /
   self-determination / baseline confirms the concept appears nowhere in
   code — it is genuinely unbuilt.
2. **The Learning Log doesn't look required.** It is the cycle's core weekly
   obligation (the gate locks the dashboard when overdue), but on the
   dashboard it renders as one tab of the feed composer, visually peer to
   the optional "Update" post.
3. **The Update/Learning Log toggle is easy to miss.** Testers didn't
   realize two different actions live behind the two tabs
   (`feed-composer.tsx:136-161`); the red "due" dot only appears once the
   gate is already active.

## 2. Intent

Members' first Learning Log doubles as their **baseline**, pegged to
Self-Determination Theory (SDT), so end-of-cycle logs can be compared
against a pre-programme measurement of autonomy, competence, and
relatedness. Day-to-day, the Learning Log should read as the required
weekly practice it is.

## 3. Requirements

### 3.1 First-log baseline (build first — due next week)

- **R1.** A member's first log in a cycle is `kind: 'baseline'` (extend the
  `learning_logs.kind` check in a new migration; existing kinds
  `weekly | milestone_7 | milestone_13` unchanged).
- **R2.** The baseline form adds three 1–5 SDT scales alongside the existing
  clarity/alignment health check, one per SDT construct:
  - *Autonomy* — "How much say do you feel you have over what you work on
    and how?"
  - *Competence* — "How capable do you feel taking on the kind of problem
    this cycle covers?"
  - *Relatedness* — "How connected do you feel to the people you'll be
    building with?"
  Exact copy is program-team-owned; the constructs are fixed. Store in
  `learning_logs` columns (`sdt_autonomy`, `sdt_competence`,
  `sdt_relatedness`, SMALLINT 1–5, nullable — only baseline and final logs
  set them).
- **R3.** The final log of the cycle (`milestone_13` or a closing variant)
  re-asks the same three scales so the delta is measurable.
- **R4.** The baseline is **live and required at cycle start**: the existing
  gate (`log_due_at` cron arming) treats a member with zero logs as owing
  the baseline, not a weekly. No separate gate machinery — the first
  qualifying log simply saves as `baseline`.
- **R5.** Reporting: baseline vs final SDT deltas are queryable per cycle
  (a view or a documented SQL snippet in SCHEMA.md is sufficient for v1 —
  no dashboard required).

### 3.2 Prominence & toggle (with or after 3.1)

- **R6.** When a log is due (gate armed, not yet saved), the Learning Log
  presentation must outrank the Update composer: pre-selected Log tab
  (already done when `gateActive`), plus a visible "Required · due {date}"
  badge on the tab itself, not only a dot.
- **R7.** The two tabs get explicit affordance labels ("Post an update" /
  "Learning Log") and distinct iconography so the toggle reads as two
  actions, not a segmented style choice.
- **R8.** The dashboard checklist row "Save your first Learning Log"
  renames to "Save your baseline Learning Log" while R1–R4 apply.

## 4. Acceptance criteria

- A member with no logs in the active cycle sees the baseline form (SDT
  scales present); saving writes `kind='baseline'` with all three SDT values.
- Their second log shows the normal weekly form (no SDT scales).
- The final milestone log re-collects the three scales.
- The gate clears on baseline save exactly as it does for a weekly.
- With a log due, the Log tab visibly reads as required before the member
  opens the composer.
- `npm run lint/test/build` green; new migration numbered after the current
  head and reflected in SCHEMA.md.

## 5. Open questions

1. Should baseline SDT answers be visible to the Poderator, or program-team
   only? (Health-check visibility precedent: Poderator + Labs team.)
2. Does the mid-cycle milestone (`milestone_7`) also re-ask SDT, giving a
   3-point curve, or only start/end?
3. If a member joins mid-cycle, is their late first log still a baseline?
   (Recommended: yes, flagged with `joined_week` context.)
