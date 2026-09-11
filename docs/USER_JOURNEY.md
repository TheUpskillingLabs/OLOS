# The OLOS user journey — current state

*A map of what a person actually experiences in OLOS today, read off the code
on `main` (226445a, 2026-09-11). Not a proposal. Where the shipped behaviour
differs from a PRD or the MVP spec, this document follows the code.*

Companion docs: [`docs/personas.md`](personas.md) (who these people are),
[`docs/ARCHITECTURE.md`](ARCHITECTURE.md) (how the app is organized),
[`docs/LOCAL_LABS.md`](LOCAL_LABS.md) (the membership spine),
[`docs/SECTOR_MODEL.md`](SECTOR_MODEL.md) (cycle lifecycle).

---

## How to read this

Three tracks run through the product, and one person can be on more than one
at a time (roles stack):

| Track | Persona | Entry | Home surface |
|---|---|---|---|
| **A — Upskiller** | participant in a Build Cycle | the public web | `/dashboard` |
| **B — Poderator** | volunteer shepherd for a pod | an admin assignment | `/moderator` |
| **C — Organizer** | TUL staff (admin / owner) | a DB-granted role | `/admin` |

Track A is the spine — B and C are overlays on people who are usually already
on it. Each stage below records: **what the person does**, **where**, **what
changes in the database**, **what gates it**, and **where the code lives**.

Two mechanics recur everywhere and are worth internalizing before reading the
stages:

- **Windows.** Six member-facing cycle actions are each open only inside an
  admin-set date window (`lib/cycles/windows.ts` is the single registry).
  Outside its window an action isn't just hidden — the API rejects it.
- **The gate.** The weekly Learning Log has teeth: while it's due, every
  dashboard route but Home bounces to Home (`app/(dashboard)/layout.tsx`).

---

## The journey at a glance

```
PUBLIC                      ACCOUNT                     COHORT                      POD LIFE
──────                      ───────                     ──────                      ────────
/ landing                   Sign in with Google         Register for the cycle      Pod formation
/events /library            ↓                           (the ceremony + signature)  ↓
/local-labs /stories        Signup funnel               ↓                           Weekly Learning Log ⟲
/c/[cycle] /survey          (5 steps + agreement)       Baseline log                ↓
  ↓                         ↓                           ↓                           Solutions → vote → project
  Join The Labs             Choose your Local Lab       Problem situations          ↓
                            ↓                           → vote → pods               Build → Showcase → close-out
                            /dashboard  ◀────────────── home base for all of it ──────────────▶
```

Stages 0–4 are open to anyone. Stage 5 onward requires membership in an
**active** Local Lab — that's the hard fork in the funnel.

---

# Track A — The Upskiller

## Stage 0 · Discover (no account)

**Where:** `/` plus `/events`, `/library`, `/local-labs`, `/stories`,
`/about`, `/build-cycles`, `/sectors/[slug]`, `/c/[cycle_id]` (shareable cycle
page), `/survey/[slug]`, and the footer pages.

The public web **browses free** — the middleware allowlist in `proxy.ts`
carries these paths, so nothing here is gated. The landing page resolves the
*recruiting* cycle (`getRecruitingCycle` — the upcoming cohort if one is open,
else the running one) and renders a banner whose CTA adapts:

| Visitor | Recruiting cycle exists | CTA → |
|---|---|---|
| signed out | yes | `/login?intent=join` |
| signed out | no | `/login?intent=join` ("we'll tell you when it opens") |
| signed in | yes | `/cycles/{id}/join` — straight into the ceremony |
| signed in | no | `/dashboard` |

**Also reachable here:** event RSVPs (`POST /api/events/[event_id]/rsvp`),
metro waitlist signups (`POST /api/metros/[metro_id]/waitlist`), and the
anonymous field survey (`/survey/[slug]` — account-free by design).

**Code:** `app/page.tsx`, `proxy.ts`, `lib/content/queries.ts`,
`lib/cycle/active.ts`.

---

## Stage 1 · The door

**Where:** `/login` (also available as a modal via the `@authmodal` parallel
route).

Google OAuth only — no password, no magic link. The login card sets an
`auth_intent` cookie (`join` or `login`) before kicking off OAuth, and that
cookie decides what happens to a **Google account we don't recognize**:

- `intent=join` → continue into registration.
- `intent=login` → sign the Supabase session back out and return
  `?error=no_account` — deliberately *not* a silent drop into signup.

`GET /api/auth/callback` then runs, in order:

1. **Ban gate** — a blocklisted email never gets an app session, even if the
   participant row is gone (`lib/auth/bans.ts`; the blocklist is keyed on
   email so an erasure can't be used to re-enter).
2. **Participant lookup** by case-insensitive email.
3. **Link** `auth_user_id` to the participant row if not yet set.
4. **Fulfil any pending invitation** carried by an `invite_token` cookie —
   grants permissions/role preset, and can enrol the person in a cycle and
   place them in a pod outright (`lib/auth/invitations.ts`).
5. **Route:** known participant → `/dashboard`; unknown + join intent →
   `/register`.

**Code:** `app/(auth)/login/login-card.tsx`,
`app/api/auth/callback/route.ts`.

---

## Stage 2 · The signup funnel

**Where:** `/register` — a one-question-per-screen flow, not a long form.

```
Role intent  →  ① email (confirm)  →  ② name + zip  →  ③ work situation
             →  ④ how you heard about us (+ who referred you)
             →  ⑤ the Participant Agreement (scroll-gated consent)
             →  Choose your Local Lab
```

- **Role intent** (multi-select): Join a Cycle · Attend events & workshops ·
  Volunteer · Mentor. Recorded as `participants.role_intents`; it shapes what
  the dashboard surfaces, **not** where you land. Every new member lands on
  `/dashboard` regardless.
- Name fields are **prefilled from the Google profile**; email is read-only.
- The **Participant Agreement** is rendered in full behind a scroll gate and
  versioned (`PARTICIPANT_AGREEMENT_VERSION`). Accepting stamps
  `agreement_version` + `agreement_accepted_at`.

**Writes:** one `participants` row (`POST /api/registrations/funnel`), plus a
`metro_waitlist_signups` row on the waitlist branches. Sends the registration
confirmation email; a duplicate email instead gets the "you already have an
account" email and a friendly dead-end screen.

**Code:** `app/(auth)/register/funnel.tsx`,
`app/api/registrations/funnel/route.ts`, `lib/email/*-template.ts`.

---

## Stage 3 · Choose your Local Lab — **the fork**

The last funnel screen asks where you'll build. The zip from step ② suggests
the nearest lab (`GET /api/labs/suggest`), and there are three branches:

| Branch | What it writes | What it unlocks |
|---|---|---|
| **Join an active lab** | `participants.metro_id` + `metro_slug` | ✅ full track A — cycle registration is open to you |
| **Join a lab's waitlist** | `metro_waitlist_signups`; `metro_id` stays NULL | ⛔ cycle registration blocked |
| **Start a lab for my city** | finds-or-creates a `waitlist` metro, then as above | ⛔ cycle registration blocked |

This is the single most consequential choice in the funnel and it is easy to
miss: the two waitlist branches produce a fully-functioning account that
**cannot register for a cycle**. `/cycles/{id}/join` redirects such a member
to `/local-labs` before any ceremony renders.

**Code:** `LabChoiceScreen` in `app/(auth)/register/funnel.tsx`,
`app/api/labs/suggest/route.ts`, `docs/LOCAL_LABS.md`.

---

## Stage 4 · The dashboard — home base

**Where:** `/dashboard`. Every path leads here, in every state.

Two guards run in the layout before the page renders:

1. **Placeholder-name gate** — a participant whose name is still the
   `Unknown` stub is forced to `/profile/edit?required=true&next=…`.
2. **Learning Log gate** — if a log is due, every route except `/dashboard`,
   `/profile/edit` and `/api/*` redirects to `/dashboard`.

The page resolves one of five states:

| State | Condition | What the member sees |
|---|---|---|
| `no_cycle` | no running open cycle | onboarding checklist, empty-state hero |
| `no_enrollment` | cycle running, no enrolment row | the **Register** task, pointed at the upcoming cohort when one is open |
| `interest_submitted_window_closed` | enrolled, pod window shut | "pod registration opens …" |
| `interest_submitted_window_open` | enrolled, pod window open | the pod-join section |
| `active` | enrolment `active`, or in a pod | full chrome: phase rail, pods, log, feed |

**What's on it:** the Up-next task queue (the one derivation of "what should I
do now" — `lib/tasks/assemble.ts`), the setup checklist (bio/headline · follow
people · join Slack), the Learning Log card, the memberships rail (lab, pods,
projects, workstreams), announcements, the updates feed + composer, and
People-you-may-know.

The task queue is the journey engine. In priority order it emits: the blocking
weekly log → register/pre-register for a cohort → baseline log → first log →
**any open cycle window** → Leadership Log → admin-authored custom tasks.

**Code:** `app/(dashboard)/layout.tsx`, `app/(dashboard)/dashboard/page.tsx`,
`lib/tasks/`.

---

## Stage 5 · Register for the cycle — the ceremony

**Where:** `/cycles/{cycle_id}/join`.

Account creation is deliberately light; **the cycle is where the gravity is**.
Before anything renders, four redirects can fire: no participant row →
`/register`; no active lab → `/local-labs`; cycle not `active`/`upcoming`, or
`mode='org'` (invite-only), or belonging to another lab → `/cycles`; and the
**D-10 registration window** closed → a "registration closed / reopens …"
screen.

The ceremony itself:

```
Threshold (value, then terms, then effort — "Not now" is a respectable exit)
  → What a Build Cycle is
  → What {cycle name} means
  → What draws you to the theme? (optional)
  → What are you hoping to get better at?
  → Where are you hoping this takes you?
  → How much time can you commit?
  → The Open Cycle Agreement — typed signature, scroll-gated
  → Confirmation: kickoff date, .ics of the five core events, pod CTA
```

The agreement commits to three things in plain language: best effort to
attend the five core events in person, a weekly Learning Log ("if I skip it,
the app pauses until I catch up"), and open-source output (MIT / CC BY 4.0).

**Writes:** `cycle_agreements` (versioned, signed) + a `cycle_enrollments` row
at status **`registered`**. Activation is *not* granted here — it comes from
landing in an active pod.

**Code:** `app/(dashboard)/cycles/[cycle_id]/join/{page,ceremony}.tsx`,
`app/api/cycles/[cycle_id]/agreement/route.ts`,
`registrationWindow()` in `lib/cycles/schedule.ts`.

---

## Stage 6 · Problem discovery (windows 1–2)

| # | Window | Route | Member action |
|---|---|---|---|
| 1 | `problem_statement` | `/cycles/{id}/propose` | Submit a problem situation |
| 2 | `voting` | `/cycles/{id}/vote` | Vote on problem situations |

Between and after these, `/cycles/{id}/proposals` is a read-only gallery that
renders in **every** phase (the ballot only exists while voting is open, which
used to make submissions unbrowsable the rest of the cycle). Submissions are
shown without author attribution.

Closing the vote (`POST /api/voting/finalize/{cycle_id}`) turns top-voted
problem situations into **pods** — selection runs *per lab*, each forming up to
`cycle_config.max_pods` of its own top statements above `vote_threshold`, with
pod names generated from the statement text.

---

## Stage 7 · Pod formation (window 3) — the activation moment

**Where:** `/cycles/{id}/register-pods`, or the pod-join section on the
dashboard.

`POST /api/pods/{pod_id}/register` enforces, in order: pod is `forming` or
`active`; the window is open; the member hasn't exceeded `cycle_config.pod_limit`
(default 1); lab membership matches the pod's lab. Then:

- registrant count reaches `cycle_config.pod_min` → the pod flips
  `forming → active` and **every** member's enrolment reconciles to `active`;
- the pod was already `active` → just this member reconciles to `active`.

This is the moment a "registered" member becomes an **active** one — and with
it come the weekly log obligation, the gate, and compliance tracking.
Withdrawing the last pod drops the enrolment back down (`registered`), it does
not remove the member from the cycle.

Late arrivals are handled by a second window: registration reopens during
`pod_active_join`, after a "dead zone" while pods are forming.

**Code:** `app/api/pods/[pod_id]/register/route.ts`,
`lib/enrollment/reconciler.ts`.

---

## Stage 8 · Life in a pod — the weekly loop

This is where most of the cycle is spent, and it's a loop, not a line:

```
        ┌─────────────────────────────────────────────┐
        ▼                                             │
  Friday 21:00 — cron stamps cycle_config.log_due_at  │
        ↓                                             │
  Daily 09:00 — reminder email to anyone unmet        │
        ↓                                             │
  Member opens /dashboard → every other route bounces │
        ↓                                             │
  Files the weekly Learning Log (health check +       │
  reflection + optional public share)  ──── clears ───┘
```

The log is a **personal practice from day one** (journal mode before you're in
a cycle) that becomes a **cycle obligation** once you're active. Two softer
layers sit alongside the hard lock: a dismissible compliance nudge when you're
a week behind, and the at-risk threshold (`at_risk_consecutive_misses`,
default 2) that the revocation cron warns at.

Pod-mates' shared surfaces: `/pods/{id}` (roster, charter, problem details,
page updates, follow), `/projects/{id}`, the updates feed, `/directory`,
`/network`, `/u/{handle}` profiles, and `/learning` (the signed-in catalog).

**Code:** `lib/learning-logs/{gate,compliance-logic,at-risk}.ts`,
`app/api/cron/learning-log-{window,reminder}/route.ts`.

---

## Stage 9 · Solutions → projects (windows 4–6)

| # | Window | Route | Member action |
|---|---|---|---|
| 4 | `solution_proposal` | `/cycles/{id}/solutions` | Submit your solution proposal |
| 5 | `solution_voting` | `/cycles/{id}/solution-vote` | Cast your solution ballot |
| 6 | `project_registration` | `/cycles/{id}/register-projects` | Register for a project |

`/cycles/{id}/solution-gallery` is the member-safe view of the pitches:
anonymized by construction (it reads no `participant_id`, no timestamps), with
the four qualitative answers unlocking **after you submit your own** or once
voting opens. Poderators see the full attributed view at
`/moderator/cycles/{id}/submissions`.

Top-voted proposals become **projects** under the pod
(`POST /api/pods/{id}/projects/finalize`), and a project belongs to exactly one
pod, which belongs to exactly one cycle.

---

## Stage 10 · Build, showcase, close-out

Weeks of building, punctuated by **milestone weeks** (admin-set
`milestone_mid_week` / `milestone_final_week`) where the weekly log reframes as
a self-evaluation prefilled from your own last entry. The cycle ends at a
public showcase; close-out archives pods so local Poderators can focus on the
next cohort, while projects can graduate to a **sector** as open source
(`lib/cycle/closeout.ts`, `docs/SECTOR_MODEL.md`).

Past cycles remain reachable from the dashboard rail.

---

# Track B — The Poderator

**Becoming one:** by admin assignment only (`moderator_assignments`, via
`POST /api/pods/{pod_id}/moderators` or a pod-scoped invitation). There is no
self-serve path. A Poderator *without* an enrolment of their own is
recognized as assignment-only: the dashboard stops nagging them to register.

**Their surface** (`/moderator`, copy always says "Poderator", never
"moderator"):

- **All pods** → summary cards, a members-needing-attention rollup, cross-pod
  insights, range + cycle filters. Single-pod Poderators are auto-routed to
  their pod.
- **Per pod** → `/moderator/pods/{id}` plus tabs: `roster`, `logs`,
  `insights`, `pulse-insights`, `workshops`, `feedback`, `explore`.

**Their loop:** read this week's logs and health bands → spot the quiet ones →
act (nudge, connect, escalate) → dismiss the nudge. Health-check answers are
visible to the Poderator and staff only — stated to members in the Participant
Agreement.

**Their own obligation:** org leads (workstream / lab tier) file a weekly
**Leadership Log**, armed Wednesdays 13:00 by cron, written against the tier
below them. Non-blocking — no gate.

**Code:** `app/(dashboard)/moderator/**`, `lib/moderator/**`,
`docs/poderator-dashboard/CLAUDE.md`, `docs/PRD-moderator-dashboard.md`.

---

# Track C — The Organizer (admin / owner)

Roles are granted in the database (`participant_roles`) — never self-serve,
never from an email allowlist.

**The cycle-running loop:**

1. **Create the cycle** and set the six window pairs in `cycle_config`
   (`/admin/cycles/{id}`), which `syncPhasesFromConfig` mirrors into
   `cycle_phases`.
2. **Recruit** — invitations (`/admin/invitations`), announcements,
   weekly messages, custom tasks that land in every member's queue.
3. **Advance phases** — `POST /api/cycles/{id}/advance-phase`, finalize votes,
   watch the funnel.
4. **Watch the people** — `/admin/people`, `/admin/participants`,
   `/admin/explore` (entity explorer + exports), `/admin/access`.
5. **Curate the public web** — `/admin/content`, `/admin/stories`,
   `/admin/labs`, `/admin/surveys`, `/admin/feedback`.
6. **Look through a member's eyes** — the simulation feature
   (`POST /api/admin/simulate`) renders the app as that member, with every
   write blocked at the edge (`proxy.ts`).

Owner-only surfaces (`/admin/owner`, the People & Access danger zone) carry
bans, erasure, and role revocation.

**Code:** `app/(dashboard)/admin/**`, `lib/admin/**`, `lib/auth/simulation.ts`.

---

# Side paths, branches and dead ends

| Situation | What the person hits | Where |
|---|---|---|
| Unknown Google account through the **Log in** door | `?error=no_account` — not silently dropped into signup | `app/api/auth/callback/route.ts` |
| Banned email | signed back out, `?error=banned` | `lib/auth/bans.ts` |
| Waitlist-lab member tries to register for a cycle | redirect to `/local-labs` | `cycles/[id]/join/page.tsx` |
| Registration during the pod-forming **dead zone** | "registration is paused, it reopens {date}" | `registrationWindow()` |
| Registration after all windows close | "registration has closed" | same |
| `mode='org'` cycle | invite-only; join ceremony redirects away | `docs/ORG_CYCLES.md` |
| Placeholder name (`Unknown`) | forced through `/profile/edit` first | `app/(dashboard)/layout.tsx` |
| Weekly log overdue | locked to `/dashboard` until filed | same |
| Repeatedly missed logs | warning email → revocation (**cron currently unscheduled**) | `app/api/cron/revocation-check/route.ts` |
| Invited member | invitation fulfils on first sign-in — permissions, enrolment, pod placement | `lib/auth/invitations.ts` |
| Member with no cycle interest | events, library, directory, feed, Learning Log in journal mode | — |

---

# State machines

**Enrollment** (`cycle_enrollments.status`, `lib/enrollment/reconciler.ts`):

```
(none) ──sign the Open Cycle Agreement──▶ registered ──land in an active pod──▶ active
                                              ▲                                  │
                                              └───────leave/lose last pod────────┘
                                                          │
                         inactive ◀──engagement exit (revocation)──┘
                            └──reactivate──▶ re-derived from pod reality
```

`registered` is a **permanent resting state**, not a failure — a committed
member who isn't in an active pod. The reconciler never writes `inactive`;
only an engagement exit does.

**Pod:** `forming → active` (at `pod_min`) `→ inactive / dissolved` (close-out).

**Cycle:** `draft → upcoming → active → closing → closed → archived`, with at
most one active and one upcoming open (HQ) cycle globally.

---

# Automated touchpoints

| When | What | Live? |
|---|---|---|
| Fri 21:00 | Learning-Log window — stamps `log_due_at`, arming the gate | ✅ `vercel.json` |
| Daily 09:00 | Learning-Log reminder email | ✅ |
| Wed 13:00 | Leadership-Log window (org leads) | ✅ |
| Daily 09:00 | Leadership-Log reminder | ✅ |
| Every 6h | Luma events sync | ✅ |
| — | Learning-Log compliance nudge (email) | route exists, **unscheduled** |
| — | Revocation check (warn → revoke) | route exists, **unscheduled** |

**Emails in the journey:** registration confirmation · already-registered ·
invitation · learning-log reminder · learning-log compliance nudge ·
leadership-log reminder · revocation warning (`lib/email/`).

---

# Observations

Things the map surfaces. Recorded as observations, not decisions.

1. **The Local Lab fork is the funnel's sharpest edge.** A waitlist choice
   produces a complete account that silently cannot do the main thing. The
   member finds out later, at a redirect, not at the moment of choosing.
2. **Two commitment moments, far apart.** The Participant Agreement (signup)
   and the Open Cycle Agreement (ceremony) are both scroll-gated, versioned
   signatures. Deliberate — but a member who signs up outside a registration
   window meets the second one days or weeks later, with the dashboard's
   register task as the only thread connecting them.
3. **"Registered" has no equivalent of pod life.** Between the ceremony and
   pod formation a member is committed but has almost nothing to *do* — the
   baseline log and the first log are the only tasks, and the weekly ritual
   (the thing that builds the habit) doesn't start until they're in a pod.
4. **Six windows, one queue.** The dashboard task queue is the only place
   that reliably tells a member a window is open. Miss the queue (or dismiss
   the card — window tasks are dismissible) and the window can pass unseen.
5. **Pod resource fields are read-only in the app.** `pods.slack_channel_id`,
   `drive_folder_id`, `github_repo_url` are displayed but never written by
   any route; `lib/integrations/` holds only `luma.ts`. The "resources
   provision at activation" invariant described in the architecture notes is
   not implemented in code — those links are populated out of band.
6. **The revocation ladder is written but not running.** The warn → revoke
   cron is complete and unscheduled, so the compliance story currently ends
   at a nudge and the hard weekly lock.
7. **Role intents are collected but lightly used.** Volunteer and Mentor
   intents are stored at signup; neither has a surface of its own yet, so
   those two funnel branches converge on the same dashboard as everyone else.
8. **Pulse checks and Learning Logs coexist.** The Learning Log replaced the
   pulse timer as the gate, but `/pulse-check` and the Poderator's
   pulse-insights surfaces are still live — two reflection rituals, one of
   which no longer gates anything.

---

*Generated 2026-09-11 from `main` @ 226445a. When a stage changes, update the
stage and the code refs together — this map is only useful while it's true.*
