# The pre-registrant — designing the between-cycles experience

| | |
|---|---|
| **Status** | Proposal — the primary persona for Sprint 1 ([`next-sprint.md`](next-sprint.md) workstream A) |
| **Owner** | Product + success team; lead architect for the feature set |
| **Last verified** | 2026-09-15 against `main@226445a`; every "today" claim cites a route, table, or file |
| **Companion** | [`personas-and-journeys.md`](personas-and-journeys.md) §3.2; [`onboarding-curriculum-brief.md`](onboarding-curriculum-brief.md) (the content this experience delivers) |

**The window.** The Summer 2026 cycle ends at the Showcase Summit on **October 13**.
The next cohort's kickoff is not yet scheduled. Everything between those two dates is
the pre-registration window: the period when the organization has the most people
paying attention (a Showcase audience, alumni on a high, survey respondents, waitlists)
and the product does the least for them. The welcome email says "we will email you when
the next cycle opens" — verified: **nothing sends it**.

---

## 1. Who the pre-registrant is

One state, four people. All share: an identity the system knows (account, waitlist row,
RSVP email, or survey contact), **no active enrollment**, and a reason to care.

| Sub-persona | How OLOS knows them | What they want | Risk |
|---|---|---|---|
| **A. The new prospect** | `participants` row, `metro_id` set, no `cycle_enrollments` on the active cycle; maybe `registered` on the `upcoming` one | to understand the commitment and feel welcome before committing | signs up, sees a bare dashboard, forgets |
| **B. The waitlisted** | `metro_waitlist_signups` row; `metro_id NULL`; held out of cycle registration by `requireActiveLabMembership` | to know whether a lab will exist near them and what they can do meanwhile | feels rejected by a gate they don't understand |
| **C. The alum** | `active` or `completed`-in-practice on a `closed`/`archived` cycle; a `project_roles` or `follows` row on a graduated project | to stay connected, contribute, maybe mentor or moderate; to see the next theme | drifts; the org loses its best poderator pipeline |
| **D. The late contributor** | arrived after the Hackathon; `tier='contributor'` semantics (SECTOR_MODEL §4) or just following | to help a project now and be first in line next cycle | told "registration is closed", leaves |

The alum (C) is the highest-value sub-persona and the least served: the Poderator
persona doc says the ideal poderator is a returning upskiller, and the product has no
alumni path at all.

---

## 2. What the product does today (verified)

| Surface | Behavior | File |
|---|---|---|
| Recruiting-cycle resolver | newest `upcoming` open cycle, else the `active` one | `lib/cycle/active.ts` `getRecruitingCycle` |
| Dashboard register task | "Register for {cycle}" with pre-registration copy when the target is `upcoming`; window-gated by the D-10 `registrationWindow()` | `lib/tasks/assemble.ts`, `lib/cycles/schedule.ts` |
| Register state card | `open` / `pre_registered` ("You're all set for the next cycle — it kicks off {date}. We'll open your next steps here when it starts.") / `closed` | `app/components/tasks/cycle-register-card.tsx` |
| Interest + agreement | writes `cycle_enrollments.status='registered'` on an `active` or `upcoming` open cycle; requires active-lab membership | `app/api/cycles/[cycle_id]/interest`, `…/agreement` |
| Welcome email | Slack invite link; cycle CTA when a cycle is active; otherwise a promise to email later | `lib/email/registration-confirmation-template.ts`, `app/api/registrations/funnel/route.ts` |
| Setup checklist | profile, follow someone, Slack row (dismissal-based, not verified) | `lib/tasks/definitions.ts`, dashboard |
| Admin-authored nudges | `custom_tasks` (title, link, window, pinned, dismissible; cycle-scoped or global) and `weekly_messages` (weeks 0–12, shown after a log) | `/admin/tasks`, `/admin/weekly-messages` |
| Public cohort page | name, dates, description, "what you build", sign-in CTA; hidden for `draft` | `app/c/[cycle_id]/page.tsx` |
| Waitlist | join / start a waitlist lab; HQ promotes; no data beyond city | `app/api/labs/waitlist`, `/admin/labs/[slug]` |
| Between-cycle content | `/learning` (events + library + saved), `/stories`, `/events` with Luma RSVP, `/directory` feed | shipped |
| Previous-cycle projects | graduate to `governance='sector'`, remain followable (`follows` on `page_type='project'`); no "seeking contributors" signal | `lib/cycle/closeout.ts`, `00077` |

So the skeleton exists: a resolver, a state, a card, a task, a public page, admin
nudge tools, and content surfaces. What is missing is the **experience between them**
and the **communications that run without a human remembering**.

---

## 3. Behavioral design — the psychology of the gap

The design goal is a person who arrives at kickoff **already committed, already set
up, and already acquainted**. The literature that applies, and how each idea becomes a
product decision:

| Principle | What it says | How the product uses it | What it forbids |
|---|---|---|---|
| **Fogg behavior model** (motivation × ability × prompt) | a behavior happens when all three coincide | keep motivation high with theme and proof; keep ability high by shrinking each step to <5 minutes; deliver the prompt on a schedule keyed to the cycle calendar | asking for a 25-field form at the moment of highest motivation and lowest information (the May PRD's finding) |
| **Commitment and consistency** (small yeses) | small public commitments predict larger ones | the readiness ladder: pick a lab → pre-register → join Slack → post an intro → set a GitHub handle → save the dates → share the survey | one giant "commit" button |
| **Implementation intentions** ("when X, I will Y") | concrete when/where plans double follow-through | every prep step names a day and a place; the `.ics` download exists — make it the first ask after pre-registration | "sometime before kickoff" |
| **Endowed progress** | people finish what looks already started | the ladder starts at 2/8 complete the moment an account exists (account ✓, lab ✓) | a checklist starting at zero |
| **Goal gradient** | effort rises as the goal nears | the drip cadence tightens toward kickoff (T-6w, T-4w, T-2w, T-1w, T-1d) | uniform weekly emails |
| **Social proof, local** | "people like me, near me" | the public cohort page and dashboard show "14 pre-registered in DC · 3 from your neighborhood" once counts pass a floor (never show 1) | vanity leaderboards; showing counts below a privacy floor |
| **Fresh-start effect** | temporal landmarks trigger new behavior | kickoff, the new year, the Showcase are the landmarks; time the biggest asks to them | asking for prep in the flat middle of the gap |
| **Reciprocity, value first** | give before asking | the theme primer, the library, last cycle's projects, the survey insights page are offered *before* any ask | gating all content behind pre-registration |
| **Identity** | people act like who they think they are | copy moves from "you're on the list" to "you're an Upskiller-in-waiting" to "you're an Upskiller"; the directory card appears at pre-registration with a "Joining {cycle}" chip | "user", "lead", "registrant" |
| **Loss aversion, used gently** | closing doors motivate | honest deadlines only: registration closes at the Hackathon (SECTOR_MODEL §4); pods cull one week after voting | fake scarcity, countdown theater |
| **Reduce ambiguity** | uncertainty is the top churn cause in cohort programs | the two lists (§4) answer "what now" and "what next" on every visit | "stay tuned" |

**Constitution constraints** (`DESIGN_INTENT.md`, `SOCIAL_LAYER_ANALYSIS.md` §2) that
bound all of the above: no dark patterns, no engagement-machinery (streaks, badges as
clout, notification hooks), consent-first (`contact_consent` gates every drip email),
trust is earned not default, faltering is process data never a member record.

---

## 4. The two lists — the core of the experience

Every visit to the dashboard during the window shows two lists, in this order:

### 4.1 "Still open this cycle" — engage with what is happening now

Populated from live data, cycle-aware, empty rows hidden:

| Item | Source | For whom |
|---|---|---|
| **Showcase Summit** — RSVP, bring someone | `events` (Luma-synced, kind `Anchor`) | everyone |
| **Meet the projects** — the current cohort's projects, with follow | `projects` on the active cycle; `follows` | everyone; alumni especially |
| **Projects seeking contributors** — graduated projects with an open ask | `projects.governance='sector'` + a new `seeking_contributors` flag or a page post | alumni, late contributors |
| **Upskiller Spotlights** — stories from the cohort | `spotlights` | prospects |
| **Take / share the next field survey** — the bedrock for the next theme | `field_surveys` status `open`; share link | everyone; the single most useful thing a prospect can do |
| **Workshops and events** this month | `events` kind `Workshop` | everyone |
| **Volunteer for the Showcase / mentor a pod day** | `role_intents` capture → admin list | alumni, mentors |

### 4.2 "Get ready for {next cycle}" — the readiness ladder

Ordered, verifiable where possible, each with a time estimate and a why:

| Step | Verified by | Time | Why (copy) |
|---|---|---|---|
| 1. Join a Local Lab (or its waitlist) | `participants.metro_id` / `metro_waitlist_signups` | 1 min | "Your lab is where your pod will form." |
| 2. Pre-register for {cycle} | `cycle_enrollments.status='registered'` on the upcoming cycle | 5 min | "You'll vote on the problems this cohort tackles." |
| 3. Save the key dates | `.ics` download clicked (event row) or manual tick | 1 min | "Kickoff {date} · Sprint {date} · Hackathon {date} · Showcase {date}" |
| 4. Join Slack and say hello in #intros | Slack identity resolution (#189 Part H / ADR-0003 identity table); intro post detection | 10 min | "Everything between sessions happens here." |
| 5. Create or connect a GitHub account | `participants.github_username` set | 10 min | "Where your pod's work will live — and why that matters for AI work." (curriculum M2) |
| 6. Get an AI assistant you can use | self-attested (checkbox), with the BYO-LLM guide | 15 min | "You'll bring your own — here's how to pick one and use it safely." |
| 7. Read the theme primer | resource `viewed`/`saved` (`saved_items`) or manual tick | 15 min | "Why {theme}, and what last cycle learned." |
| 8. Complete your directory card | headline + photo + role intents | 5 min | "So your future pod-mates can find you." |
| 9. Watch the two onboarding videos | manual tick (or `resources` view) | 20 min | curriculum M0/M4 |

Endowed progress: steps 1 and (if the account came through the funnel) 8's photo are
already done. The ladder is **never a wall** — nothing in the product is gated on it,
except that the kickoff-day room is faster for people who did it (the work-day retro's
"keep the gating" applies in the room, not in the app).

---

## 5. Communications — the drip that runs itself

**Channel:** email (Resend), with Slack DM as a second channel once identity exists.
**Gate:** `contact_consent = true`; otherwise only transactional confirmations.
**Idempotency:** `email_log` by `kind` + participant + window (data strategy §6).
**Trigger:** a daily cron reading the upcoming cycle's `cycles.start_at` /
`cycle_events`; each message has a T-minus offset. **Content:** admin-authored
(`/admin/…` form, one row per message: kind, offset, audience, subject, body, CTA).

| Offset | Audience | Message | CTA |
|---|---|---|---|
| on pre-registration | A, C | confirmation + the ladder + `.ics` | save dates |
| T-8w (or Showcase day) | everyone with consent | "What the Summer cohort built" + next theme reveal | RSVP Showcase / read primer |
| T-6w | pre-registered | theme primer + field survey share | share the survey |
| T-4w | pre-registered, not on Slack | Slack + intro (video M1) | join Slack |
| T-3w | pre-registered, no GitHub | "Why GitHub for AI work" (video M2) | connect GitHub |
| T-2w | pre-registered | the Sensemaking Sprint explained; bring an observation | complete ladder |
| T-1w | pre-registered | logistics, who's in your lab (count), what to bring | — |
| T-1d | pre-registered | "See you tomorrow" + the one thing to have done | — |
| T+0 | registered | welcome to the cycle (hand-off to the member experience) | dashboard |
| T-6w, T-2w | **waitlisted (B)** | where their city stands; how to help start a lab | invite neighbors |
| Showcase +1w | **alumni (C)** | contribute / mentor / moderate pathways | pick one |
| any | lapsed pre-registrant (no visit in 21 days) | one gentle "still with us?" — once | — |

Every message is one screen, one CTA, dated, with a real unsubscribe (consent flip).
Copy is owned by the success team; the offsets and audiences are config, not code.

---

## 6. Sub-persona specifics

**B. Waitlisted.** Feedback #11 asked what to collect. Proposal: at waitlist join,
three optional fields — "how many people do you know who'd join", "would you help start
a lab" (yes/maybe/no), "what draws you to the Labs" — plus the same readiness ladder
minus lab-gated steps. The lab-less dashboard shows their city's waitlist count and the
"start a lab" ladder (from `LOCAL_LABS.md`: the promotion path). The gate copy changes
from "join a lab first" to "your city isn't open yet — here's how it opens".

**C. Alumni.** At cycle close-out, every `active` member gets an alumni state: the
projects they can follow or contribute to, the mentor/poderator interest capture (one
question each), the "write up your project" export (#361 promise), and first-in-line
pre-registration for the next cycle. The Poderator persona's ideal profile is *made*
here.

**D. Late contributor.** "Registration closed" becomes "the cohort is full for this
cycle — you can follow projects now and you're first in line for {next cycle}"; the
pre-registration CTA appears the moment an `upcoming` cycle exists.

---

## 7. The feature set (Sprint 1 scope, sized)

| # | Feature | Depends on | Size |
|---|---|---|---|
| A1 | **Between-cycles dashboard mode**: the two lists render when the member has no active enrollment and (an upcoming cycle exists OR the active cycle is past Hackathon) | `lib/tasks` (new task kinds `prepare:*`, `open_now:*`); `CycleRegisterCard` | l |
| A2 | **Readiness ladder** with verified steps 1, 2, 5, 8 and manual ticks for 3, 6, 7, 9; Slack (4) verified once #189 Part H / ADR-0003 identity lands | `task_dismissals` (reuse for ticks), `participants.github_username` | m |
| A3 | **Pre-cycle drip**: `scheduled_messages` table (kind, offset_days, audience, subject, body, cta) + `/admin/messages` form + daily `cron/pre-cycle-messages` writing `email_log` | `email_log` helper (data strategy §6); `cycles.start_at` | l |
| A4 | **Public cohort page v2** (`/c/[cycle_id]`): theme, dates, what you'll build, FAQ (from the marketing corpus), lab picker, social-proof counts above a floor, share buttons; `/build-cycles` reads the DB | `cycle_config.theme_description`, `what_you_build` exist | m |
| A5 | **Alumni + contributor pathways**: `projects.seeking_contributors` flag + DRI toggle on the project page; alumni interest capture (mentor / poderator / volunteer) → `/admin/people` filter and export | `project_roles`, `role_intents` | m |
| A6 | **Waitlist v2**: the three optional fields; lab-less dashboard copy; city count | `metro_waitlist_signups` (+3 columns) | s |
| A7 | **Pipeline metrics**: `v_preregistration_pipeline` + a block on `/admin/insights` | data strategy §5 | s (with C) |
| A8 | **Copy and content**: the ladder copy, drip copy, theme primer, two videos | curriculum brief | success team |

Out of scope for Sprint 1: in-Slack Learning Log (#189 F), mentor profiles/testimonials
(Phase 5), the activity-event spine (Sprint 2; A7 computes from tables until then).

---

## 8. Acceptance criteria (the loop, tested)

1. A member with an account and no active enrollment sees the two lists; every row
   links somewhere real; zero rows hidden; a cohort count never renders below the floor.
2. Pre-registering writes `registered`, sends the confirmation with the ladder and
   `.ics`, and the card flips to `pre_registered` with the ladder's progress visible.
3. Each verified step flips on the underlying fact (not a click) within one page load;
   manual ticks persist across sessions and devices.
4. The drip sends exactly once per (member, kind, cycle), only to `contact_consent =
   true`, and a dry run lists recipients without sending (the compliance-nudge
   pattern).
5. Admins see the pipeline by week-before-kickoff and can export the pre-registered
   list; lab leads see their lab's slice.
6. On kickoff day, the dashboard hands off to the member experience with the ladder's
   remaining steps carried into the setup checklist — nothing is asked twice.
7. Post-kickoff measurement (the metric the sprint is judged on): **share of
   pre-registered members who are `active` within two weeks of kickoff**, and **share
   who completed ≥ 6 ladder steps before kickoff**, compared with the Summer 2026
   cohort's equivalent (registered → active).

---

## 9. Decisions this needs (vault `proposed` notes)

| Decision | Recommendation |
|---|---|
| Next cycle dates and theme announcement date | set before Oct 13 so the Showcase can announce it; the drip is keyed to it |
| Social-proof floor | show counts at ≥ 5 per lab; never show 1–4 |
| Self-attested steps (LLM, primer, videos) — allow manual ticks? | yes; honesty over verification; verified steps get a ✓ mark, manual ones a ○ |
| Drip channel: email only, or Slack DM once identity exists | email in Sprint 1; DM in Sprint 2 behind ADR-0003 |
| Alumni state at close-out: automatic or opt-in | automatic state, opt-in communications (consent already governs) |
| Lapsed-member nudge: once, or never | once, 21 days, then silence |
| Waitlist fields (feedback #11) | the three optional fields above |
