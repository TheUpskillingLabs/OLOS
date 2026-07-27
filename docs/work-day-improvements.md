# Work days — running improvements list

**Status:** Living doc / proto-requirements · started 2026-07-26 · owner: Ann Marie

The home for feedback and improvement ideas about our **in-person work days** —
the Sensemaking Sprint and the Hackathon. This is the *events* counterpart to
[`feedback-running-list.md`](feedback-running-list.md) (which tracks feedback on
the app itself). Entries here are deliberately rough: observations from running
the days, ideas for the next one, and open questions.

**Why this lives in the repo:** the work days are the manual, in-person
prototype of what OLOS digitizes. The Sensemaking Sprint is the physical version
of the member journey in [`SENSEMAKING_FLOW.md`](SENSEMAKING_FLOW.md)
(observations → patterns → paradox → frame), and the Hackathon maps to the Build
Cycle's solution/build phases. What we learn running these days by hand is
proto-requirements for the product. When an item here matures into something
buildable, graduate it: app-scoped fixes go to
[`feedback-running-list.md`](feedback-running-list.md), fuller specs get a doc in
[`requirements/`](requirements/).

## The events

| Event | Last run | Next run | Shape |
|---|---|---|---|
| **Sensemaking Sprint** | 2026-07-25, 10:30–17:30, I4DI (1834 Connecticut Ave NW, DC) — hosted by Brendan Whitaker, Ann Marie Guzzi, Sandra Moscoso ([Luma](https://luma.com/the-bcr0)) | TBD | One day: collect observations, map stakeholders, surface patterns, uncover paradoxes. "The hardest part isn't solving the problem — it's figuring out what the problem actually is." |
| **Hackathon** ("Idea to Prototype") | 2026-05-16, St Mark's Capitol Hill, DC ([Luma](https://luma.com/c02-podsprint)) | **2026-08-13, 09:00–18:00, Main branch** — per `anchor-events.ts` ("Hackathon — the Frame Sprint"). **Not on the hosts' Google Calendar.** | One day: idea → working prototype, with real teammates, real tools, and a plan to test what you build. No prior AI experience required. |

### Where the days sit in the cycle calendar

From [`lib/cycles/anchor-events.ts`](../lib/cycles/anchor-events.ts) — the six
anchor events, currently a **hardcoded interim constant** until the Luma events
cache serves them from the DB:

| Date | Event | Relevance |
|---|---|---|
| Jul 14 | Kickoff Summit | |
| **Jul 25** | **"Problem Sprint"** | The day just run — but see the drift note below |
| **Aug 11** | **Meet the Pods** (18:00–20:30) | `phase_2_start` — also opens `pod_active_join` |
| **Aug 13** | **Hackathon — the Frame Sprint** (09:00–18:00) | **Two days after Meet the Pods** (#17) |
| Sep 8 | Meet the Projects | `phase_3_start` |
| Oct 13 | Showcase Summit | |

**Two drifts worth fixing.** (1) The Jul 25 anchor event is named **"Problem
Sprint"** and runs **09:00–13:00**, with a code comment describing "problem
statements 9am–12pm, voting 12–1pm, pod forming opens 1pm." The event we actually
ran was the **Sensemaking Sprint, 10:30–17:30**. The app and reality disagree on
both the name and four hours of the day. (2) The **Aug 13 hackathon isn't on the
hosts' Google Calendar** — given anchor events are a hardcoded constant, it's
worth confirming the room and the Luma page actually exist.

Note the upside of (1): the Cycle 3 schedule **already assumed voting opens the
same day as the sprint**. #11 isn't a new idea, it's a plan that already existed
in [`requirements/cycle-timeline.md`](requirements/cycle-timeline.md) and didn't
survive contact with the day.

## Cycle gates — what each day has to land

The work days aren't just events, they're **gate transitions**. Each day is
where a phase window opens or closes, so the run-of-show and the cycle schedule
are the same design problem. The spine is
`problem_statement → voting → pod_forming → solution_proposal → solution_voting
→ project_registration` (`PhaseKey` in
[`lib/cycles/schedule.ts`](../lib/cycles/schedule.ts)), plus the `pod_active_join`
overlay.

| Day / moment | Gate movement | Target state |
|---|---|---|
| **Sensemaking Sprint — late afternoon** | `problem_statement_close` | Statements submitted (#6) |
| **…then +15–20 min** | `voting_open` | Reviewed, ballot live (#12) |
| **Sprint happy hour** | *(voting live)* | Participants **market their statements** to each other (#11) |
| **~1 week later** | `voting_close` → finalize | Tally frozen, pods created |
| **+1 full week after that** | `pod_registration_close` (`pod_forming`) | Pods culled to the **viable** ones (#13) |
| **Hackathon** | `pod_registration_close` if not already · `solution_proposal_open` | Last call to join a pod; proposals opened but **left to bake** (#14) |

### Gate mechanics — what the code does today

Four things to know before building a day around these flips:

- **`advance-phase` can't do this.** `POST /api/cycles/[id]/advance-phase`
  hardcodes a **24-hour window per phase** and is explicitly a `testing:use`
  tool ([`requirements/cycle-timeline.md`](requirements/cycle-timeline.md)). An
  intra-day flip has to go through the **admin schedule PATCH** with real
  timestamps. Don't plan to press the Dev-tab Advance button at 4pm.
- **Timezone risk is real and day-of.** Window columns are naive
  `TIMESTAMP` with no timezone, and `cycle-timeline.md` records that "an admin
  entering DC-local times is silently off by 4–5 hours." Stage 1 landed a
  tz-aware read model (`cycle_phases` + the `lab-time.ts` convention) but the
  **write** path is still the naive `cycle_config` columns. Two precise
  intra-day flips during a live event is exactly where this bites. **Rehearse
  the flip on a test cycle before the day.**
- **A gap between phases is expressible.** Windows are independent
  `_open`/`_close` pairs, so leaving 15–20 minutes of dead air between
  `problem_statement_close` and `voting_open` needs no new schema — just two
  timestamps.
- **There is no review workflow to put in that gap.** See #12 — this is the
  one real product gap the sprint flow surfaces.

## What worked — carry these forward

Two things earned their place on 2026-07-25 and should survive any redesign:

- **The gating.** Forcing people into Slack, into GitHub, and into an LLM
  *early and as a precondition to continuing* worked. People who'd have
  deferred those setup steps forever did them in the room, with help nearby.
  Don't soften this into "here are some tools you might want."
- **Forming groups.** Group formation did real work — both for the thinking and
  for the room. The change we want is **more of it, not less** (see #8).

## How to add an entry

Add a row (next number, today's date), and a `### N — Title (date)` section
under **Details** if there's more to say. Cover:

1. **What you observed** — a concrete moment from the day, or a concrete idea
   for the next one.
2. **Which event / where in the day** — sensemaking, hackathon, or both; and
   which block (arrival, group formation, the exercise, share-out, wrap-up…).
3. **Needs more thought?** — clear-cut change, or needs design/facilitation
   judgement first.
4. **Product-relevant?** — does this imply something OLOS should eventually
   support (a proto-requirement), or is it purely event ops?
5. **Who's submitting.**

Status legend: 🆕 new · 🧭 needs a decision · ✅ adopted for next run · ➡️ graduated (link to where) · ❌ won't-do

| # | Date | Event | Feedback / idea | Product? | Status |
|---|------|-------|-----------------|----------|--------|
| 1 | 2026-07-26 | Sensemaking | **Higher-energy start — get people physically moving.** Open with an index-card pass-and-rate (per the Library of Congress event) instead of a seated intro. Bubbles up the room's top pain. | partly | 🆕 |
| 2 | 2026-07-26 | Sensemaking | **Teach the method through a fun/silly worked example.** Frame innovation + survey results + the problematizer land better on an absurd example — helps people grok the definitions and phases, and take it less seriously. Example still to be picked. | partly | 🧭 |
| 3 | 2026-07-26 | Both | **A guide to the two days inside OLOS — a facilitator view and a participant view.** Today the run-of-show lives outside the product entirely. | **yes** | 🆕 |
| 4 | 2026-07-26 | Both | **Mentors/facilitators need a real briefing:** outline of the day, the outcome each block is driving at, and how to help someone reach it. It was hard to plug in and help — too much lived in Brendan's and Rachael's heads. | **yes** | 🆕 |
| 5 | 2026-07-26 | Both | **Pre-work, and an intro-to-GitHub workshop before the next day.** Cover *why* GitHub matters for AI work and collaboration, not just the mechanics. Run it virtually to maximize attendance. | partly | 🆕 |
| 6 | 2026-07-26 | Sensemaking | **Definition of done: problem statements submitted by end of day.** We didn't get there. Buy the time back by pre-loading rather than by rushing the room. | **yes** | 🆕 |
| 7 | 2026-07-26 | Both | **Keep the gating** (Slack → GitHub → LLM, early and required). It worked. | **yes** | ✅ |
| 8 | 2026-07-26 | Sensemaking | **Form groups twice**, not once, so people meet more of the room. | partly | ✅ |
| 9 | 2026-07-26 | Both | **More rah-rah that the cycle theme matters.** We had some; it needs to be louder and earlier. | partly | 🆕 |
| 10 | 2026-07-26 | Both | **Volunteers assigned to known stuck-points**, so a stuck participant gets someone who already knows that step. | partly | 🆕 |
| 11 | 2026-07-26 | Sensemaking | **Sprint must exit with statements submitted and, ideally, voting already open** — so the happy hour becomes participants marketing their statements to each other. | **yes** | 🆕 |
| 12 | 2026-07-26 | Sensemaking | **15–20 min review window before the ballot publishes.** The time gap is easy; there's **no review/publish workflow** for problem statements to put in it. | **yes** | 🧭 |
| 13 | 2026-07-26 | Post-sprint | **A full week from `voting_close` to culling pods** down to the viable ones. Needs a definition of "viable" — the docs currently disagree. | **yes** | 🧭 |
| 14 | 2026-07-26 | Hackathon | **Hackathon gates:** close pod registration, open solution proposals — but don't push for same-day submission, proposals need time to bake. | **yes** | 🆕 |
| 15 | 2026-07-26 | Hackathon | **Shape the day around play, prototyping, and getting feedback** — not around a single end-of-day showcase. | partly | 🆕 |
| 16 | 2026-07-26 | Hackathon | **Newcomers need to saturate in the problem space** before they build anything. | **yes** | 🆕 |
| 17 | 2026-07-26 | Hackathon | **Pod briefs as lightning talks, reusing the Meet the Pods presentations.** Meet the Pods is Aug 11 and the hackathon is Aug 13 — the material is two days old. | **yes** | ✅ |

## Details

### 1 — Higher-energy start (2026-07-26)

The day needs to open with people **out of their chairs**. The model is the
index-card activity from the Library of Congress event:

1. Everyone writes **one idea per index card** — a pain, a frustration, a thing
   that's stuck.
2. **Walk and pass** — cards circulate to someone new.
3. **Rate** the card you're holding.
4. **Walk and pass, rate again** — repeat.

The ratings aggregate, and the room's **top pain bubbles up** without anyone
facilitating a discussion or a single loud voice steering it.

Two reasons this is worth more than its energy value:

- **The output is usable.** What surfaces is a rated, room-generated list of
  pains — candidate raw material for the day's problem statements (#6), not
  just an icebreaker that gets thrown away.
- **It earns the theme framing.** The pains come *from the room*, so the
  "this theme matters" case (#9) can be made with the room's own cards instead
  of a hosted pitch. That's a stronger on-ramp than a slide.

**Open:** does the card pass feed the actual cycle theme, or stay generic to
warm people up? If it feeds the theme, the prompt on the card needs to be
theme-scoped — which risks narrowing people before they've heard the framing.

### 2 — Teach the method with a silly worked example (2026-07-26)

After the opener, the teaching block covers **frame innovation** (Kees Dorst —
see [`SENSEMAKING_FLOW.md`](SENSEMAKING_FLOW.md) §7 and
[`ORTELIUS_KNOWLEDGE_GRAPH.md`](ORTELIUS_KNOWLEDGE_GRAPH.md) §on lineage), the
**survey results**, and the **problematizer**. The ask: run it on a deliberately
absurd example so people (a) grok the definitions and the phase transitions and
(b) hold the whole thing more lightly.

**The design constraint on the example:** it has to survive the *entire arc*, not
just the first step. If it works for "observation" and "pattern" but collapses at
problematization, people learn the vocabulary and miss the transitions — which
are the actual hard part. So the example needs a **real paradox** (competing
truths, a persistent tension), not merely a puzzle with a clever answer. It also
needs plausible **prior attempts**, since that archaeology step is the one people
skip.

Candidates, best first:

- **The office fridge.** Everyone wants it clean; nobody throws anything out.
  *Paradox:* the impulse that makes it disgusting (saving food you fully intend
  to eat) is the same one that makes people furious when it's purged — your
  leftovers are lunch, mine are trash. *Stakeholders:* whoever ends up cleaning
  it, the person with the three-week yogurt, the office manager, the health
  inspector. *Prior attempts:* date labels, Friday-purge signs, passive-aggressive
  notes — all failed, which is the point. *Reframe:* not a cleanliness problem,
  a property-rights problem. This one has the richest stakeholder map and the
  most real prior attempts.
- **Planning a birthday dinner in a 12-person group chat.** *Paradox:* everyone
  is being accommodating, and universal accommodation makes a decision
  impossible — politeness is the blocker. *Reframe:* not an information problem
  (they already have everyone's preferences), a permission-to-decide problem.
  Good because the reframe is genuinely surprising.
- **Loading the dishwasher "wrong."** *Paradox:* the person who cares most does
  it least, because they redo everyone's work, so everyone stops trying.
  *Reframe:* not a technique problem, an incentive problem. Crisp, but only two
  stakeholders — better as a 5-minute warm-up than the spine of the block.

**The tension to resolve before this ships.** #2 says *take it less seriously*
and #9 says *make people feel the theme matters*. Those pull against each other
and will undercut each other if they land in the same breath. Suggested split:
**silly for the method, dead serious for the theme**, in separate blocks — teach
the machinery on the fridge, then turn to the real theme with the room's own
index cards. The silliness is a scaffold for the vocabulary, explicitly dropped
before the real work starts.

### 3 — A two-day guide in OLOS: facilitator + participant views (2026-07-26)

Right now the run-of-show for a work day lives in a doc, a Luma page, and the
hosts' heads. The proposal is that **OLOS itself carries the guide**, in two
views over the same underlying day:

- **Participant view** — where we are in the day, what this block is for, what
  you're expected to walk out of it with, and the app action it maps to
  (submit an observation, join a group, submit a problem statement).
- **Facilitator view** — the same timeline, plus outcomes, timings, and how to
  unstick someone (#4).

**This crosses a line the product currently draws on purpose.** The Poderator
orientation card (`app/(dashboard)/moderator/orientation-card.tsx`) tells
poderators in as many words: *"OLOS is the practice record and the formation
pipeline… Luma runs events. Slack is where people talk."* Putting a run-of-show
in OLOS moves events partly in-scope. That may well be right — the work days
*are* the phases, so the app arguably should know what day it is — but it should
be a **deliberate decision**, not a side effect of building a nice page.

**Precedent worth reusing:** that same orientation card is the existing pattern
for in-app role guidance (dismissible, persisted per user via
`moderator_ui_state.tooltip_seen`), and its philosophy — *"unblock people, not
manage them… grade nothing"* — is exactly the register a facilitator briefing
should be written in.

**Open:** does the facilitator view reuse the Poderator role, or is
facilitator/mentor a distinct role? Note the naming rule if this lands in code:
user-facing **Poderator**, internal `moderator`
([`docs/poderator-dashboard/CLAUDE.md`](poderator-dashboard/CLAUDE.md)) — a new
"facilitator" role needs its own decision, not an alias.

### 4 — Mentors and facilitators need a briefing (2026-07-26)

**Observed:** it was hard for a willing mentor to plug in and actually help. The
day's structure, the point of each exercise, and the ways to help someone
through it lived largely in Brendan's and Rachael's heads. A mentor who wanted
to be useful had to reverse-engineer the day in real time.

**What a briefing needs to carry**, per block:

- The **outcome** — what a participant should have when this block ends.
- The **stuck-points** — where people predictably stall, and what to say. (These
  are knowable: they're what Brendan and Rachael were repeating all day.)
- The **hand-off** — what the next block assumes is already done.
- **What not to do** — no grading, no solving it for them.

Cheapest version is a one-page printed briefing for the next day. The product
version is the facilitator view in #3. **Do the paper one first** — it's also how
we find out what actually belongs in the app.

### 5 — Pre-work, and a GitHub workshop first (2026-07-26)

Two linked asks:

**An intro-to-GitHub workshop, run before the next work day.** Critically, it
should cover **why GitHub is relevant to AI work and collaboration** — not just
the mechanics of clone/commit/push. People who only get mechanics can follow
steps and still have no idea why they're in there. **Virtual, to maximize
attendance.**

**Pre-work more generally** — deciding what people can and should do *before*
they arrive. This is the main lever on #6: every setup step done at home is
room-time bought back.

**Timing:** the hackathon is the nearest deadline (~mid-August, still
unscheduled), so the workshop wants to land roughly 1–2 weeks ahead of it —
which means picking the hackathon date is the blocking step.

**Open:** does the GitHub workshop gate the *hackathon*, the next *sensemaking
sprint*, or both? It reads as most load-bearing for the hackathon (people are
building), but the sensemaking day already gated people into GitHub (#7), so
both days benefit.

### 6 — Definition of done: problem statements submitted (2026-07-26)

The sensemaking day should **end with problem statements submitted in OLOS.**
That's the artifact the rest of the cycle needs, and it's the clean hand-off
into the phase machine (`problem_statement → voting → …`).

We didn't get there, and the fix is **not** to compress the room's thinking
time. Buy time back by **pre-loading** — which is where this becomes a product
question. Candidates:

- Survey results processed and in the app *before* the day, so the block is
  reading and reacting, not waiting.
- Accounts, Slack, GitHub, and LLM access done as pre-work (#5) rather than
  in-room — though note #7: the gating worked *because* it happened in the room
  with help nearby. Pre-work that silently fails is worse than in-room setup.
  Probably: pre-work with an in-room catch-up lane, not pre-work instead of
  gating.
- Extracts pre-generated for a starting pool, so hypothesizing has something to
  bite on immediately (`SENSEMAKING_FLOW.md` §2 extraction is designed as a
  distributed daily practice — the day shouldn't be where it starts from zero).

**Open:** what's the minimum viable pre-load that makes end-of-day submission
realistic? Worth timing the 2026-07-25 blocks against a target run-of-show to
find where the hours actually went.

### 7 — Keep the gating (2026-07-26)

Forcing people into Slack, into GitHub, and into an LLM early — as a
precondition to continuing rather than a suggestion — was one of the day's
clear wins. Setup that people would defer indefinitely happened, in the room,
with help at hand.

Carry it forward as a **hard requirement**, and note the interaction with #5:
moving setup into pre-work risks throwing this away. See #6 for the likely
resolution (pre-work plus an in-room catch-up lane).

### 8 — Form groups twice (2026-07-26)

Group formation worked. Do it **twice** so people meet more of the room — a
second reshuffle mid-day, so nobody spends the whole day with the first three
people they sat near.

**Open:** does the second grouping re-sort on a different axis (by candidate
paradox, by sector, by role) or just reshuffle? Re-sorting by emerging paradox
would double as the natural bridge into pod formation, which is where the
sensemaking flow is headed anyway.

### 9 — More rah-rah on the cycle theme (2026-07-26)

There was some framing of why the cycle theme matters; it needs to be **louder
and earlier**. People work harder on a problem they believe is worth the day.

Best available material is the room's own output: the index cards from #1 make
the case bottom-up ("here's what this room says is broken") rather than
top-down. And per #2, this block should be **tonally separate** from the silly
teaching example — the method can be held lightly, the theme can't.

### 10 — Volunteers on known stuck-points (2026-07-26)

Rather than generalist floaters, assign volunteers to the **specific steps where
people predictably stall** — GitHub auth, first LLM prompt, getting a statement
into the app — so a stuck person gets someone who has already done that step ten
times that day.

This depends on #4: once the stuck-points are written down, staffing them is
mechanical. Right now they're tacit, so help is improvised.

### 11 — Sprint exits with voting already open (2026-07-26)

The sprint's exit criteria, in order of ambition:

1. **Required:** problem statements submitted (#6).
2. **Ideal:** `voting_open` has flipped **before people leave the room**, so the
   **happy hour is participants marketing their statements to each other.**

That second one is a genuinely good design move — it converts the social half of
the day into cycle work, and it gives people a reason to be able to say their
paradox out loud to a stranger, which is the same muscle the frame work needs.
It also means the happy hour is doing recruitment for pods that don't exist yet.

**Two things to decide, because they're consequences, not details:**

- **It advantages the people in the room.** Anyone who didn't attend arrives to a
  ballot where the in-person crowd has already campaigned. That may be exactly
  what you want (showing up should count for something), but it should be a
  *choice* — and note the ballot is already per-lab filtered, and
  `cycle_config` carries separate `submitter_votes` / `non_submitter_votes`
  budgets, so there are existing levers if you want to soften it.
- **It puts two precise intra-day gate flips inside a live event** — see the
  gate-mechanics warnings above. Rehearse both on a test cycle.

### 12 — The 15–20 minute review gap, and the missing workflow (2026-07-26)

Publishing the ballot needs a **15–20 minute review** between
`problem_statement_close` and `voting_open`. Two separate problems:

**The schedule part is easy.** Windows are independent `_open`/`_close` pairs,
so a 20-minute gap is just two timestamps. Nothing to build.

**The workflow part doesn't exist.** `problem_statements` is
`(id, cycle_id, participant_id, statement_text, created_at)` — there is **no
status, no moderation flag, no draft/published state**
(`supabase/migrations/00001_initial_schema.sql:148`). Consequences:

- The **only** lever for what appears on the ballot is the `voting_open`
  timestamp — all-or-nothing.
- To hold back a single bad statement, an admin's only option is **deleting the
  row**. There's no "needs work," no "hidden," no way to hand it back to the
  author. That's a rough experience for someone who just spent a day on it.
- So "review" today means: read the list, and either accept everything or
  destroy something.

If we want a real review step, the minimum is a status column plus an admin view
that can hold a statement back without deleting it — and ideally a path back to
the author. Worth a `requirements/` doc before anyone builds it.

**A flow fix that costs nothing:** review **continuously as statements come in**,
not in a batch at the end. If 30–40 people submit, 15–20 minutes is under 30
seconds each — a skim, not a review. Reviewing during the submission block leaves
the end-of-day gap covering only late arrivals, which is what that window is
actually sized for. Two reviewers in parallel makes it comfortable.

### 13 — A full week from voting close to culling pods (2026-07-26)

New learning: we need **a full week between `voting_close` and closing pods down
to just the viable ones.** Pods need time to accumulate members before you can
tell which ones are real.

**What the code does today:**

- Pods auto-activate the moment membership hits `pod_min`, inline on registration
  (`app/api/pods/[pod_id]/register/route.ts:165-175`). It's a one-way ratchet —
  **nothing automatically deactivates a pod that never gets there.**
- So culling is a **manual admin sweep** at the end of the week. The override
  route exists (`app/api/admin/pods/[pod_id]/route.ts`) and can also activate a
  pod *below* `pod_min` for a special case.

**The open decision — what does "viable" mean?** The docs disagree:
`cycle_config.pod_min` defaults to **5** (`00001_initial_schema.sql:25`), while
[`SENSEMAKING_FLOW.md`](SENSEMAKING_FLOW.md) §2 says paradoxes must clear a
**12-person floor** to become pods. Those are very different cohorts. Pick one
and make the other follow, because the automatic activation threshold and the
manual cull standard being different numbers is how you end up with pods that
activated themselves and then get killed a week later.

**Scheduling implication — and the cull has no gate.** The week lives inside the
`pod_forming` window, but the cull is **not** `pod_registration_close`: #14 puts
that at the hackathon, weeks later. So "close pods to the viable ones" is a
moment with **no phase boundary behind it** — it's an operational action someone
has to remember to do. Either calendar it as an ops task or give it a marker.

**Where it should land, per the anchor calendar:** *before* **Meet the Pods**
(Aug 11). Meet the Pods is a public presentation, and those presentations become
the hackathon's lightning talks (#17) — so you don't want non-viable pods
presenting, and you don't want to cull a pod two days after it presented itself
to the cohort. That gives the chain:

`voting_close` → **1 week** of pod forming → **cull to viable** → Meet the Pods
(viable pods present) → hackathon (talks reuse those presentations,
`pod_registration_close`).

### 14 — Hackathon gates (2026-07-26)

At the hackathon:

- **Close pod registration** (`pod_registration_close`, the `pod_forming`
  phase).
- **Open solution proposals** (`solution_proposal_open`) — but **don't push for
  same-day submission.** Proposals need time to bake. The day seeds them; it
  doesn't harvest them.

**Wording to confirm:** the note said "open problem submission," but problem
statements were submitted back at the sprint, and the phase that follows
`pod_forming` is `solution_proposal`. Reading it as **solution proposals** —
flag if that's wrong, since it changes the day's shape.

**Closing pod registration at the hackathon is a feature, not just a gate.** It
makes the hackathon the **last call to join a pod**, which is a real reason to
show up — worth saying so in the Luma copy.

**As currently scheduled, though, it isn't a last call at all.**
`pod_active_join` is a separate overlay window derived from `phase_2_start` →
`project_registration_close` ([`lib/cycles/schedule.ts`](../lib/cycles/schedule.ts)),
and it exists precisely so joining doesn't die when initial registration closes
([`requirements/pod-registration.md`](requirements/pod-registration.md)).
`phase_2_start` is **Meet the Pods, Aug 11** — so active-join opens **two days
before the hackathon** and runs on until project registration closes. Closing
`pod_forming` on Aug 13 shuts a window that active-join has already superseded.

So decide which you mean: **hard last call** (shut both) or **soft** (the current
schedule — `pod_forming` closes, active-join carries on). Either is defensible,
but **"last call" in the Luma copy is only honest in the hard version**, and the
soft version means the hackathon gate is close to symbolic.

### 15 — Rough shape of the hackathon: play, prototype, feedback (2026-07-26)

The day should push people to **play, prototype, and get feedback** — and the
third one is where a hackathon usually fails, because feedback gets deferred to
an end-of-day showcase, which is far too late to act on.

The structural fix is **two feedback rounds**: one mid-day, while there's still
time to change what you're building, and one at the close. The mid-day round is
the one that teaches; the closing one is the one that celebrates. Compressing
them into a single showcase loses the teaching.

For **play**: the norm to set explicitly is *make something bad, quickly.* Newer
participants default to planning because a bad prototype feels like failure —
naming "bad and fast" as the goal gives them permission. This is the hackathon's
version of #2's "take it less seriously."

See the sketch below for a first pass at the full day.

### 16 — Newcomers have to saturate in the problem space first (2026-07-26)

A newcomer who shows up at the hackathon has missed the sensemaking work
entirely. If they start building immediately they'll build something generic,
because they haven't sat with the problem. They need to **saturate** first.

**The cheap and elegant version: have the sensemaking veterans brief the
newcomers.** It costs no host time, transfers real context rather than a summary,
and gives veterans a reason to articulate their paradox to someone who hasn't
heard it — which is the same marketing muscle #11 builds at the happy hour, and
a genuine test of whether the frame is comprehensible to an outsider.

**The product version** is the participant view (#3) carrying a per-pod "get up
to speed" reading path: the winning statement, its `problematization`, the
evidence behind it, and what the pod has decided so far. That's largely data
OLOS already holds — it's a view, not new capture.

**Open:** is saturation pre-work (#5), a first block of the day, or both?
Pre-work reaches only the people who do pre-work, and newcomers are the least
likely to. Probably both, with the in-room version assumed to be the real one.

**Delivery mechanism decided — see #17.**

### 17 — Pod briefs as lightning talks (2026-07-26)

**Adopted.** The pod briefs from #16 run as **lightning talks**, built on each
pod's **Meet the Pods presentation**.

The calendar makes this better than it first looks: **Meet the Pods is Aug 11 and
the hackathon is Aug 13** ([`lib/cycles/anchor-events.ts`](../lib/cycles/anchor-events.ts)).
The presentations are **two days old** — already made, already rehearsed in front
of an audience, still fresh. The marginal cost to a pod is close to zero, which
is what makes this stick where "please brief the newcomers" wouldn't.

Second-order benefits worth naming, because they're the real payoff:

- **It gives Meet the Pods a second job.** Right now that presentation is
  consumed once and discarded. Knowing it gets reused 48 hours later as the
  onboarding material for people joining your pod raises the incentive to make
  it good.
- **Lightning format forces compression.** A pod that can't explain its paradox
  in three minutes doesn't understand it yet — so the talks double as a
  diagnostic for the hosts on which pods are actually clear.
- **It's the same muscle as #11's happy-hour marketing** — pitching your problem
  to someone who hasn't heard it, now with the pod as the unit instead of the
  individual.

**Product implication:** if the presentation is the reusable artifact, OLOS
should hold it. There's nowhere to attach a pod's Meet the Pods deck today, so
the participant view (#3) can't surface "get up to speed on your pod" without it.
Small ask — a link or file on the pod — but it's the thing that turns a one-off
event into the durable saturation path #16 wants.

**Open:** do all pods talk, or only the ones taking newcomers? All pods is better
for cross-pollination and gives the diagnostic above; only-recruiting-pods is
faster and keeps the newcomers' attention on real choices.

## Sketch: shape of the next sensemaking day

Derived from the entries above — **a proposal to react to, not a decision.**

| Block | What happens | Gate | From |
|---|---|---|---|
| **Move** | Index-card pass-and-rate. Everyone on their feet; top pains bubble up. | | #1 |
| **Why this** | The theme case, made with the room's own cards. Serious register. | | #9, #1 |
| **Gate** | Slack → GitHub → LLM, required to proceed. Catch-up lane for anyone whose pre-work didn't take. | | #7, #5 |
| **Learn** | Frame innovation, survey results, the problematizer — taught on the silly example. Light register, explicitly dropped at the end. | | #2 |
| **Group 1** | First grouping. | | #8 |
| **Work** | Onto the real theme, over pre-loaded survey results. | | #6 |
| **Group 2** | Reshuffle — possibly re-sorted by emerging paradox. | | #8 |
| **Work** | Sharpen toward statements. | | #6 |
| **Submit** | Problem statements into OLOS. **Reviewers read them as they land**, not in a batch. | `problem_statement_close` | #6, #12 |
| **Review** | 15–20 min. Late arrivals only, if the continuous review kept up. | | #12 |
| **Publish** | Ballot goes live while everyone is still in the room. | `voting_open` | #11 |
| **Happy hour** | Participants market their statements to each other. Voting is live. | | #11 |

Volunteers staffed against each block's known stuck-points (#10); mentors
briefed on the outcome of each block (#4).

**The critical-path risk** is the tail: three things (submit, review, publish)
have to happen while people are still present and still have energy. If the day
runs long, the first thing sacrificed is the review — which is also the thing
with no product support behind it (#12). Budget the tail backwards from the happy
hour, not forwards from the morning.

## Sketch: rough shape of the hackathon

First pass, from #14–#16 — **the thinnest of the two sketches**, and the one that
needs your read most.

| Block | What happens | Gate | From |
|---|---|---|---|
| **Saturate** | **Pod lightning talks**, built on the Meet the Pods decks from two days earlier. Newcomers ask the naive questions. | | #16, #17 |
| **Last call** | Pod registration closes — anyone not in a pod picks one now. | `pod_registration_close` | #14 |
| **Set the norm** | *Make something bad, quickly.* Explicit permission to prototype badly. | | #15 |
| **Build** | Play and prototype. Volunteers on stuck-points. | | #15, #10 |
| **Feedback round 1** | Mid-day. Pods demo to each other **while there's still time to change course.** | | #15 |
| **Build** | Act on the feedback. | | #15 |
| **Feedback round 2** | Close of day. Showcase + a plan to test what you built. | | #15 |
| **Seed proposals** | Solution proposals open. Pods start one; nobody is pushed to finish. | `solution_proposal_open` | #14 |

**Open questions on this one:**

- Where do newcomers who join at the hackathon land — an existing pod (which has
  a week of context they don't), or is there a newcomer-heavy pod? Saturation
  (#16) assumes veterans to learn from, which assumes mixed pods.
- Does the mid-day feedback round cross pods (more perspective, more context to
  load) or stay within a pod (faster, narrower)?
- Is there a hard stop where building ends and testing-plan work begins, or does
  the plan-to-test emerge from the closing round?

## Standing questions for every retro

- **The bridge to the product:** did anything produced on paper get lost because
  there was no obvious place to put it in OLOS afterward?
- **The bridge between the two days:** does the sprint's output (paradoxes,
  framed problems) arrive at the hackathon as usable input, or do hackathon
  teams start from scratch?
- **Arrival → productive:** how long from doors-open to everyone actively
  working, and what ate that time?
- **Facilitation load:** what did hosts improvise or repeat-explain? Those are
  candidates for the briefing (#4) or the app (#3).
- **Who struggled:** first-timers vs. returners — where did each stall?
- **What we'd cut:** if the day were an hour shorter, what goes?
