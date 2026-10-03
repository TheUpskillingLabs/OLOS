# Requirements — Cycle 4 readiness: an internal cycle without a public front door

| | |
|---|---|
| **Status** | Plan of record for Cycle 4. Decided 2026-10-03 (owner, [#480](https://github.com/TheUpskillingLabs/OLOS/issues/480)): Cycle 4 runs as an org cycle, and the next public cycle opens in 2027. Cycle 3's close-out timing and Cycle 4's dates are still open in #480 |
| **Owner** | Lead architect / product |
| **Last verified** | 2026-10-03 against `dev@448fceb` |
| **Tracking** | Epic [#477](https://github.com/TheUpskillingLabs/OLOS/issues/477) · **ops log [#481](https://github.com/TheUpskillingLabs/OLOS/issues/481)** (every non-technical action, appended as the build lands) · decisions [#480](https://github.com/TheUpskillingLabs/OLOS/issues/480) · registration audience [#478](https://github.com/TheUpskillingLabs/OLOS/issues/478) (backlog) · week counting [#479](https://github.com/TheUpskillingLabs/OLOS/issues/479) (closed, not planned) |
| **Companion** | [`../ORG_CYCLES.md`](../ORG_CYCLES.md) (the internal-cycle track) · [`cycle-timeline.md`](cycle-timeline.md) (the schedule model) · [`../roadmap/handoff-2026-09-28-onboarding-journeys.md`](../roadmap/handoff-2026-09-28-onboarding-journeys.md) (the lanes) |

## 1. What changed

The next Build Cycle (Cycle 4) is **internal**. It is about 8 weeks, and it is structured
differently from the usual cycle: The Labs works with the data and projects gathered in
Cycles 1–3 to draw insights, build materials, and learn what the platform needs. Account
signup stays open, because the workshops stay public.

The board's framing (2026-10-03):

> "Doing it closed to focus on ourselves/alleviate capacity. The hot fix is just making
> sure it's not on our website's main page."

**The order of work:**
1. **The hot fix:** Cycle 4 off the main page.
2. **Live but not public:** Cycle 4 runs as an internal org cycle; the public cannot see or
   register for it. The next **public** cycle opens in **2027**.
3. **Managing expectations:** nothing public promises a cycle or a notification that
   isn't coming.
4. **Then** the improvements for members who aren't in a cycle: an engaging dashboard,
   with materials and notifications on the platform about what to do while they wait.

**Not changing:** how cycle weeks are counted ([#479](https://github.com/TheUpskillingLabs/OLOS/issues/479),
closed as not planned), and the 12-week visuals, which are kept. §6 lists what assumes
12 weeks, as known limitations Cycle 4 avoids with settings, not code.

## 2. The hot fix: Cycle 4 off the main page (data only)

**How the banner chooses a cycle.** The homepage banner (`app/page.tsx`) comes from
`getRecruitingCycle` (`lib/cycle/active.ts`): the newest `status='upcoming'`,
`mode='open'` HQ cycle, otherwise the `active` open one.
- While Cycle 4 is `upcoming`, the banner says "Registration open now", with Cycle 4's
  name, "Kicks off {date} — twelve weeks…", and a join button.
- The signup confirmation email reads the same function
  (`app/api/registrations/funnel/route.ts`).

**Steps:**

1. **Check for pre-registrations.**

   ```sql
   -- read-only
   SELECT count(*) FROM cycle_agreements WHERE cycle_id = :cycle4;
   SELECT status, count(*) FROM cycle_enrollments WHERE cycle_id = :cycle4 GROUP BY status;
   ```

2. **Send a short personal note** to anyone counted. #480 names who sends it.
3. **Move Cycle 4 back to draft.** It is reversible; Cycle 4 can return to `upcoming` the
   same way.

   ```sql
   UPDATE cycles SET status = 'draft' WHERE id = :cycle4 AND status = 'upcoming';
   ```

   A `draft` cycle is hidden from every reader: the banner, the signup email, the
   dashboard, and `/c/[id]`, which returns 404 for drafts. Pre-registrants lose their
   dashboard card until it moves back, which is why step 1 comes first.
4. **Check Cycle 3's join path.** Until Cycle 3 closes, the banner shows it as "Cycle in
   progress" with "Join this cycle". Confirm on production that the join page shows
   "closed": `registrationWindow()` gates the ceremony and the agreement API.
5. **After Cycle 3 closes,** the banner shows its no-cycle state: "Next cycle coming soon
   · No cycle is open right now · Join The Labs and we'll tell you the moment registration
   opens." The cycle is off the main page, but that sentence is a promise (§4).

## 3. Live but not public

A cycle that is running but not advertised can be done two ways. **Decided 2026-10-03:
Option A** (build less for the same effect). Option B stays in the backlog.

### Option A (chosen): an internal "org" cycle (exists today, no code)

`cycles.mode='org'` is the track The Labs built to run cycles on itself
([`../ORG_CYCLES.md`](../ORG_CYCLES.md)): "the org dogfoods the participant cycle
machinery".
- **Never public.** `getRecruitingCycle` and the signup email only read `mode='open'`.
- **Invite-only.** Work is organised as workstreams; a workstream's run is an ordinary
  pod. Admins or co-leads invite people (`invitations.pod_role`), and self-serve
  registration is rejected.
- **Runs alongside the participant track.** At most one `active` and one `upcoming` org
  cycle per lab, HQ included. **Check in admin that HQ has no other org cycle in those
  states.**
- **Members who are in it** see "Your workstreams" on their dashboard. Everyone else sees
  nothing, so every other member stays "between cycles" (§5).
- **Fits** "focus on ourselves", internal stakeholders, and working with past data and
  projects.
- **Gap:** `/c/[cycle_id]` renders any non-draft cycle, including an org cycle, to anyone
  holding the link. Nothing links there, but the page should 404 for org cycles (lane U's
  spec already says so; #414, the volunteer's area).

### Option B (backlog): a participant cycle with members-only registration ([#478](https://github.com/TheUpskillingLabs/OLOS/issues/478), small new code)

For a cycle that any member should be able to see on their dashboard and opt into, but
that the public cannot register for.
- **The field:** `cycles.registration_audience ∈ public | members | invite`, default
  `public`, one migration; the number is claimed when someone picks the issue up.
- **One server rule:** the banner, the signup email, the dashboard
  (`selectMemberCycles`), and the join page and agreement API all read it.
- **Status and audience stay separate.** "Draft" keeps meaning "not ready". Hiding a
  cycle from the public no longer means pretending it is a draft.

Deferred: kept for the first participant cycle that needs to be visible to members but not
advertised.

### Either option

- **Pause the weekly Learning Log gate** on Cycle 4 (`cycle_config.log_gate_paused`)
  unless its rhythm is weekly logs. That keeps the 12-week week counting (§6) from
  touching it.
- **Keep the revocation cron unscheduled.** `/api/cron/revocation-check` is unscheduled
  today, in `vercel.json`.
- **Leave unused windows empty.** Set only the `cycle_config` windows the internal arc
  uses; an empty window never opens, so no window tasks fire.

## 4. Managing expectations: copy that promises something

| Where | Says today | Recommended | Owner |
|---|---|---|---|
| Homepage no-cycle banner (`app/page.tsx`) | "Join The Labs and we'll tell you the moment registration opens." | Lane U's general state, which may say the next public cycle opens in 2027: "The next public Build Cycle opens in 2027. Until then the workshops are on, and the Learning Library is open." (No notification promise.) | [#414](https://github.com/TheUpskillingLabs/OLOS/issues/414) (volunteer); a hot-fix edit needs the owner's OK and a note on #414 |
| Homepage section head | "Build Cycles · 4 per year" | The owner decides whether it still holds; describes the usual programme | #414 |
| `/build-cycles` | "Summer 2026", "Register for this cycle" always shown | The four-state page; "none" while no cycle is public | #414 |
| `/local-labs/[slug]` | "Summer 2026 · Civic & Elections Cycle in progress" | Reads cycle state | #414 |
| Signup confirmation email | "We will email you when the next cycle opens" | Soften now (D-U6): "The next one is announced on your dashboard the day it has a date, and by email if you asked us to write." | lane U-2 |
| Waitlist page | "One tap. One email when it happens." (no code sends it) | Remove the promise, or keep it once the drip ships | [#415](https://github.com/TheUpskillingLabs/OLOS/issues/415) |
| `/register` "Join a Cycle" card | "…Three months." | State-keyed footnote | lane U-2 |

The general "no cycle open" sentence is the expectation-safe default. It is true whether
the next cycle is internal or unscheduled, and it goes away by itself when a public cycle
exists again. Nothing internal-specific is hard-coded.

## 5. While members wait: materials and notifications

Every member who is not in Cycle 4 is between cycles until the next public cycle.

**Now, with existing admin tools (no code):**

| Tool | Reaches | Use it for |
|---|---|---|
| `/admin/tasks` (`custom_tasks`, `00097`) | every member's dashboard when the task has no cycle; optional start/end window, pin, dismissible | "Do this while you wait": a workshop to attend, a Library item to read, a survey |
| `/admin/announcements` (`00070`) | org-wide or one lab; published and pinned | news and context ("The next public cycle is being planned; here's what's on") |
| `/admin/content` → Library | `/library` (public) and `/learning` (members) | the materials themselves |
| Events (Luma sync) | `/events`, homepage | workshops that stay public |

**Then, the planned lanes:**
- The between-cycles dashboard and readiness ladder
  ([#412](https://github.com/TheUpskillingLabs/OLOS/issues/412),
  [#413](https://github.com/TheUpskillingLabs/OLOS/issues/413)). Its rule already treats
  "no participant cycle running" as between cycles, and never shows the ladder to an
  org-cycle member.
- The "Before the cycle" shelf ([#441](https://github.com/TheUpskillingLabs/OLOS/issues/441)).
- Weekly messages with audiences and an email channel
  ([#460](https://github.com/TheUpskillingLabs/OLOS/issues/460)).

None of these name a cycle in code. The journey through the long gap, the line of
communication, and the seven measures this sprint is judged on are in
[`../roadmap/pre-registration-persona.md`](../roadmap/pre-registration-persona.md) §10. The
monthly refresh and review are on the ops log [#481](https://github.com/TheUpskillingLabs/OLOS/issues/481).

## 6. Known limitations: what assumes the 12-week shape (no change planned)

Recorded so nobody is surprised; verified against `dev@448fceb`. Cycle 4 avoids each one
with the settings in §3. The 12-week visuals stay as they are.

| Surface | What it assumes | How Cycle 4 avoids it |
|---|---|---|
| `lib/cycle/week.ts` `getCycleWeek` | divides any cycle's span into 13 equal slices (≈7 days only for a 91-day cycle) | pause the log gate. At-risk and compliance (`lib/learning-logs/at-risk.ts`), the Poderator cadence (`lib/moderator/pod-detail.ts`) and the revocation check only matter while weekly logs are required |
| `lib/cycle/phase.ts` fallback (wk ≤ 3 / ≤ 7) | Learning Log stem wording by week | set `phase_2_start` / `phase_3_start`, or leave it (wording only) |
| `milestone_mid_week` / `milestone_final_week` (default 6 / 12, `max(12)`) | mid and final review weeks | set them for Cycle 4, or don't use milestones |
| Phase rail (`cycle-phase-indicator.tsx`), wk0 Kickoff … wk12 Showcase | the 12-week arc | kept. Org-cycle members see workstreams, not the rail |
| `lib/cycles/anchor-events.ts` | Cycle 3's six dates; drives the join ceremony, dashboard key dates and `.ics` | not reached by an org cycle (no ceremony). A participant cycle needs [#437](https://github.com/TheUpskillingLabs/OLOS/issues/437) first |
| `weekly_messages` (wk0–wk12, program-wide) | the 12-week arc's week numbers | shows only to members engaged in the open active cycle; not to org-cycle members |
| Public copy (§4) | a public 12-week cycle | §4 |

## 7. How this avoids conflicts with the lanes

- **No new code is needed for the hot fix or for Option A.** Option B
  ([#478](https://github.com/TheUpskillingLabs/OLOS/issues/478), backlog) claims no migration
  number until someone picks it up, so it doesn't block the lanes' `00104`–`00107`.
- **Public pages stay with the volunteer.** Copy in `app/(public)/**`, `app/c/**`, the
  homepage banner and `lib/cycles/public*.ts` belongs to the volunteer developer
  ([#414](https://github.com/TheUpskillingLabs/OLOS/issues/414)). Requests go there as
  comments, not edits.
- **Lane M** (the between-cycles dashboard) reads cycle state through
  `selectMemberCycles`. It never hard-codes cycle length or theme, and keeps "seeding one
  `upcoming` row flips the dashboard in one page load" as an acceptance test.
- **`lib/cycle/week.ts` is untouched.**

## 8. A habit to keep

New code reads a cycle's facts (dates, audience, events, theme, descriptive copy) from
its rows through one helper, and admins change them through the admin API. It never
writes them as constants. This is a habit for new work, not a refactor of existing code:
the items in §6 stay until a lane has a reason to touch them.

## 9. Decisions

Still open, in [#480](https://github.com/TheUpskillingLabs/OLOS/issues/480):
- the log gate on the org cycle;
- the timing of Cycle 3's project close-out (before Oct 13);
- whether past projects reopen to contributors;
- Cycle 4's dates;
- the exact public wording (with #414).

Each resolution is recorded here until the vault lands (PR #391), then as a vault note.

| Date | Decision | By |
|---|---|---|
| 2026-10-02 | Cycle 4 is internal (about 8 weeks), structured around the data and projects of Cycles 1–3; account signup stays open for workshops | owner (D1, #392) |
| 2026-10-03 | Run it closed to focus on ourselves and relieve capacity; the hot fix is keeping it off the website's main page | board |
| 2026-10-03 | Do not change how cycle weeks are counted; no new technical debt for Cycle 4 (#479 closed as not planned) | owner |
| 2026-10-03 | Hot fix by data (the public Cycle 4 row to `draft`); **Cycle 4 runs as an org cycle**; #478 deferred to the backlog (`00108` released); the **next public cycle opens in 2027**, and nothing advertises a next cycle before then; OLOS signup stays open | owner (#480) |
| 2026-10-03 | Keep a running non-technical ops log, appended as technical work lands, so no check or action is left behind | owner (#481) |
