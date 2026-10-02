# Personas and journeys — who OLOS serves, and what each needs from it

| | |
|---|---|
| **Status** | Proposal — supersedes the three-persona draft in [`docs/personas.md`](../personas.md) (May 2026) as the working definition; that file stays as the origin |
| **Owner** | Product / lead architect; the success team owns the copy voice |
| **Last verified** | 2026-09-15 against `main@226445a`; surfaces cited exist in the tree |
| **Companion** | [`pre-registration-persona.md`](pre-registration-persona.md) (the deep dive), [`next-sprint.md`](next-sprint.md) |

The May personas — Upskiller, Organizer, Moderator — were right and are still right.
They are also three of at least ten roles the shipped product now distinguishes, and
they describe *who* without describing the *journey*: what each person is trying to
do at each moment of a cycle, what the platform does for them today, and what they
need to see to understand that their action mattered. This document adds the journey.
It is written as a gut-check for product, copy, and program decisions, the same way the
May file was.

---

## 1. The organizing frame: a chapter moves through a cycle, and so does every role

The Labs' method is **frame innovation** (Dorst) applied to community problems: a
cohort observes the field, finds the paradox, reframes it, and builds something small
against the new frame, together. `SENSEMAKING_FLOW.md` already maps the member's path
through it. The same arc is what a **chapter** (a Local Lab) walks every cycle, and what
OLOS should make legible to every role:

| Cycle arc (12 weeks + the gap) | Frame-innovation stage | What the chapter is doing | Platform moment |
|---|---|---|---|
| **Between cycles** (Showcase → next Kickoff) | Archaeology, Context | Harvest the last cycle; recruit and prepare the next cohort; distribute the field survey | *the pre-registration window* |
| Weeks 0–2 · Kickoff → Sensemaking Sprint | Paradox | Observations in, statements out, ballot open | funnel, agreement, problem statements, votes |
| Weeks 2–4 · pods form → Meet the Pods | Themes, Frames | Cull to viable pods; pods sharpen a frame | pod registration, poderator assignment |
| Weeks 4–6 · Hackathon → pitches | Futures | Pitch, prototype, register to a project | project pitches, direct registration |
| Weeks 6–12 · build → Showcase | Transformation | Weekly practice, milestones, ship | Learning Log, milestone logs, insights |
| Showcase, then graduation | Integration | Projects graduate to the sector; people become alumni, mentors, contributors | close-out, spotlights, follows |

Every role below is described against this arc. The point of the table is the first
row: the gap between cycles is a stage of the method, not dead time, and the product
treats it as dead time today.

---

## 2. The impact loop — one design rule for every role

Each role should be able to answer, in the product, without asking staff:

> *What am I supposed to do now, why does it matter to the chapter, and what happened
> because I did it last time?*

The third clause is the one OLOS almost never answers. A poderator logs outreach and
never learns whether the member came back. A member files a Learning Log and never
sees that their share reached anyone. A pre-registrant signs an agreement and hears
nothing until kickoff. The sprint plan treats "close the loop" as an acceptance
criterion for every feature, and the metrics layer ([`data-strategy.md`](data-strategy.md)
§5) is what makes the third clause answerable.

---

## 3. The roles

Each role: **who** · **what they want** · **what OLOS does today** (verified) ·
**the gap** · **the loop to close**. Roles stack (a poderator is usually a member; a
lab lead may be an admin); the URL, not the person, chooses the hat (PRD-lab-lead §1).

### 3.1 Visitor / prospect

**Who.** Someone who found the Labs through an event, a library, a neighbor, or the
site. Curious, not committed. Often non-technical; often skeptical that "AI" is for them.

**Wants.** To know, in two minutes, what this is, whether people like them do it, what
it costs in time, and what the next concrete step is.

**Today.** Public site (`/`, `/about`, `/build-cycles`, `/events`, `/library`,
`/local-labs`, `/stories`, `/get-involved`), the shareable cohort page `/c/[cycle_id]`,
event RSVP without an account, the public field survey `/survey/[slug]`. `/build-cycles`
still reads a hardcoded constant (`lib/cycles/public-cycle.ts`), not the `cycles` table.

**Gap.** No social proof ("N neighbors in DC are pre-registered"), no dates for the
*next* cycle once the current one is past Hackathon, no clear "what you'll build"
until sign-in. The marketing corpus (`docs/marketing-site/`) has the copy; the app
does not render most of it.

**Loop.** "You RSVP'd to the Showcase → here is what those people built."

### 3.2 Pre-registrant *(new; the sprint's focus)*

**Who.** Has an account (or a waitlist row, or an RSVP) and is **not enrolled in an
active cycle**. Four sub-personas: the new prospect who signed up mid-cycle; the
**waitlisted** member in a city without an active lab; the **alum** between cycles; the
**late contributor** who arrived after the Hackathon and can only subscribe.

**Wants.** To know what they can still do *now*, how to be ready for the next cycle,
and that the organization noticed them.

**Today.** `getRecruitingCycle` resolves the upcoming cohort; the dashboard shows a
register task and a `CycleRegisterCard` in `open` / `pre_registered` / `closed` states;
the interest route writes `cycle_enrollments.status='registered'` on an `upcoming`
cycle; the welcome email links Slack and the cycle join page (when a cycle is active)
and otherwise promises "we will email you when the next cycle opens" — **and nothing
does**. Waitlisted members are sent to `/local-labs`.

**Gap.** Everything between the promise and kickoff. Full treatment in
[`pre-registration-persona.md`](pre-registration-persona.md).

**Loop.** "You pre-registered → the cohort is forming (N so far) → here is the one thing
to do this week → on kickoff day you were ready."

### 3.3 Upskiller (member)

**Who.** As in May: a non-technical or lightly technical professional shipping something
with a team for the first time. Silent disengagement is the failure mode.

**Wants.** A path they don't have to invent, pod-mates who are forgiving, a minute-long
weekly ritual, and a thing to point at in October.

**Today.** The richest surface: personalized dashboard with a task queue
(`lib/tasks`), setup checklist, commitments with `.ics`, the weekly Learning Log with
the hard gate and milestone modes, pods and projects pages, `/learning` with saves,
`/directory` with follows and a feed, profile at `/u/[handle]`, problem statements,
votes, pitches, direct project registration.

**Gap.** The "why this matters" layer: phase-info modals (GAP_AUDIT A4), the Slack /
GitHub / LLM setup is a dismissible row not a verified step, the Learning Log's promise
("the record you'll draw on when you write up your project", #361) has no export yet,
and a member never sees their pod's or their own trajectory. The directory is ahead of
the profiles (SOCIAL_LAYER §1).

**Loop.** "You filed 8 of 10 logs → your pod's clarity trend → your write-up draft is
already half written."

### 3.4 Poderator

**Who.** A volunteer shepherd for one or more pods, usually a returning member. "A
guide, not an answer key." Constitution: unblock, never grade; sanctioned signals only.

**Wants.** Tuesday signal, not Friday surprise; to know what the pod should be doing
this phase; a way to point a stuck member somewhere; to feel useful without being the
bottleneck.

**Today.** `/moderator` all-pods view with needs-attention rollup, per-pod pages with
roster, logs, insights (clarity/alignment, blocked-first list, copy-prompt AI bundle),
workshops, feedback inbox, pulse history (legacy), the cycle-scoped **submissions &
outreach** page with roster export and copy-for-Slack, phase guidance prose, resource
links (Slack/Drive/GitHub, mostly `NULL`), nudge dismissals.

**Gap.** Outreach is a list without a log: nothing records "I reached out to Sam on
Tuesday", so a second poderator or an admin cannot see it, and the poderator never
learns whether it worked. The build phase is project-shaped and the tooling is
pod-shaped (#378). Resource links are broken until Slack provisioning ships (ADR-0003
in PR #391). The digest email the PRD designed for never shipped.

**Loop.** "You contacted 3 members last week → 2 filed a log within 7 days." (This is
the single most motivating number a volunteer can be shown.)

### 3.5 Mentor

**Who.** A practitioner with domain or technical depth who helps a pod or a workshop for
an hour, a day, or a cycle. Recruited through `role_intents`, the survey's
`mentor_interest`, and events.

**Wants.** A briefing (what the pod is stuck on, what the day's block is for), a clear
ask with a time box, and to be remembered next cycle.

**Today.** Nothing. `role_intents` and `mentor_interest` are collected and drive no
flow. The work-day retro (#4, #10) says mentors could not plug in because the day's
structure lived in the hosts' heads.

**Gap.** Phase 5 (`mentor_profiles`, requests, testimonials) is unscheduled. A **lite**
version fits the pre-registration sprint: an admin list of mentor-intent people, a
"mentor briefing" page per event/pod, and the outreach log.

**Loop.** "You unblocked Pod Solar on Aug 15 → they shipped → here is their spotlight."

### 3.6 Lab lead

**Who.** Dana (PRD-lab-lead): a community organizer with a weekly and a quarterly
rhythm. Not staff, not a DBA. Manages inside the lab; never mints authority.

**Wants.** Her lab's slice of the shared cycle, her own internal cycle, her Core
Contributors, announcements, and to answer "who's new, who's stuck" without HQ.

**Today.** `/lab/[slug]` with the two cycle-context cards, pods, people, invitations
(honest three-affordance form), announcements, Leadership Log cascade (Fri). Phase 0+
shipped; Phases 1–2 of the PRD (tabbed tree, workstreams chartering UI, projects
portfolio, appointment email) are unrecorded.

**Gap.** Recruitment is the lab lead's real quarterly job and the product gives her no
recruitment view: how many in her metro are pre-registered, waitlisted, alumni, or
lapsed; no share link with lab-scoped social proof; no outreach log.

**Loop.** "Your lab's forming cohort: 14 pre-registered, 6 ready, 3 lapsed alumni you
could call."

### 3.7 Core contributor / workstream lead (org track)

**Who.** Staff and volunteers running the Labs itself, dogfooding the cycle machinery
(`ORG_CYCLES.md`). Marcus in PRD-admin-org.

**Wants.** Workstream rosters, chartering, the Wednesday/Thursday log cascade, and
not to be shown participant-cycle machinery.

**Today.** `/admin/org`, workstream runs as pods, `pod_role` invites, mode-aware nouns.
PRD-admin-org Phases 2–4 partly shipped, status unrecorded.

**Gap.** This role is the **development team**, and its own documentation and decision
practices are the subject of the framework doc. Dogfooding cuts both ways: the org
cycle should carry the roadmap's sprint as a workstream run.

### 3.8 Admin / organizer

**Who.** Priya: runs the participant experience — recruiting, formation, poderators,
compliance, revocations. A handful of people wearing every hat.

**Wants.** Her week back; one source of truth for cycle state; "which pods are at risk
right now" without a spreadsheet; who is about to ghost while there is time.

**Today.** Fourteen admin pages: cycles (config, phases, people, pods, formation,
testing controls), people & access, invitations, labs, org, content, stories, surveys,
feedback, tasks, weekly messages, announcements, explore (entity explorer), owner
console. Contact exports at six scopes.

**Gap.** **No metrics.** The landing page shows active/total per cycle and nothing
else. Engagement and retention are answered by exporting CSVs. There is no funnel, no
week-over-week compliance, no retention across cycles, no view of the pre-registration
pipeline. The moderator Insights page is the only analytics in the product and it is
pod-scoped by design.

**Loop.** "This week's compliance is 78%, down from 84% → 6 members behind → 4 already
contacted by their poderators."

### 3.9 Owner

**Who.** The rooted owner and co-owners: lifecycle authority (archive, reset, delete,
ban), roles, prod. Brendan.

**Today.** Owner console, Danger Zone (partly hidden — #383), bans (`00102`),
`owner_actions` audit, simulation ("View as"), authorization unification.

**Gap.** Decisions made in conversation reach the code and not the record (the vault
fixes this); erasure completeness is maintained by hand (#383, `lab_leads` gap).

### 3.10 Observer and tester

Read-only board members; tester accounts with self-reset. Adequate; keep out of metrics
(`is_test`) and out of the feed.

---

## 4. Stage × role: what each role needs the platform to do

| Stage | Pre-registrant | Upskiller | Poderator | Mentor | Lab lead | Admin |
|---|---|---|---|---|---|---|
| **Between cycles** | two lists: still-open now, prepare for next; readiness ladder; drip | alumni path: follow/contribute to graduated projects; mentor intent | recruit next poderators from the cohort; hand-off notes | intake + briefing template | recruitment view; share link; alumni outreach | pre-registration pipeline; retention; next cycle setup |
| **Kickoff → Sprint** | converts to member: ready on day 1 | observations, statements, ballot; setup gated (Slack/GitHub/LLM) | orientation card; first roster | day briefing | ballot per lab; cull pods | phase flips rehearsed; funnel |
| **Pods form** | (late arrivals) join open pods | choose pod; meet the pods | roster health; first outreach | — | poderator assignment | activation rate |
| **Hackathon → pitches** | late contributor: subscribe | pitch; register to a project | project-scoped view (#378) | briefing; stuck-points | lightning talks reuse | pitch count; registration |
| **Build** | — | weekly log; milestones; write-up draft | outreach queue + log; digest | office hours | Leadership Log | compliance trend; at-risk |
| **Showcase → graduation** | RSVP; see what was built | showcase; graduate; write-up export | hand-off; recruit successor | testimonial | portfolio | completion; retention seed |

Cells in **bold** above the fold of the next sprint: the between-cycles row and the
poderator outreach column. See [`next-sprint.md`](next-sprint.md).

---

## 5. Design-thinking practice, applied to the platform itself

The organization wants to "implement design thinking and frame innovation around how
communities move forward". Three practices keep the platform honest to that:

1. **Journey reviews per role, per cycle.** After each Showcase, walk each row of §4 with
   one real person from that role (the UAT script pattern in `testing-plan-cycle-uat.md`
   is the mechanism). Findings go to `feedback-running-list.md`; product calls to the
   vault.
2. **The paper prototype first.** `work-day-improvements.md` #4 ("do the paper briefing
   first — it's how we find out what belongs in the app") is the rule for every new
   role surface: the mentor briefing, the pre-cycle drip, the outreach log all start as
   a doc or a Slack message for one cohort before they become tables.
3. **Frame the persona, not the feature.** Every sprint doc names the persona and the
   loop it closes before it names the table. The label taxonomy (`persona/*`) makes the
   coverage measurable.

---

## 6. Copy voice by role (for the success team)

`DESIGN_SYSTEM.md` §11 owns the voice. Role-specific reminders:

- **Pre-registrant:** warm, concrete, dated. Never "stay tuned". Always one next step.
- **Upskiller:** "you're back in ✓" energy; never grade; name the week.
- **Poderator:** shepherd register — "unblock, don't manage"; signals, not scores.
- **Mentor:** brief and time-boxed; "here is the one thing this pod is stuck on".
- **Lab lead / admin:** operational, name-the-scope on every destructive action.
- Brand: "The Upskilling Labs" or "The Labs"; never "TUL". UI says "Poderator", code
  says `moderator`.
