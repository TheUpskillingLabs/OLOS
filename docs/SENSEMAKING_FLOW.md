# The sensemaking flow: from field observation to formed pod

**Status:** Design (on paper) — 2026-07, owner-driven. No code yet. This is the
member-facing engine that feeds **Project Ortelius** (`ORTELIUS_KNOWLEDGE_GRAPH.md`)
and produces a cohort's **pods** (`SECTOR_MODEL.md`). It is the concrete
instantiation of the product's core promise — problems "grounded in data, not
vibes." Read `ORTELIUS_KNOWLEDGE_GRAPH.md` for the deep graph/ontology; this doc
is *how a member moves through it*, and the intake that populates it.

---

## 1. The one rule: scaffold up from dead-simple

The theory behind this — Kees Dorst's **Frame Innovation**, the **Community
Capitals Framework (CCF)**, and **Actor-Network Theory (ANT)** (see §7) — is the
**ceiling, not the floor.** A first-timer sees exactly one thing: *a hunch, and
the evidence for or against it.* Everything richer is added later, by promotion
and optional tags, never by rework.

**The additive invariant.** Complexity only ever arrives three ways:
1. **Promote a node's stage** — `hypothesis → theme → frame → situation`.
2. **Attach optional tags** — capital, actant, evidence-type, OPP/regime (all nullable).
3. **Draw more edges.**

If a feature would require *migrating what the simple tool wrote*, it's designed wrong.

**Two tiers of storage carry this.** The **personal canvas**
(`sensemaking_sessions.state` JSON — forgiving, private) is where the simple tool
lives. The **relational sector graph** (`asset_links` + nodes — accreted) is
where promoted, shared artifacts accumulate. The member stays simple; the graph
gets complex *behind them* as many canvases pool. Complexity is **emergent, not
imposed** — which is itself the complex-adaptive-systems story.

---

## 2. The member journey: registration → Paradox Sprint

| Stage | What the member does | What's happening underneath |
|---|---|---|
| **0 · Register** | joins the cohort | if it's the *upcoming* cohort, they land on the sector's accumulated Ortelius context + the live field survey as starting material (`SECTOR_MODEL.md` early-access) |
| **1 · Distribute** | shares the field survey out into the field | bottom-up evidence at scale — the bedrock (§3). Account-free public link; nudged (contribution is visible). Never really stops. |
| **2 · Extract** *(daily, ~15 min)* | runs an app-provided prompt in their own LLM, uploads the result; also uploads literature/sources | raw responses → discrete **extract** cards. AI-assisted but **never in-app** (§4). Work spread across all participants. |
| **3 · Swipe** | tinder-swipes extracts, signal vs. noise | collective swiping → the **community-corroborated pool** everyone sees (§5, tier 1). *No hypothesis yet.* |
| **4 · Hypothesize** | builds problem concepts on the canvas over the shared pool | draws `supports / complicates / refutes` edges (reused swipe: right / up / left). Peers **second** the connections that matter (§5, tier 2). |
| **5 · Paradox Sprint** | merges into the shared canvas, clusters, seconds, votes | personal canvases pool → **cluster** into candidate paradoxes → **vote** → winners that clear the **12-person floor** become **pods** (§6). |

Beyond the sprint, for context: **Frame Sprint** (the pod takes its cluster as a
*starting point* — builds context, maps the field, sharpens the paradox into a
frame/situation) → **Proposal** (must name a real **problem owner**, §6).

The shape is deliberate: **forgiving at the start, demanding at the end.** You
hypothesize freely from day one; you can't propose an intervention until you can
say who it's for and what paradox it addresses.

---

## 3. The field survey — the bedrock

Everything rests on a **widely distributed field survey**. Without real
observations at scale, "hypothesis mapped to evidence" collapses back into vibes.
So **distribution is a first-class design problem, not a form** — the survey must
reach beyond the cohort into the field itself (public, account-free, shareable),
and it's the **critical path**: the evidence layer must exist before the canvas
has anything to bite on.

**The instrument (from the live Civics & Elections Google Form) → schema.** One
`field_surveys` row per sector/cohort; each observation is a `survey_responses`
row. Note how the instrument is already theory-native: the prompt seeks a
*paradox* ("stuck, broken… no matter what people try"), the prior-attempts field
is *archaeology*, and "your experience" is *standpoint* (evidence weight / what
kind of actant is speaking).

| Survey field | Column | Notes |
|---|---|---|
| survey identity + intro copy | `field_surveys(title, problem_domain, about, share_slug, status, allow_anonymous)` | the public "about" already promises an **open-source insights repository** = Ortelius, to the public |
| **Consent to Participation** * | `consent_participation` BOOL + `consent_version` | required; gates submission; keep the exact wording (legal basis for sharing with participants) |
| **What are you observing…** * | `observation` TEXT NOT NULL | the core evidence body; the source every `extract` derives from. No title — atomization happens at the extract layer |
| **What is your experience?** | `standpoint` TEXT[] | multi-select, structured (work-in-field / affected / tried-to-fix / research / pay-attention / other) — feeds evidence weighting |
| **How much does this matter?** (1–5) | `salience` SMALLINT NULL | intensity |
| **Has anyone tried before?** | `prior_attempts` TEXT NULL | archaeology |
| **Can participants follow up?** | `contactable` BOOL | a **separate, second** consent — contact ≠ participation |
| Name / Email / Phone | `submitter_name/email/phone` NULL | anonymous unless provided |
| **Mentor interest?** | `mentor_interest` BOOL | a recruiting **side-channel** — a "yes" + contact routes into the mentor pipeline |
| *(anti-abuse)* | `participant_id` NULL · `ip_hash` · `moderation_status` | nullable `participant_id` = the anonymous public path (`/s/[share_slug]`) |

**Two evidence origins, so provenance is real:** `survey_response` (field,
bottom-up, at scale) **and** `source` (uploaded literature/citation, carrying its
URL). Both feed `extract`s; every extract traces back to its origin. This closes
the Ortelius `source_url`-has-no-producer gap — uploaded sources are its producer.

**Two-tier consent + anonymity stay intact.** Participation consent is required
and gates submission; contact consent is optional and separate. Anonymous by
default. (The retention/scrub policy for `participant_id IS NULL` submissions is a
prerequisite before `allow_anonymous` ships — Ortelius gap #7.)

---

## 4. Extraction: AI-assisted, never in-app

OLOS runs **no in-app LLM** (matches the existing Poderator copy-to-clipboard
pattern and the governance rule). Extraction is the **copy-prompt / bring-your-own-LLM / upload-result** loop:

1. The app builds a **deterministic prompt** over a *subset* of survey responses.
2. The member runs it in their **own** LLM.
3. The member **uploads the resulting file** (the extracted insights) back into the app.

Subsets are **spread across all participants** (~15 min/day) — extraction becomes
a distributed daily practice, a natural neighbour to the daily-cadence rhythm.

**Why it matters architecturally:** because OLOS itself never calls a model, this
**sidesteps the governance gate (#11)** for the extraction step. (Provenance +
consent still ride along — the uploaded output traces to consented responses; the
LLM was the participant's own tool.)

---

## 5. Two tiers of social validation

The graph self-prioritizes **bottom-up**, with no central authority — the same
mechanic applied at two layers:

- **Tier 1 — Swipe (extract corroboration).** Collective swiping decides which
  extracts rise into the **shared pool everyone sees.** Crowd-curation of
  evidence; solves the scale problem the wide survey creates (you can't read a
  thousand responses as a wall, but you can swipe).
- **Tier 2 — Second (edge corroboration).** Anyone authors a connection (a
  `supports/complicates/refutes` edge, a cluster grouping, an actant link); it
  starts as one person's assertion and **gains weight as others *second* it.**

Both are **ANT enrolment made literal** — the strength of an association is the
size of the coalition behind it. A lone hunch-link stays light; a heavily-seconded
knot of *complications* becomes a strong candidate paradox. Weight is what
promotes artifacts up the Dorst ladder. Data-wise: `edge_endorsements(edge_id,
participant_id)` → `weight = f(count)`; the same shape weights clusters.

*(Naming, owner's call: **"second"** (parliamentary — "I back this", works on a
challenge too), "corroborate", "vouch", or "+1".)*

---

## 6. Formation: cluster → second → vote → pod

The **Paradox Sprint** (renamed from "Problem Sprint" — the paradox is the point;
propagate to `EVENTS` + copy when built) is the merge-and-cluster moment:

1. **Merge** — personal canvases pool into one shared cohort canvas.
2. **Cluster** — participants group hypotheses into candidate paradoxes (proto-pods).
3. **Second + vote** — participants second connections/clusters, then **vote on
   the clusters** (the existing budget-ballot, *retargeted from problem statements
   to clusters* — a repoint, not a rebuild; `votes` / `vote_threshold` / `pod_min`
   / `max_pods` all carry over).
4. **Form** — clusters clearing the threshold **and** the **12-participant
   minimum** (`pod_min = 12`) become **pods**. Few pods by design (a 24–40-person
   cohort → ~2–3 pods), which keeps the sprint legible.

**Nobody loses.** Every cluster — pod or not — is retained as **Ortelius sector
data** (a `cluster` node; `pod.cluster_id` marks the few that became pods; the
rest live on as field context the next cohort inherits). The vote decides where
the cohort spends its *build energy*, not what's valid.

A pod is **born carrying its cluster's hypotheses + their evidence** — an
evidence-grounded paradox from day one, not a blank pod hunting for a problem.

**After formation** (Frame Sprint): the winning cluster is a *starting point* —
the pod builds context, **maps the field** (actants + capitals, §7), and refines
the paradox (the OPP) into a **frame/situation**.

**The proposal gate (the actant forcing-function):** the actant layer is optional
through the early rungs, but a `solution_proposal` **requires ≥1 `actant` of role
`problem_owner`** — a real person/entity in the field, *identified though not
necessarily converted to a client*. You can't propose an intervention until you
can say who it's on behalf of.

---

## 7. The theory underneath (brief; ontology lives in Ortelius)

- **Dorst (Frame Innovation)** gives the **vertical** ascent — the node stages
  (`signal → evidence → pattern → theme → frame → situation`) and the lineage
  `link_kind`. Reframing = re-problematization = a *new obligatory passage point*.
- **CCF** gives the **substance of the edges** — the seven capitals (natural,
  cultural, human, social[bonding/bridging], political, financial, built) as
  **stocks** on actants and **flows** on associations (spiraling up/down).
- **ANT** gives the **ontic layer** — **actants** (human *and* non-human) as a
  node family the sensemaking artifacts are *about*; **associations** = CCF-typed
  translations; the **paradox = an OPP** locking a **regime/paradigm** (CAS
  attractor), which a frame proposes to displace. Dorst's Context→Field steps
  *are* drawing the actor-network boundary.

The three-valence edge (`supports / complicates / refutes`) is where this starts:
**complications are the raw material of the paradox.** Full node/edge/`link_kind`
model: `ORTELIUS_KNOWLEDGE_GRAPH.md` §4.

---

## 8. Build implications

The scaffolding rungs (each a strict superset):

| Rung | Member act | Added under the hood |
|---|---|---|
| **1 — MVP** | hunch + evidence, `supports/complicates/refutes` | `evidence` + `hypothesis` nodes; one signed edge |
| **2** | "these keep pointing at the same thing" | cluster → `theme` (promotion) |
| **3** | "what if we saw it as…" | `frame` + `situation` workbook |
| **4** | tag who/what + what's at stake | `actant` nodes + `capital` tags |
| **5** | (analyst/steering view) | OPP↔regime, cross-cohort sector graph |

**Build order** (bedrock-first, gate-aware):
1. **Field-survey intake** — the public `/s/[slug]` submission page + API +
   `field_surveys`/`survey_responses` tables + admin view. **Gate-free**
   (collecting consented observations is just a form + storage), and it replaces
   the Google Form + unblocks everything downstream. **The first buildable slice.**
2. **Extraction loop** — deterministic prompt + upload (gate-free; §4).
3. **Canvas (Rung 1)** — the hypothesis↔evidence swipe/board (the Triangulator,
   with a *simpler on-ramp* than today — the seven types + tiers become
   progressive reveals, not entry requirements).
4. **Paradox Sprint** — merge/cluster/second/vote/pods (retargets existing voting).
5. **Ortelius graph + AI-assist read surfaces** — **gated by #11.**

**Governance posture:** intake + extraction (BYO-LLM) + the canvas are gate-free;
the AI-assisted read surfaces and *sharing evidence with participants* need the
#11 framework (agreements, data governance, approved-AI-tools, attorney review).

---

## 9. Open questions

1. **Extraction allocation** — how the app assigns response subsets across
   participants (round-robin? by interest? overlap for corroboration?).
2. **Swipe lanes** — intake swipe binary (keep/discard), or a third "this
   complicates things" lane so paradox-seeding starts at intake?
3. **Standpoint weighting** — does `standpoint` (field worker vs. passing
   observer) actually weight an extract's significance, and how?
4. **Losing-cluster redistribution** — do members whose cluster didn't win join a
   pod that did, or do their hypotheses fold in as related evidence? (UX rule, not schema.)
5. **"Second" naming** — final term for the corroboration mechanic.
6. **Standpoint as an option list** vs. free text (structured feeds weighting).
7. **Anonymous retention/scrub** policy before `allow_anonymous` ships (Ortelius gap #7).
