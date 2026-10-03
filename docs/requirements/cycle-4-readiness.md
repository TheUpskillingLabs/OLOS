# Requirements — Cycle 4 readiness: an 8-week internal retrospective on a 12-week platform

| | |
|---|---|
| **Status** | Proposal. The shape of Cycle 4 is the owner's (D1, 2026-10-02). The approach below waits on the decisions in [#480](https://github.com/TheUpskillingLabs/OLOS/issues/480) |
| **Owner** | Lead architect / product |
| **Last verified** | 2026-10-03 against `dev@448fceb` |
| **Tracking** | Epic [#477](https://github.com/TheUpskillingLabs/OLOS/issues/477) · audience [#478](https://github.com/TheUpskillingLabs/OLOS/issues/478) · week grid [#479](https://github.com/TheUpskillingLabs/OLOS/issues/479) · decisions [#480](https://github.com/TheUpskillingLabs/OLOS/issues/480) |
| **Companion** | [`cycle-timeline.md`](cycle-timeline.md) (the schedule model this extends) · [`../roadmap/handoff-2026-09-28-onboarding-journeys.md`](../roadmap/handoff-2026-09-28-onboarding-journeys.md) (the lanes this touches) |

## 1. What changed

On 2026-10-02 the owner set the shape of the next Build Cycle (Cycle 4; D1 in
[`../roadmap/next-sprint.md`](../roadmap/next-sprint.md) §7):

- **8 weeks**, not 12.
- **A retrospective.** It goes back to the questions and projects of the previous three
  cycles to see where the work could improve.
- **Internal focus.** No public front door for cycle registration. Account signup stays
  open, because the workshops stay public.

OLOS was built around the 12-week cycle (a 91-day span, Kickoff Tuesday to Showcase
Tuesday). This document lists what assumes that shape, what each assumption does to an
8-week cycle, and how Cycle 4 gets what it needs **without deleting the 12-week design**.

## 2. The norms this sets (for Cycle 4 and every cycle after it)

These are the long-term habits the work under [#477](https://github.com/TheUpskillingLabs/OLOS/issues/477)
puts in place. Running a different kind of cycle should be a data change, not a code change.

1. **Cycle facts are data behind an API, not constants in code.**
   - Dates, length, audience, events, theme, and the copy that describes a cycle live in
     table rows (`cycles`, `cycle_config`, `cycle_phases`, `cycle_events`).
   - They are written through admin API routes with zod validation
     (`app/api/cycles/[cycle_id]/…`, `lib/validations/cycles.ts`).
   - They are read through one server helper per question.
   - A page never formats a cycle date or assumes a cycle length itself.
   - New code that names a specific cycle, a season, "12 weeks" or "8 weeks" in a string
     or constant is a review finding.
2. **Lifecycle and audience are separate questions.**
   - `cycles.status` says where a cycle is in time (`draft → upcoming → active → closing → archived`).
   - Who may see and join it is a separate field ([#478](https://github.com/TheUpskillingLabs/OLOS/issues/478)).
   - Hiding a cycle from the public never means pretending it is a draft.
3. **The 12-week template stays the default.**
   - The phase rail's labels, the "Anatomy" arc and the 13-marker weekly-message grid are
     kept. They render when a cycle has that shape.
   - A cycle with a different shape renders from its own rows (`cycle_events`,
     `cycle_phases`) or hides the template-only parts.
   - Nothing is deleted to make Cycle 4 fit.
4. **Two-fixture tests for anything that does cycle-time math.**
   - Every pure function that turns a date into a week, phase, window or status is tested
     against a 91-day cycle (results must equal today's) and a 56-day cycle (8 weeks).
   - Tests live under `lib/**/*.test.ts` (the vitest config).
5. **Reversible by default.**
   - Every Cycle 4 choice is a setting an admin can flip back, with a confirm step.
   - The one irreversible step (closing Cycle 3, §5) is done last and deliberately.

## 3. Lifecycle vs audience: why not "draft", why not `mode`

The first proposal from the ops thread was to move Cycle 4 from `upcoming` back to
`draft`. That removes the homepage banner, but:

- **It hides the cycle from everyone.** `selectMemberCycles` (`lib/cycle/active.ts:122`)
  only resolves `upcoming` rows, so a member who already pre-registered silently loses
  their dashboard card. So do the admin preview (`lib/tasks/preview.ts`) and the
  between-cycles dashboard ([#412](https://github.com/TheUpskillingLabs/OLOS/issues/412)).
- **It says the wrong thing.** "Draft" means not ready; Cycle 4 is ready, just not public.
- **It leaves other doors open.** `/build-cycles` and the `/events` footnote are
  hard-coded (§4) and keep inviting people regardless of status.

`cycles.mode = 'closed'` would also drop Cycle 4 from the public readers, which filter
`mode='open'`. But `closed` is the legacy pre-sector/B2B mode (`00049`), and the dashboard,
the join page and Learning Log compliance are scoped to `open`. The cycle would break for
its own members.

**The proposal ([#478](https://github.com/TheUpskillingLabs/OLOS/issues/478)):**
`cycles.registration_audience ∈ public | members | invite`, default `public`, migration
**`00108`** (claimed on the issue).

| Value | Public pages and signup email | Member dashboard | Join page and agreement API |
|---|---|---|---|
| `public` (today's behaviour) | shown | shown | open per `registrationWindow()` |
| `members` | not shown | shown | open to signed-in members per the window |
| `invite` | not shown | only members with an invitation, agreement or enrollment | same rule, enforced on the server |

**One rule, read on the server:**
- `getRecruitingCycle` / `getMemberRecruitingCycle` feed the homepage banner and the
  signup confirmation email.
- `selectMemberCycles` feeds the dashboard.
- The join page and `POST /api/cycles/[id]/agreement` enforce the rule, so a direct URL
  is not a back door.
- `getPublicCycleState()` reads it when lane U ships it
  ([#414](https://github.com/TheUpskillingLabs/OLOS/issues/414), reserved for the
  volunteer developer).

**No internal-only copy is hard-coded.** With no public cycle, the public pages show
lane U's general "no cycle open" state: "The next Build Cycle is being planned. When it
has a date, it appears here… the workshops are on, and the Learning Library is open."
That sentence is true whether the next cycle is internal or just unscheduled, and it
goes away by itself when a cycle is public again.

## 4. What assumes 12 weeks today

Verified against `dev@448fceb`. "Keep" means the 12-week behaviour stays as the default
template. The change makes it read the cycle's own data instead of assuming the shape.

| Surface | What it assumes | Effect on an 8-week cycle | Plan | Owner |
|---|---|---|---|---|
| `lib/cycle/week.ts` `getCycleWeek` | 13 equal slices of `[start, end]` | each "week" is about 4.3 days | 7-day weeks from the start, with `weekCount` from the dates. Identical for any 91-day cycle | [#479](https://github.com/TheUpskillingLabs/OLOS/issues/479), lane S ([#460](https://github.com/TheUpskillingLabs/OLOS/issues/460)) owns the file |
| `lib/learning-logs/at-risk.ts` → `compliance-logic.ts` | completed weeks counted on the slice grid | a member who logs every calendar Friday (the reminder cron is calendar-based) reads `behind` / `at_risk` | inherits [#479](https://github.com/TheUpskillingLabs/OLOS/issues/479) | [#479](https://github.com/TheUpskillingLabs/OLOS/issues/479) |
| `lib/moderator/pod-detail.ts` `synthesizeLogCadence` | slice grid, no join-date floor | false misses on the Poderator overview | [#463](https://github.com/TheUpskillingLabs/OLOS/issues/463) floors by date; [#479](https://github.com/TheUpskillingLabs/OLOS/issues/479) fixes the unit | P / [#463](https://github.com/TheUpskillingLabs/OLOS/issues/463) |
| `app/api/cron/revocation-check` | counts missed slice-weeks | would revoke members who are on time | stays **unscheduled** (it is today, in `vercel.json`) until [#479](https://github.com/TheUpskillingLabs/OLOS/issues/479) merges | ops |
| `lib/cycle/phase.ts` fallback | phase 1 at wk ≤ 3, phase 2 at wk ≤ 7, else 3 | Learning Log stems switch phase at the wrong time | data: set Cycle 4's `phase_2_start` / `phase_3_start`, which take precedence. Code: thresholds relative to `weekCount` | admin data; [#479](https://github.com/TheUpskillingLabs/OLOS/issues/479) |
| `cycle_config.milestone_mid_week` / `milestone_final_week` | defaults 6 / 12; validation `max(12)` | mid and final review land in the wrong week unless set | data: set them for Cycle 4 (e.g. 4 / 8). Validation becomes relative to the cycle's length | admin data; [#479](https://github.com/TheUpskillingLabs/OLOS/issues/479) |
| `cycle-phase-indicator.tsx` (the rail) | thirteen markers, wk0 Kickoff … wk12 Showcase | labels for events Cycle 4 may not hold | **keep** as the 12-week template; render from `cycle_events` when the cycle has rows (already the acceptance in [`cycle-timeline.md`](cycle-timeline.md)) | [#437](https://github.com/TheUpskillingLabs/OLOS/issues/437) |
| `lib/cycles/anchor-events.ts` | Cycle 3's six dates as a constant | the join ceremony, dashboard key dates and `.ics` would show **Cycle 3's dates** to Cycle 4 registrants | read `cycle_events` (seed Cycle 4's rows) | [#437](https://github.com/TheUpskillingLabs/OLOS/issues/437); editor [#464](https://github.com/TheUpskillingLabs/OLOS/issues/464) |
| `weekly_messages` (`00088`, CHECK `week 0..12`) | one program-wide message per 12-week marker | week-numbered copy from the 12-week arc shows in the wrong week | Cycle 4 rows scoped by `cycle_id` once lane S ships; until then review the program-wide rows | [#460](https://github.com/TheUpskillingLabs/OLOS/issues/460) |
| `lib/cycles/public-cycle.ts` `CYCLE_PUBLIC`, `/build-cycles`, `featured-events.tsx` footnote | "Summer 2026", "Register for this cycle" always shown | a public front door Cycle 4 does not want | the four-state page reading cycle state and [#478](https://github.com/TheUpskillingLabs/OLOS/issues/478)'s audience | [#414](https://github.com/TheUpskillingLabs/OLOS/issues/414) (volunteer) |
| `app/page.tsx` | "Build Cycles · 4 per year", "twelve weeks", the three-month "Anatomy" | describes the 12-week norm on the homepage | **keep** as the description of the usual cycle. The banner reads the audience. Wording stays with the volunteer's pages | [#414](https://github.com/TheUpskillingLabs/OLOS/issues/414) (volunteer) |
| `/local-labs/[slug]` | "Summer 2026 · Civic & Elections Cycle in progress" hard-coded | stale after Oct 13 | read cycle state | [#414](https://github.com/TheUpskillingLabs/OLOS/issues/414) (volunteer) |
| `/register` funnel role card | "Join a Cycle … Three months." | promises a public cycle and a length | state-keyed footnote (lane U-2) | U-2 (volunteer) |
| `/c/[cycle_id]` | hidden only when `draft` | a share link would still work for a members-only cycle | not rendered to signed-out viewers when the audience is not `public` | [#414](https://github.com/TheUpskillingLabs/OLOS/issues/414) (volunteer) |
| Signup confirmation email | cycle call to action when the legacy pod-registration window is open | invites to an internal cycle | the reader skips non-public cycles ([#478](https://github.com/TheUpskillingLabs/OLOS/issues/478)); window switch in U-2 | [#478](https://github.com/TheUpskillingLabs/OLOS/issues/478) |

Already data-driven, and fine for 8 weeks: cycle creation takes explicit
`start_date` / `end_date` (`app/api/cycles/route.ts`), the six window pairs in
`cycle_config`, `cycle_phases`, `registrationWindow()`, and the Friday log-window cron.

## 5. The run sheet

### Now (no code)

1. Check whether anyone has already pre-registered for Cycle 4 (`cycle_agreements`,
   `cycle_enrollments` with `status='registered'` for the cycle).
2. Send a short personal note to anyone affected. The decision issue names who sends it.
3. Confirm on production that Cycle 3's "Join this cycle" path cannot register anyone.
   Its join window should be closed, and `registrationWindow()` gates the ceremony.
4. Only if the banner must disappear before [#478](https://github.com/TheUpskillingLabs/OLOS/issues/478)
   ships: move Cycle 4 to `draft`, after step 1, knowing pre-registrants lose their card
   until it is moved back.

### First PRs (each reviewed before it reaches production)

1. [#478](https://github.com/TheUpskillingLabs/OLOS/issues/478): the audience field,
   the admin control, the server-side rule, tests. Then set Cycle 4 to
   `upcoming` + `members` (or `invite`, per [#480](https://github.com/TheUpskillingLabs/OLOS/issues/480)).
2. [#479](https://github.com/TheUpskillingLabs/OLOS/issues/479): real weeks, two-fixture
   tests.
3. [#414](https://github.com/TheUpskillingLabs/OLOS/issues/414) (volunteer): the
   "no cycle open" state first, since it becomes the public message.
4. [#437](https://github.com/TheUpskillingLabs/OLOS/issues/437) /
   [#464](https://github.com/TheUpskillingLabs/OLOS/issues/464): Cycle 4's dates come from
   `cycle_events`.

### Before Cycle 4 Kickoff

- Cycle 4's row has its real `start_date` / `end_date` and six `cycle_events` rows (or as
  many as the retrospective arc holds).
- Its `cycle_config` has `milestone_mid_week`, `milestone_final_week`, `phase_2_start`,
  `phase_3_start`, and only the windows the arc uses. An unset window simply never opens.
- Weekly messages for Cycle 4 are reviewed ([#460](https://github.com/TheUpskillingLabs/OLOS/issues/460)).
- The revocation cron is still unscheduled, or [#479](https://github.com/TheUpskillingLabs/OLOS/issues/479)
  has merged.
- A facilitator runs [`../testing-plan-cycle-uat.md`](../testing-plan-cycle-uat.md)
  against a seeded 56-day cycle on dev: a member logging weekly stays on track; the
  Poderator view agrees; the key dates are Cycle 4's; a signed-out visitor sees no
  registration path.

### At Cycle 3 close (Showcase, 13 Oct)

- **Before** `closeOutCycle`: agree how Cycle 4 participants reach Cycle 3 projects.
  Close-out dissolves pods, marks memberships inactive, and graduates projects to
  `governance='sector'`. After it, self-serve project join is closed
  (`app/api/projects/[project_id]/register/route.ts`), and only a DRI adding `project_roles`
  brings someone in. If the retrospective works on those projects, this is the step
  to hold ([#480](https://github.com/TheUpskillingLabs/OLOS/issues/480) item 4).
- Close Cycle 3 in admin; it cannot be undone. Then check the homepage: no registration
  banner, the general "no cycle open" message in its place.

## 6. How this avoids conflicts with the lanes

- **Migration numbers:** S = `00104`, C = `00105`, P = `00106`, #470 = `00107`, audience = `00108`.
- **File ownership:**
  - `lib/cycle/week.ts` stays lane S's ([#460](https://github.com/TheUpskillingLabs/OLOS/issues/460)).
    [#479](https://github.com/TheUpskillingLabs/OLOS/issues/479) is filed for S to take,
    or for whoever S hands it to.
  - `app/(public)/**`, `app/c/**`, the landing banner and `lib/cycles/public*.ts` stay
    the volunteer's ([#414](https://github.com/TheUpskillingLabs/OLOS/issues/414)).
  - [#478](https://github.com/TheUpskillingLabs/OLOS/issues/478) touches
    `lib/cycle/active.ts`, the admin cycle page, the cycle API route and validation, and
    the join/agreement guard. The `/c/` change is requested on #414, not made in #478.
- **Lane M** (the between-cycles dashboard, [#412](https://github.com/TheUpskillingLabs/OLOS/issues/412)/[#413](https://github.com/TheUpskillingLabs/OLOS/issues/413))
  reads the audience through `selectMemberCycles`. It never hard-codes cycle length or
  theme, and keeps "seeding one `upcoming` row flips the dashboard in one page load" as
  an acceptance test.
- **Lane P:** [#463](https://github.com/TheUpskillingLabs/OLOS/issues/463)'s join-date
  floor compares dates, not slice indices, so it composes with
  [#479](https://github.com/TheUpskillingLabs/OLOS/issues/479) in either merge order.

## 7. Decisions

Open, in [#480](https://github.com/TheUpskillingLabs/OLOS/issues/480):
1. audience (`members` vs `invite`);
2. which parts of the method arc run in 8 weeks;
3. whether past projects reopen to contributors;
4. whether Cycle 3's project close-out waits;
5. the readiness-ladder copy;
6. the public copy while no cycle is public;
7. Cycle 4's dates.

Each resolution is recorded here until the vault lands (PR #391), then as a vault note.

| Date | Decision | By |
|---|---|---|
| 2026-10-02 | Cycle 4 is 8 weeks, a retrospective over Cycles 1–3, internal focus; account signup stays open for workshops | owner (D1, #392) |
| 2026-10-03 | *Proposed:* separate audience from lifecycle (`registration_audience`, `00108`); count cycle weeks as real 7-day weeks; keep the 12-week template as the default; two-fixture tests for cycle-time math | this document; ratify in [#480](https://github.com/TheUpskillingLabs/OLOS/issues/480) |
