# Cycle 3 Launch — Testing Plan (2026-07-12)

| | |
|---|---|
| **Scope** | Cycle 3 go-live (Jul 14) + the staged calendar work landing inside the cycle. Weighted toward the **early stages: invites, joining the cycle, joining a pod.** |
| **Cycle 3 dates (owner-confirmed)** | Kickoff **Tue Jul 14** 6–9 PM · Problem Sprint **Sat Jul 25** 9 AM–1 PM (forming closes **Jul 28** EOD) · Meet the Pods **Tue Aug 11** (active-join opens) · Hackathon **Thu Aug 13** · Meet the Projects **Tue Sep 8** · Summit **Tue Oct 13** — all Eastern; source [`cycle-timeline.md`](./cycle-timeline.md). ⚠ `anchor-events.ts` shipped with stale prototype dates, corrected in #233 — that fix must be on `main` before Jul 14 |
| **Related docs** | [`cycle-timeline.md`](./cycle-timeline.md), [`pod-registration.md`](./pod-registration.md), [`implementation-plan.md`](./implementation-plan.md) |

## How to use this plan

Four **gates**, each tied to a calendar date. Run a gate's suites before its
date; a red scenario blocks that gate, not the whole program. Early-stage
suites (S2–S4) are the priority per the owner.

| Gate | Date | Must pass |
|---|---|---|
| **G0 — pre-launch rehearsal** | by Jul 13 | S1 (handover), S5.1 (window-entry convention), fix-train merged (see Interlocks) |
| **G1 — launch** | Jul 14 | S2 (invites), S3 (join cycle), S8 spot-checks |
| **G2 — pre-Sprint** | by Jul 24 | S4 (pod joining), S6 (propose/vote), S5.2–5.4 if Stage 1 shipped |
| **G3 — pre-Meet-the-Pods** | by Aug 10 | S7 (lifecycle/cron), active-join suite if two-window shipped |

**Environment.** Run everything on a staging environment seeded from a prod
clone (per the plan's rollout rule), then re-run the G1 smoke set on prod
after the `dev → main` promotion. Test boundaries by editing the cycle's
window values in admin (or `testing-controls`), **never** with
`advance-phase` — it stamps a 24-hour window regardless of the schedule.

**Two-clock rule.** Every time-sensitive scenario gets run twice: once in a
browser set to Eastern, once set to Pacific (or a second device). The pass
condition is always "both browsers agree with the Eastern wall-clock intent."

## Personas (test accounts to seed)

| # | Persona | Setup |
|---|---|---|
| P1 | **Owner** | Rooted owner (`participant_roles` owner row) |
| P2 | **Admin/staff** | `admin` role; runs invites, config, voting finalize |
| P3 | **Lab lead** | `lab_lead` of the DC metro; NOT admin |
| P4 | **Poderator** | `moderator_assignments` row on one Cycle-3 pod (post-Sprint) |
| P5 | **Returning member** | Cycle-2 participant: existing account, metro set, was in a Cycle-2 pod |
| P6 | **Invited newcomer** | No account; receives an email invite with `cycle_id` = Cycle 3 |
| P7 | **Self-serve newcomer** | No account, no invite; enters via `/register` funnel |
| P8 | **Metro-less member** | Existing participant with `metro_id = NULL` (this is most legacy rows — see S4.4) |
| P9 | **Observer** | `observer` role only (read-only leak checks, cf. PR #225) |
| P10 | **Org contributor** | Member of an org-mode workstream pod (regression only) |
| P11 | **Revoked returner** | Cycle-3 enrollee later revoked (S7) |

## Cycle 3 admin config entry sheet (the June scaffold → the real form)

Every value below is editable in **Admin → cycle → config form** (all twelve
windows, `phase_2/3_start`, thresholds, `pod_limit`, milestone weeks — no
deploy needed). All times ET wall-clock, entered per the S5.1-verified
convention. Scaffold arithmetic verified: every weekday/offset checks out, and
Jul 14 → Oct 13 is exactly 91 days = 13 × 7, so `getCycleWeek`'s thirteen
equal buckets land on exact calendar weeks.

| Field | Value | Note |
|---|---|---|
| `cycles.start_date` / `end_date` | Jul 14 / Oct 13 | drives week rail + milestones |
| `problem_statement_open/close` | Jul 25 9:00 AM → 12:00 PM | Sprint morning |
| `voting_open/close` | Jul 25 12:00 PM → 1:00 PM | finalize runs at close (S4.1) |
| `pod_registration_open/close` | Jul 25 1:00 PM → Jul 28 11:59 PM | **forming window — see O-1** |
| `solution_proposal_open/close` | Aug 13 9:00 AM → Aug 18 11:59 PM | opens at Hackathon start (confirm hour) |
| `solution_voting_open/close` | Aug 19 12:00 AM → Aug 20 11:59 PM | contiguous chain |
| `project_registration_open/close` | Aug 21 12:00 AM → Aug 25 11:59 PM | |
| `phase_2_start` | Aug 11 | Meet the Pods marker (phase indicator) |
| `phase_3_start` | Sep 8 | Meet the Projects marker |
| `pod_limit` | **1 or 2 — product call** | June D-4 said 2; shipped default 1 |
| `pod_min`, votes, thresholds | product values | confirm before Jul 25 |
| `milestone_mid_week` / `final_week` | 6 / 12 (defaults) | week 6 = Aug 25–31 (right after project reg closes); week 12 = Oct 6–13 |

**O-1 — the one place the scaffold doesn't fit the current form:** the June
schedule has **two** pod windows (forming Jul 25–28; active-join Aug 11–25)
but the form has **one** `pod_registration` pair until Stage 2 ships.
Decision:
- **Recommended:** enter the forming window now (as above). When Aug 11
  arrives, Stage 2's `pod_active_join` phase takes over — and if Stage 2
  slips, the no-code fallback is a 30-second admin edit: set
  `pod_registration` to Aug 11 12:00 AM → Aug 25 11:59 PM (current code
  already allows joining `active` pods in-window). This also moves the
  revocation cron's gate (= `pod_registration_close`) to Aug 25, which
  matches the intended rule.
- **Rejected:** one long window Jul 25 → Aug 25 — it would let people join
  during Jul 29–Aug 10, which the scaffold says is closed.

**Known gap until Stage 2 — sub-`pod_min` pods at forming close (Jul 29):**
no dissolution code exists yet, so pods under threshold just stay `forming`.
Their members count against `pod_limit` and can't join an active pod without
leaving first. Ops sweep on Jul 29: review forming pods < `pod_min` and free/
reassign members via the admin membership tools (S4 covers the member paths).

## S1 — Cycle 2 → Cycle 3 handover (G0; rehearse on staging first)

The riskiest untested moment happens **before** anyone joins anything.

| ID | Persona | Scenario | Expected |
|---|---|---|---|
| S1.1 | P1 | Close out Cycle 2 (status → closed/archived) | Cycle-2 pods → `dissolved`; moderator assignments revoked; projects graduate; no errors |
| S1.2 | P1 | Activate Cycle 3 while Cycle 2 still active | Blocked by the single-active-cycle rule with a clear message (do the close-out first) |
| S1.3 | P1/P2 | Activate Cycle 3; check `cycle_config` row | Config exists with intended `pod_min`, `pod_limit`, `submitter_votes`/`non_submitter_votes`, milestone weeks — a missing config row breaks propose/vote pages (cf. PR #224's explicit-message fix) |
| S1.4 | P5 | Sign in during the gap (Cycle 2 closed, Cycle 3 not yet active) and after | Dashboard renders sanely in the gap (no crash/blank); after activation, Cycle 3 is offered for registration |
| S1.5 | P4 (Cycle-2 poderator) | Sign in after handover | Moderator surfaces for Cycle 2 gone/read-only; no orphaned nav |

## S2 — Invitations (G1; the invite path is the **legacy** one — that's expected)

| ID | Persona | Scenario | Expected |
|---|---|---|---|
| S2.1 | P2 → P6 | Create + send invite (cycle_id = Cycle 3), accept via Google | Lands signed-in; enrollment **active**; correct role rows; invitation `accepted` |
| S2.2 | P6 variant | Invite with `pod_id` + `pod_role` (after pods exist) | co_lead → moderator + membership; member → membership only |
| S2.3 | anyone | Forward the invite link to a different Google account | Rejected (email mismatch); no rows written |
| S2.4 | P6 | Accept an **expired** invite | Clear failure; can still self-register |
| S2.5 | P5 | Invite sent to an address that already has an account | Accept links to the existing participant; no duplicate |
| S2.6 | P2 | Invite accepted mid-cycle (e.g. Aug) | Enrollment active; dashboard shows correct current phase, not day-1 state |

## S3 — Joining the cycle (G1; heaviest suite)

| ID | Persona | Scenario | Expected |
|---|---|---|---|
| S3.1 | P7 | Full funnel: Google sign-in → `/register` (names prefilled per #227) → metro pick → Open Cycle Agreement ceremony → signed | Enrolled in Cycle 3; agreement row written; ceremony lists the **five real core events with real dates** (#226) |
| S3.2 | P5 | Returning member registers for Cycle 3 | Ceremony offered fresh (Cycle-2 agreement doesn't satisfy Cycle 3); after signing, `/cycles` shows "You're registered" not "Register" (#226) |
| S3.3 | P5/P7 | Post-registration dashboard | Checklist leads with cycle registration (#228); **"Join a pod" row absent** until the forming window opens (#228); "Find your local lab" hidden when metro set |
| S3.4 | P5/P7 | **Enrollment status check** (DB or admin view) | Known quirk: invite-path enrollees are `active`; self-registered are `inactive` until a pod join flips them. Confirm every participant-facing surface (dashboard, cycle page, counts shown to admins) treats both as "in" — flag any surface that hides content from `inactive` self-registrants |
| S3.5 | P7 variant | Abandon funnel mid-way, return next day | Resumes/restarts cleanly; no half-created rows blocking re-entry |
| S3.6 | P1/P2 | Kickoff-day dates audit (Jul 14) | Every surface that renders dates — ceremony, dashboard Key-dates card, cycle page, `.ics` download, phase indicator — shows the **owner-confirmed calendar** (Sprint Jul 25, Pods Aug 11, Hackathon Aug 13, Projects Sep 8). Prerequisites: the `anchor-events.ts` correction (#233) is deployed, AND prod's `cycle_config` windows + `phase_2_start`/`phase_3_start` + the Luma-synced events all match the same calendar — audit all three, they are separate sources |
| S3.7 | P9 | Observer signs in | Sees read-only surfaces; **no pulse aggregates on the public pod page** (#225) |

## S4 — Joining a pod (G2; run the whole suite before Jul 25)

Sprint day is compressed: problem statements 9 AM–12 PM, voting 12–1 PM,
forming opens 1 PM — finalize runs in the minutes between. Rehearse the full
chain on staging with realistic timing before the real Saturday.

| ID | Persona | Scenario | Expected |
|---|---|---|---|
| S4.1 | P2 | **Sprint-night pipeline rehearsal**: problem window closes → voting window → finalize → forming pods exist → forming window opens | Finalize (admin-triggered) seeds `forming` pods in the minutes between voting close and forming open; document exactly who clicks what, when |
| S4.2 | P5/P7 | Join a `forming` pod inside the window | Joins; under current code the member's enrollment flips `active` — verify no error either way |
| S4.3 | P5 | Join a second pod | Blocked at `cycle_config.pod_limit` (**default 1** — product must confirm 1 vs 2 before Jul 25; it's a config value) |
| S4.4 | P8 | **Metro-less member joins a pod** | If Cycle-3 pods are lab-tagged (`pods.lab_id` set), the metro fence **blocks** every metro-less member — most legacy rows. Decide before Sprint: either pods stay HQ (`lab_id NULL`, fence moot) or run a metro backfill. This is the likeliest mass-failure of Sprint night |
| S4.5 | P5 | Leave pod in-window, rejoin same pod | Leave works; rejoin reactivates the old membership row (no duplicate error) |
| S4.6 | P5 | Pod reaches `pod_min` | Pod flips `active`; all members' enrollments `active` (current model) |
| S4.7 | P5, two clocks | Join at the window boundary (e.g. close at 11:59 PM ET): try 11:55 PM ET and 12:05 AM ET | 11:55 works, 12:05 refused — **in both browser timezones**. This is the #1 timezone bug signature |
| S4.8 | P5 | Join attempt when no window open (Jul 15–24) | Clean "not open" message on page AND api; dashboard shows no join row |
| S4.9 | P4 | Poderator assigned post-formation | Sees their pod on moderator surfaces; pulse dashboard visible to them, invisible on the public pod page (#225) |

## S5 — Calendar & timezone (G0 item 1 now; rest at G2 if Stage 1 ships)

| ID | Scenario | Expected |
|---|---|---|
| S5.1 | **Window-entry convention (do this FIRST, before entering real windows):** admin enters "problem statements open Jul 25 9:00 AM ET" intent on staging; check the stored value, the rendered value, and when the gate actually flips (set a window 10 min ahead and watch it open) | The flip happens at 9:00 AM **Eastern**. Under the pre-overhaul naive columns, entered values are compared as UTC on the server (PR #224's ops note) — this test tells the admin exactly what to type so reality matches intent; write the convention down and use it for all Cycle-3 windows |
| S5.2 | (Stage 1) All ~critical pages show identical boundaries with an ET label; PT browser shows the same wall-clock + label | No page disagrees; no unlabeled times |
| S5.3 | (Stage 1) Admin shifts a phase boundary | Every surface (dashboard, join page, checklist row, moderator views) reflects it within a reload; legacy-column mirror (dual-write bridge) matches `cycle_phases` |
| S5.4 | (Stage 1) `getCycleWeek`/learning-log milestone timing after schema change | A cycle with unchanged dates produces identical week numbers and milestone windows |
| S5.5 | Admin misuse guard | Confirm `advance-phase` is not reachable by non-`testing:use` admins; brief the team not to use it on the live cycle |

*(Deliberately absent: DST scenarios — Cycle 3 runs Jul 14–Oct 13, entirely
inside EDT. DST testing belongs to Cycle 4.)*

## S6 — Sprint-night propose & vote (G2; post-#224 behavior)

| ID | Persona | Scenario | Expected |
|---|---|---|---|
| S6.1 | P5 (submitter) | Submit problem statement; then vote | Budget = `submitter_votes`; form scroll resets between steps |
| S6.2 | P7 (non-submitter) | Vote | Budget = `non_submitter_votes` |
| S6.3 | P5 | Stack multiple votes on one problem; reload | Stacking allowed; remaining budget correct after reload; over-budget → clear error |
| S6.4 | P2 | Finalize voting | Pods seeded from winning problems; ties/zero-vote edge handled (verify on staging with a tie) |

## S7 — Lifecycle & cron (G3)

| ID | Persona | Scenario | Expected |
|---|---|---|---|
| S7.1 | P2 | Decide + execute cron re-scheduling | **Do not schedule the "in no pods" arm while the gap stands**: with forming closing Jul 28 EOD and active-join not existing until the two-window work ships (Aug 11), a scheduled cron starts warning pod-less enrollees ~Jul 29 and revoking ~Aug 1 with no way back in — the dead-zone the requirements call out. Either ship the gate move with Stage 2, or leave the cron unscheduled until then |
| S7.2 | P5 | Pulse-check baseline for new enrollees | A Jul-14 joiner isn't warned before ~Jul 21 (7-day baseline from creation); banner timing matches |
| S7.3 | P11 | Revoked member joins a pod during active-join (post-Stage-1C) | Reactivated cleanly |
| S7.4 | P5 in dissolved pod (post-Stage-1C) | Forming-close dissolution | Members freed + notified; can join an active pod until active-join closes; not warned/revoked meanwhile |

## S8 — Regression spot-checks (every gate)

- P10: org-mode workstream pod untouched — no windows, no checklist changes,
  no cron interference.
- P3: lab lead sees their metro surfaces; 403 on another metro's admin
  surfaces.
- P1: owner console (dev branch, PRs #78-81 range) still gated owner-only.
- Events page (#230), profile/directory (#229), including that `/u/handle`
  links in circulation still resolve after the handle de-suffix migration —
  the PR itself flags this as a maintainer call.

## Interlocks with the open fix train (#224–#230)

Test **after** these merge; they change the behavior under test:

- **#224** — vote budgets/stacking + `checkWindow` hardening (S6, S5.1).
- **#225** — pulse-data leak fix (S3.7, S4.9).
- **#226** — ceremony copy + real event dates (S3.1, S3.6).
- **#227** — funnel name prefill (S3.1).
- **#228** — checklist order + window-gated pod row (S3.3, S4.8).
- **#229** — ⚠ carries migration `00078_handle_desuffix`, which **collides**
  with `00078_owner_actions_audit` already on dev — renumber before merge
  (`npm run check:migrations` on a rebased branch catches it).
- **#230** — events page fixes (S8).

Merge the train (in order, rebased, CI green), promote `dev → main`, then run
G1 on prod.
