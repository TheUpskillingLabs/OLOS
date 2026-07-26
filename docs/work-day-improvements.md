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
| **Hackathon** ("Idea to Prototype") | 2026-05-16, St Mark's Capitol Hill, DC ([Luma](https://luma.com/c02-podsprint)) | ~mid-Aug 2026 — **a few weeks out, not yet on the calendar** | One day: idea → working prototype, with real teammates, real tools, and a plan to test what you build. No prior AI experience required. |

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

## Sketch: shape of the next sensemaking day

Derived from the entries above — **a proposal to react to, not a decision.**

| Block | What happens | From |
|---|---|---|
| **Move** | Index-card pass-and-rate. Everyone on their feet; top pains bubble up. | #1 |
| **Why this** | The theme case, made with the room's own cards. Serious register. | #9, #1 |
| **Gate** | Slack → GitHub → LLM, required to proceed. Catch-up lane for anyone whose pre-work didn't take. | #7, #5 |
| **Learn** | Frame innovation, survey results, the problematizer — taught on the silly example. Light register, explicitly dropped at the end. | #2 |
| **Group 1** | First grouping. | #8 |
| **Work** | Onto the real theme, over pre-loaded survey results. | #6 |
| **Group 2** | Reshuffle — possibly re-sorted by emerging paradox. | #8 |
| **Work** | Sharpen toward statements. | #6 |
| **Submit** | Problem statements into OLOS. The day's definition of done. | #6 |

Volunteers staffed against each block's known stuck-points (#10); mentors
briefed on the outcome of each block (#4).

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
