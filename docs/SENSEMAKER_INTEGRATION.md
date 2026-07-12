# Bringing the Triangulator into OLOS — the Data Sensemaker integration brief

**Status:** Design + build brief — 2026-07-06, owner-driven. Grounds in
[`SENSEMAKING_FLOW.md`](SENSEMAKING_FLOW.md) (the member-facing engine),
[`ORTELIUS_KNOWLEDGE_GRAPH.md`](ORTELIUS_KNOWLEDGE_GRAPH.md) (the graph the
sensemaking accretes into), and [`ORTELIUS_NORTHSTAR.md`](ORTELIUS_NORTHSTAR.md)
(the frontier ceiling). It is the concrete plan for porting **the Triangulator**
(`github.com/TheUpskillingLabs/triangles`, a single-file Frame-Creation canvas)
into the OLOS experience as the **Data Sensemaker** (roadmap Phase 6).

**Already shipped** (migration `00053`, PRs #183/#184): the public field-survey
intake at `/survey/[slug]` — the evidence bedrock. This brief covers everything
between that survey pool and a mapped Problem Situation.

> **One line.** *The survey collects observations; members run those (plus their
> own uploaded sources) through their own AI with an app-provided prompt to
> produce extracts; the cohort swipes the extracts down to a corroborated pool;
> and only then does the canvas open, where surviving signals are triangulated
> up Dorst's ladder — the whole thing gate-free, server-backed, and reskinned to
> OLOS paper.*

---

## 1. What the Triangulator is (the design read)

A **situation-mapping canvas that disguises a relational database as a fluid
visual tool.** Its own pitch: *"It looks and feels like a fluid visual canvas.
Underneath, it's a relational database engine."* Every interaction is engineered
around one thesis — **the hard part isn't solving, it's seeing** — so the tool
deliberately slows the user down to force intellectual commitment.

**Visual language — ~70% shared DNA with OLOS already:**

| Token | Triangulator | OLOS | 
|---|---|---|
| Typeface | **Geologica** | **Geologica** — identical |
| Primary teal | `#0094a0` | `#0094a0` — **exact** |
| Teal-deep | `#007882` | `#007882` — exact |
| Red | `#ee1c25` | `#e11d2a` — near-identical |
| Dark ink | midnight `#101820` | ink `#00141b` / navy `#03232a` — same family |

The divergences integration must reconcile: the triangulator is a **full-bleed
instrument** (light-grey shell around a **dark canvas**), uses a **radius scale +
pills** (vs. OLOS's single `14px`, no pills), a **200-weight ultralight** body
(vs. OLOS's heavier editorial body), and ships a rich **tier (1–6) + seven
evidence-type** semantic palette OLOS has no equivalent for.

**Interaction model — three paradigms in sequence,** shifting gears as the
cognitive task changes:
1. **Deck** — a marketing-grade horizontal slide deck (intro + concept naming).
2. **Swipe-sort** — a Tinder gesture arena (← noise · signal → · ↑ super), live
   drag feedback, hesitations become data.
3. **Canvas** — a Figma-like infinite pan/zoom board; hover a card → drag from an
   edge-dot to another → the next tier is born at the midpoint. Floating **dock**
   (tool palette), an **infobar** with level-filter tabs, a **zoom toolbar**.

**Pedagogy — the crown jewel, and better than anything we'd design fresh:** the
onboarding *is* the philosophy. The intro deck names **Dorst's five syndromes**
as "five enemies" and frames every UI lock as one of them headed off:

| Syndrome | The failure | The mechanism against it |
|---|---|---|
| The Lone Warrior | framing in isolation | the merge model forces disagreement into conversation |
| Freeze the World | treating flux as fixed | "a loop, not a pipeline — nothing is ever done" |
| The Self-Made Box | untested assumptions | the AI **Blind-Spot Audit** as a hostile critic |
| The Rational High Ground | ungrounded claims | "you can't name Evidence without two signals" |
| Identification | your slice = the whole | the tool *refuses to do framing* |

The signature principle — **"the lock is the point":** higher tiers are *disabled*
until their foundation is named, and the disabled state *tells you which syndrome
you were about to commit._ Plus two progressive-disclosure moves worth preserving
verbatim: **Seed Mode → Pod Mode** (a free "Hunch" before the full engine) and the
**seven evidence types revealed one-at-a-time only after the situation is mapped.**
A sandboxed 5-minute interactive tutorial teaches the reasoning behind each step.

**Engine reality:** 547 KB of dependency-free vanilla JS with its own DOM, canvas,
and drag engine. Persists the whole app to `localStorage['olos.sensemaking.v2']`
(already `olos.*`-namespaced — it anticipated this integration). The client is the
single source of truth for graph semantics; storage is dumb. Full anatomy of the
`appState` model, the tier/edge lattice, and the JSON-LD/ZIP exports is in the
session notes; the load-bearing shape is `{ settings, items[], cards[],
situations[], nodes{}, sorting{}, mode }`.

---

## 2. Decisions locked (owner, 2026-07-06)

1. **Reskin to OLOS paper.** The canvas joins OLOS's light paper / white-card
   editorial language and single-radius system — *not* a dark instrument mode.
   Consequence: the tier/type semantic palette is re-tuned for **AA contrast on
   light grounds** (the triangulator already ships `-ink` variants —
   `--tier-2-ink`, `--tier-3-ink`, etc. — for exactly this), and node depth comes
   from elevation/border/grain rather than dark contrast.

2. **The canvas is *earned*, not entered cold.** The on-ramp is the
   **extract → upload → swipe** pipeline (§3). A member cannot reach the canvas
   until observations have been run through an app-provided prompt in their **own
   external AI**, the resulting **extracts are uploaded** back into OLOS, and a
   **critical mass of extracts has been swiped** through the signal/noise mechanic.

3. **Two evidence origins.** Extraction draws from **both** the field-survey pool
   *and* **member-added sources** (uploaded literature / citations / articles /
   docs, carrying a URL). Every extract traces back to its origin — closing the
   `source_url`-has-no-producer gap (`ORTELIUS_KNOWLEDGE_GRAPH.md` §5 gap #6).

---

## 3. The member experience pipeline (target)

```
   ┌─ survey_responses ──┐   (field, bottom-up, at scale — SHIPPED, migration 00053)
   │                     │
   ├─ sources ───────────┤   (member-added literature / citations / docs, w/ URL)
   │                     │
   └────────┬────────────┘
            ▼
        EXTRACT ───────────►  UPLOAD  ───────►  SWIPE ───────►  [critical mass] ───►  CANVAS ──► SITUATION
     app builds a            member uploads    collective       unlocks the           triangulate   map + classify
     deterministic prompt    the extracted     signal/noise/    canvas per the         signals up    (7 types), the
     over a subset of BOTH   insights back     super sort of    gate                   Dorst ladder  workbook artifact
     origins; member runs    into OLOS →       the shared
     it in their OWN AI       `extracts`        extract pool
     (no in-app LLM)          (origin-tagged)
```

Stage by stage (extends `SENSEMAKING_FLOW.md` §2):

| Stage | What the member does | Underneath | Gate |
|---|---|---|---|
| **Distribute** | shares the survey into the field | `survey_responses` accrue (shipped) | free |
| **Add sources** | pastes URLs / adds citations / uploads docs | `sources` rows, origin producers | free |
| **Extract** | copies an app-built prompt, runs it in their own LLM, uploads the result | prompt spans a subset of **both** origins; upload parses to `extracts`, each origin-tagged + `verified=false` until QA-confirmed | free (BYO-LLM) |
| **Swipe** | Tinder-sorts extracts signal / noise / ★super | collective corroboration → the shared pool everyone sees; decisions accrete (bitemporal-ready) | free |
| **Canvas** | opens once critical mass is swiped; triangulates surviving signals | the ported engine over `sensemaking_sessions` | free |
| **Situation / classify** | maps the Problem Situation, classifies the 7 types | `problem_situations`, `asset_links` | AI reads **gated (#11)** |

The shape stays **forgiving at the start, demanding at the end** — a member
extracts and swipes freely; the canvas's tier-locks are where the rigor lands.

---

## 4. Visual reskin spec (Triangulator → OLOS paper)

**Token crosswalk** — the shared DNA means most of this is a rename:

| Triangulator | → OLOS | Note |
|---|---|---|
| `--primary-teal #0094a0` | `--teal` | identical, direct |
| `--teal-deep #007882` | `--teal-deep` | identical |
| `--action-red #ee1c25` | `--red #e11d2a` | adopt OLOS red |
| `--midnight #101820` | `--ink #00141b` | adopt OLOS ink |
| `--cloud` / `--ghost-white` surfaces | `--paper` / `--white` + `--shadow-card` | **the reskin core** — light surfaces, card elevation |
| `--radius-2 8px`, `--radius-pill` | `--r 14px` (no pills) | one radius; drop pills |
| `--fw-body 200` | OLOS body weight | drop the ultralight; match OLOS |
| Geologica | Geologica (`--font-geologica`) | already shared |

**The tier/type palette is domain-specific — import it, but re-tune for paper.**
Keep the semantics (tier 1–6, seven types); swap each color for its AA-on-light
value using the triangulator's own `-ink` variants where they exist, and verify
every node label clears AA on `--paper`/`--white`. This palette becomes the
Sensemaker's contribution to the OLOS design system (documented in
`DESIGN_SYSTEM.md` when it lands).

**Chrome:** the Sensemaker is a **full-bleed route** (an app "mode"), *not* wrapped
in the public nav + footer + upsell shell — the canvas needs the viewport. Its own
header/dock/zoom chrome stays, reskinned to paper (white floating toolbars,
`--shadow-card`, `--r`).

**Node depth on paper:** the dark canvas used contrast for depth; on paper, lean on
`--shadow-card` / `--shadow-card-lg`, hairline borders (`--rule`), and the OLOS
grain texture so the lattice stays readable without a dark ground.

---

## 5. Data model

**Shipped (migration `00053`):** `field_surveys`, `survey_responses` — see
[`SCHEMA.md`](../SCHEMA.md) "Data Sensemaker" ERD.

**New tables (numbers claimed at build time — next free is `00054`):**

- **`sources`** — the second evidence origin. `{ id, cycle_id, sector_id NULL,
  title, url, kind (article|paper|policy|dataset|doc|other), notes, added_by
  (participant), created_at }`. The producer that gives an uploaded citation
  provenance; a `prov:Entity` in Ortelius terms.

- **`extracts`** — the atomized insights the swipe pool sorts. Polymorphic origin
  so an extract traces to *either* mouth: `{ id, cycle_id, field_survey_id NULL,
  origin_type ∈ {survey_response, source}, origin_id, title, summary, source_url,
  verified BOOL (QA-intercept gate), created_by, ai_assisted BOOL, schema_version,
  moderation_status, created_at }`. `source_url` + `verified` port straight from
  the triangulator's item shape.

- **`extract_sorts`** — the collective swipe decisions. `{ id, extract_id,
  participant_id, decision ∈ {noise, signal, super}, created_at }`, unique on
  `(extract_id, participant_id)`. `weight = f(signal/super counts)` drives what
  rises into the corroborated pool and feeds the critical-mass gate. Append-style
  (a re-swipe supersedes) so the trajectory is retained — bitemporal-ready.

- **`sensemaking_sessions`** — the canvas home (`SENSEMAKING_FLOW.md` §1,
  `OLOS_BACKEND_CHANGES` spec). `{ id, participant_id, cycle_id, field_survey_id
  NULL, state JSONB, schema_version, created_at, updated_at }`, upsert key
  `(participant_id, cycle_id)`. **The DB is dumb storage; the client stays the
  single source of truth for graph semantics** — `state` is the triangulator's
  `appState` verbatim.

**Provenance / Ortelius groundwork (day-one columns, additive later never a
rewrite):** `schema_version` on every JSONB/extract row (gap #12); `ai_assisted`
on extracts (an AI-proposed extract enters unweighted); `source_url` + origin on
every extract. The eventual `asset_links` edge table + `content_embeddings` and
the AI read surfaces are **Phase 7 / gated (#11)** — out of scope for this floor.

---

## 6. Engine strategy

**Port the engine as-is; reskin; mount; swap two seams.** The docs' invariant is
**reskin-only — the canvas/classify/export engine stays untouched**
(`DESIGN_INTENT.md`). A rewrite of 547 KB of working canvas/drag logic is the
wrong bet.

- **Mount** the vanilla engine behind a **full-bleed React route** (`/sensemake`
  or under the signed-in cycle surface) — a client component that hosts the
  engine (script-embed or iframe'd island) and owns the two bridges below.
- **Seam 1 — persistence:** replace `localStorage['olos.sensemaking.v2']` with
  `sensemaking_sessions` upsert `(participant_id, cycle_id)`. Debounced save →
  API; load hydrates `appState`.
- **Seam 2 — pool:** replace CSV/sample/`localStorage` ingest with a fetch of the
  cohort's **corroborated extract pool** (the swipe survivors) → `items[]`.
- **Reskin** per §4 — a scoped stylesheet override, not an engine fork.

The **extract** and **swipe** surfaces are, by contrast, **built fresh as
OLOS-native React** — they're collective + server-backed (the triangulator's
versions are single-user + local), and they reskin trivially because they're
form/gesture surfaces, not the canvas.

---

## 7. Build order & workstreams (for the agent team)

Three tracks that converge on shared contracts. **Land the contracts first
(the `extracts` record shape + the origin model), then fan out** — the pattern
`ORTELIUS_KNOWLEDGE_GRAPH.md` §6 prescribes.

| WS | Scope | Owner (agent) | Depends on |
|---|---|---|---|
| **Contract** | `extracts` + `extract_sorts` + `sources` + `sensemaking_sessions` migrations + record shapes | `migrations` | — |
| **A — Extraction** | `sources` + "add source" UI · prompt-builder over both origins · BYO-LLM copy · upload/parse → `extracts` · QA-verified gate | `backend` + `frontend` | Contract |
| **B — Swipe** | collective swipe surface (paper reskin of the sort arena) · corroboration weight · the critical-mass gate | `frontend` + `backend` | Contract, A |
| **C — Canvas** | mount the vanilla engine · reskin to paper · seam 1 (sessions) + seam 2 (pool) | `frontend` + `backend` | Contract, B |

**The next buildable slice is WS-A (Extraction)** — it sits directly on top of the
shipped survey pool, is fully gate-free, and unblocks everything downstream. Start
there.

Ownership follows [`docs/agent-teams.md`](agent-teams.md): migrations own the DDL
and claim numbers first; backend owns `app/api/**` + `lib/**`; frontend owns the
components + full-bleed route. The Sensemaker surface is a **single-owner zone** on
the canvas mount (tightly coupled engine bridge) — don't parallelize inside it.

---

## 8. Open decisions (resolve before/at build)

1. **Critical-mass definition** — what unlocks the canvas: a raw extract count, a
   fraction-of-pool-swiped, or a per-member vs. cohort-wide threshold? (drives
   WS-B's gate)
2. **Canvas unlock scope** — per-member (each member unlocks their own canvas once
   they've swiped enough) or cohort-wide (the pool reaches threshold, everyone in)?
3. **Extraction allocation** — how the app assigns response/source subsets across
   participants: round-robin, by interest, or overlapping for corroboration?
   (`SENSEMAKING_FLOW.md` §9 Q1)
4. **Swipe lanes** — binary (keep/discard) + super, or a third "this complicates
   things" lane so paradox-seeding starts at intake? (`SENSEMAKING_FLOW.md` §9 Q2)
5. **QA-verified gate posture** — is an extract from an unverified source usable in
   the pool (dashed/unverified) or held until confirmed?
6. **Naming** — "second" vs "corroborate" vs "+1" for the swipe corroboration
   mechanic (`SENSEMAKING_FLOW.md` §9 Q5); "extract" vs "insight" for the atom.

---

## 9. Governance posture

The whole pipeline in this brief is **gate-free** — survey intake, source upload,
BYO-LLM extraction (no in-app model), collective swiping, and the canvas are a
form + storage + the member's own tools. The **AI-assisted read surfaces**
(synthesis, clustering, adjacent-research, the Blind-Spot Audit *run in-app*) and
the `asset_links` / `content_embeddings` graph are **Phase 7, gated on the
governance gate #11** (agreements + data-governance framework + approved-AI-tools
policy + attorney review). The data layer builds ahead; the in-app AI features do
not. (`ORTELIUS_NORTHSTAR.md` §10, `IMPROVEMENT_ROADMAP.md` decision #11.)
