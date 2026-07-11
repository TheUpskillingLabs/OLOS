# Project Ortelius — The Living Atlas Knowledge Graph

**Status:** Design tee-up. **Not built.** This brief exists to hand a future high-effort build session (model "Fable", multi-agent "ultracode") a grounded, single-source starting point. It ratifies nothing on its own — it consolidates what five research maps found across `/home/user/OLOS` and `/home/user/onboarding-proto`, states the level of coverage honestly, and sequences the work. It is the "own design sub-doc" that `SECTOR_MODEL.md` explicitly defers the concrete graph model to. **Companion: `SENSEMAKING_FLOW.md`** — the member-facing engine (survey → extract → swipe → canvas → Paradox Sprint) that produces the nodes this graph accretes, and the concrete field-survey spec. **Above this doc: `ORTELIUS_NORTHSTAR.md`** — the frontier ceiling + the Fable + ultracode v1 build tee-up (this doc is the grounded, buildable floor it references as `ORTELIUS §6`).

---

## 1. What Ortelius is

Project Ortelius is the **Living Atlas**: a "provenance-complete institutional knowledge corpus … compounding across cycles" (`docs/audit/DATA_ARCHITECTURE.md:6-8`). It is the layer that takes the field research and Triangulator sensemaking a cohort produces and makes it *accumulate* — into a sector-scoped, cross-cohort knowledge graph that outlives any single Build Cycle instead of resetting when the cohort closes (`docs/SECTOR_MODEL.md` §1, §11).

The organizing idea is **provenance-first**: every synthesized artifact carries structural links back to its sources, so the corpus is a queryable lineage rather than a pile of documents. The chain the product implies is `survey observation → sensemaking session → problem situation → problem statement → solution proposal → project → case study / commons resource → next cycle's inputs` (`DATA_ARCHITECTURE.md:63-68`). Ortelius's stated first step is to "design the foundational ontology and data model" (`DATA_ARCHITECTURE.md:6-8`) — which is what this tee-up is for. Its purpose is to link "synthesized insights to original evidence" so problem statements are "grounded in data, not vibes" (`DATA_ARCHITECTURE.md:66-68`).

Architecturally it is deliberately **modest**: "Ortelius's 'minimum viable graph architecture' here = FKs (typed edges we know) + one polymorphic edge table (edges we discover) + embeddings (soft edges)" (`DATA_ARCHITECTURE.md:81-83`). No graph database, no external vector store, no separate knowledge platform — "The Living Atlas starts as Postgres: FKs + `asset_links` + `content_embeddings` + views" (`DATA_ARCHITECTURE.md:167-168`). The sector model reframes it as **the commons**: field research + knowledge graph are "docs, RFCs, shared knowledge" owned durably by the sector (`SECTOR_MODEL.md` §2), accumulating theme-based across runs (§11), with upcoming-cohort members granted early read access to prior research and the current survey (§4). Ortelius is **improvement-roadmap Phase 7** — not to be confused with the `TUL_MVP_Spec.md` "Phase 7" (Project Self-Registration), an unrelated build-phase label (`IMPROVEMENT_ROADMAP.md:187`).

---

## 2. Coverage audit

Every existing location that touches Ortelius / the Data Sensemaker / survey data / ontology:

| Location | What it covers |
|---|---|
| `docs/audit/DATA_ARCHITECTURE.md:6-10` | The one-line definition; "first step = ontology + data model" |
| `docs/audit/DATA_ARCHITECTURE.md:63-68` | Provenance-first principle + the source→next-cycle chain |
| `docs/audit/DATA_ARCHITECTURE.md:77-83` | Embeddings-ready principle; "minimum viable graph architecture" = FK + edge table + embeddings |
| `docs/audit/DATA_ARCHITECTURE.md:125-151` | §4 provenance spine — concrete tables (`field_surveys`, `survey_responses`, `sensemaking_sessions`, `problem_situations`, `asset_links`, `content_embeddings`) |
| `docs/audit/DATA_ARCHITECTURE.md:153-158` | §5 longitudinal readiness — the rollup views Ortelius reads |
| `docs/audit/DATA_ARCHITECTURE.md:165-173` | §6 "deliberately NOT doing" — no graph DB, no speculative ontology tables |
| `docs/audit/IMPROVEMENT_ROADMAP.md:157-185` | Phase 6 (Data Sensemaker) — builds the source nodes + provenance spine |
| `docs/audit/IMPROVEMENT_ROADMAP.md:187-203` | **Phase 7 charter** — the four Ortelius deliverables |
| `docs/audit/IMPROVEMENT_ROADMAP.md:252-263` | Decision-queue blockers #11 (governance gate), #13 (pilot scope), #14 (embeddings model) |
| `docs/audit/DESIGN_INTENT.md:223` | AI Use Case Canvas: Project Ortelius — the intent source driving the data architecture |
| `docs/audit/PROGRESS.md:28,124-127,151-154` | Status ⬜ Not started; entire Phase-6/7 stack absent; open decisions #13/#14 |
| `docs/audit/GAP_AUDIT.md:73,142-149,171` | Gaps: no `problem_situations` table; `survey_responses`/`sensemaking_sessions` missing; `resources.from_line` is prose not FK |
| `docs/SECTOR_MODEL.md` §1, §2, §4, §6, §7, §9, §10 | Sector-scoping + cross-cohort accumulation + early access + Phase D; **defers the concrete graph model to this sub-doc** |
| `lib/entity-explorer/registry.ts`, `types.ts:14-32` | The one *shipped* graph-like structure: a hand-curated 18-entity relational registry (FKs + reverse relations); the seed of Ortelius's node vocabulary |
| `supabase/migrations/00001_initial_schema.sql:161-235` | Existing FK edges (`votes→statements`, `project_votes→proposals`, `projects.solution_proposal_id/pod_id`, `pods.problem_statement_id`) + external-artifact pointer columns (`github_repo_url`, `slack_channel_id`, `drive_folder_id`) |
| `SCHEMA.md:532,560` | Node-candidate tables: learning-log shares (embedding target), `solution_proposals.proposal_data` JSONB |
| `onboarding-proto/triangulator.html:2966-3073,7814-8068` | The Triangulator canvas state (`appState`) + the Problem Situation artifact shape — the upstream sensemaking output |
| `onboarding-proto/triangulator.html:8639-8655` | The existing JSON-LD export — sensemaking already serialized as a typed-edge graph (`hasChild` / `@id`) |
| `onboarding-proto/triangulator.html:9757-9793` | Survey-pool ingest, record normalization, `storage`-event sync, the "prototype-level only" production seam |
| `onboarding-proto/app.js:648-711,1024-1034` | The survey seed (`SURVEY_SEED`), pool helpers, and the public `FLOWS('survey')` observation intake |
| `onboarding-proto/docs/OLOS_BACKEND_CHANGES.md:72-117,704-712` | Production `field_surveys` / `survey_responses` / `sensemaking_sessions` schemas + the open decisions |
| `onboarding-proto/docs/HANDOFF.md:77,99` | Crosswalk: `SURVEY_SEED` / `olos.surveyPool.v1` → `field_surveys` + `survey_responses` API |

**Notably absent:** `docs/OLOS-architecture-brief.md` and `SCHEMA.md` have zero Ortelius/Atlas/knowledge-graph mentions; `onboarding-proto` never uses "Ortelius" or "Living Atlas" (its `OLOS_BACKEND_CHANGES.md:152-156` "Living Library" is the commons *resource* library — a distinct, closer-in artifact).

**Verdict on "we've covered it":** covered as **VISION** — fully. Covered as **DATA MODEL** — *partially, at the table-sketch level*: table names, column lists, the `link_kind` enum, and the FK-vs-edge-vs-embedding split all exist (`DATA_ARCHITECTURE.md:125-151`), but "details finalized at build time," and the sector-scoped accumulating graph model is *explicitly deferred to this not-yet-written sub-doc*. Covered as **BUILD PLAN** — *no*: only four Phase-7 bullet deliverables (`IMPROVEMENT_ROADMAP.md:193-203`), with no sequencing, migration numbers, API/route design, or UI spec, and nothing coded (highest migration on disk is `00047`; `PROGRESS.md:124-127`). Honest summary: **strong vision, sketched data model, no build plan, zero implementation.**

---

## 3. Source inputs

Ortelius ingests two upstream artifacts. Neither exists server-side yet.

### 3a. Field-survey observations

The raw material — "field notes, anecdotes, things you've seen with your own eyes" (`app.js:1031`). Public, no account needed (`FLOWS('survey')`, `app.js:1024-1034`).

- **Prototype record shape** (`olos.surveyPool.v1`): `{id, title, summary, submittedAt}` — seed rows `submittedAt:0` (`app.js:680`), live rows `submittedAt:Date.now()` (`app.js:687`). Seeded from the 21-row Civic & Elections CSV `SURVEY_SEED` (`app.js:653-675`).
- **As normalized by the Triangulator** into a canvas signal (`triangulator.html:9770-9777`): adds `tag` (`'Survey Response'` for live rows, `'Friction Signal'` for seed — note this is the *opposite* of the CLAUDE.md summary, per `triangulator.html:9776`), `source_url` (read but **never written** by the survey flow — a producerless field), and `verified:false`.
- **Production record** — split into `field_surveys` (the instrument, one row per cycle's problem domain: `cycle_id, problem_domain, title, share_slug, status, allow_anonymous`, `OLOS_BACKEND_CHANGES.md:72-83`) and `survey_responses` (the observation: `field_survey_id FK, participant_id FK NULL, submitter_email, title, summary, source_url, is_public, moderation_status, ip_hash`, `OLOS_BACKEND_CHANGES.md:85-93`). The nullable `participant_id` is the load-bearing design choice enabling anonymous public submits via `/s/[share_slug]` (`OLOS_BACKEND_CHANGES.md:95-99`). The audit adds three governance columns: `consent_version`, `subject_informed_ai`, `anonymized_at` (`DATA_ARCHITECTURE.md:84-89,132-134`).

### 3b. Triangulator sensemaking / frame artifacts

The synthesized material — a Kees Dorst Frame-Creation canvas (`AI_ROLE`, `triangulator.html:6647`). Observations climb a **tier ladder**: `0 Extracted Signal → 1 Evidence → 2 Pattern → 3 Theme → 4 Super-theme → 5 Mega-theme → 6 Meta-theme` (`triangulator.html:3820`), with tier-1 evidence classified into **Dorst's seven types** (`history, counterfactual, problem, boundary, flux, player, value` — `triangulator.html:3012-3027,36-43`).

- **The frame artifact = a Problem Situation** — created by committing a validated card group (gated on at least one named Theme, `triangulator.html:7804-7806`): `{id, title, description, frame, stakeholderMap, problematization, box, memberCardIds, createdAt}` (`triangulator.html:7814-7821`), authored through a workbook carrying `openness, evidenceCoverage, researchAgenda, voicesNeeded, accessNeeds, paradox, statusQuoBeneficiaries` (`triangulator.html:7982-8033`).
- **Canvas state** (`appState`, `olos.sensemaking.v2`, `triangulator.html:3041-3073`): `settings{title,concept}, items[] (signals), cards[] (tiered nodes with childIds), situations[], nodes{} (positions)`.
- **Lineage is already graph-shaped but implicit**: encoded as in-object `childIds`/`memberCardIds` and re-serialized at export to JSON-LD `hasChild`/`@id` edges (`triangulator.html:8514-8520,8639-8655`). Production wants this as a first-class typed edge table, not an export.
- **Production home** — `sensemaking_sessions` (`state jsonb, schema_version, cycle_id, participant_id, field_survey_id`, upsert key `(participant_id, cycle_id)`, `OLOS_BACKEND_CHANGES.md:101-117`; `DATA_ARCHITECTURE.md:135-136`). "The DB is dumb storage plus a save/load boundary; the client stays the single source of truth for graph semantics" (`OLOS_BACKEND_CHANGES.md:108-113`).

### 3c. Roll-up per sector, accumulation across cohorts (tie to SECTOR_MODEL)

Aggregation stacks in three layers: (1) **cross-user** — the server pools each cohort's responses into one cycle-scoped pool, "keyed to the cycle's field survey" (`IMPROVEMENT_ROADMAP.md:166-167`), replacing the prototype's single-browser `storage`-event ingest (`triangulator.html:9757-9761`). (2) **Sector-scoped** — `+ sector_id` on the survey pool + Triangulator sensemaking "so it accumulates and upcoming members can read it early" (`SECTOR_MODEL.md` §7). (3) **Cross-cohort accumulation** — on graduation, step 5 of the active→archived transition rolls the commons up: "the cohort's field research + knowledge graph accumulate onto the sector (they don't reset for the next run)" (`SECTOR_MODEL.md` §6), theme-based not 1:1 per cohort (§11), triggered by a manual admin close (§4). Upcoming cohorts get early read access to prior research and the live survey (§4, §11). This is the entirety of **Phase D — Living sector** (`SECTOR_MODEL.md` §9), which rides on Phase A (`sector_id` exists) and Phase C (graduation transition exists).

---

## 4. Target model (design skeleton — not final schema)

Reuse the specified primitives; do not introduce graph-DB infrastructure. Three edge classes (`DATA_ARCHITECTURE.md:81-83`): hard FKs (exist), one polymorphic edge table (unbuilt), embedding soft-edges (unbuilt).

### 4a. The semantics are Dorst + CCF + ANT native

The physical primitives below carry a three-layer semantic model (how members produce it: `SENSEMAKING_FLOW.md`). The layers are orthogonal, which is what lets the graph stay simple at the edge and rich in aggregate.

**Layer 1 — epistemic (Dorst Frame Innovation).** Every artifact node carries a **stage**: `signal → evidence → pattern → theme → frame → problem_situation → problem_statement → solution_proposal → project → resource`. Stage is an enum with room to grow; a node is **promoted, never rewritten** (the scaffolding invariant — a `hypothesis` matures into a `theme`, then `frame`, then `situation`). Evidence also carries a **type** — the Dorst-flavoured lenses `history · counterfactual · problem · boundary · flux · player · value` — kept **orthogonal** to the capital tag: "how we interrogated it" vs. "what asset it concerns".

**Layer 2 — ontic (Actor-Network Theory).** A second node family: **actants** — the human *and non-human* entities in the field (people, institutions, technologies, documents, infrastructures, natural features, standards). Sensemaking artifacts are *about* actants (`concerns` edges); themes abstract the relations *between* actants. Dorst's Context→Field steps *are* drawing the actor-network boundary. The **paradox** is a distinguished node — an **OPP (obligatory passage point)** — linking a `problem_situation` to the **regime/paradigm** it sustains (a complex-adaptive-system attractor); a **frame** proposes a *new* OPP that re-routes the network. `regime` / `field` are first-class context nodes, so regimes can be compared across cohorts/sectors (the longitudinal payoff — tracking whether a sector's reframes actually shifted its regime).

**Layer 3 — substance (Community Capitals Framework).** Capitals — `natural · cultural · human · social(bonding|bridging) · political · financial · built` — appear as **stocks** (a tag on an actant: what it embodies) and **flows** (on association edges: what a tie mobilizes). Capital *flows* (`from → to`, `builds | depletes`) are Emery & Flora's spiraling-up rendered in graph form.

**Two edge classes → two `link_kind` vocabularies:**
- **Vertical — lineage (Dorst).** The epistemic ascent: `extracted_from · evidences · patterns_into · themes_into · frames · problematizes · grounds · supersedes` — replaces generic `derived_from`/`cites`. Evidence→hypothesis edges are **signed**: `supports · complicates · refutes` (complications are the raw material of the paradox).
- **Horizontal — association (CCF / ANT).** Ties between **actants**, typed by the **capital** they run on, with an optional Callon translation state (`problematization | interessement | enrolment | mobilization`). These edges *are* the actor-network.

Both classes carry a social **weight = f(seconds/endorsements)** — significance is member-corroborated, not asserted (`SENSEMAKING_FLOW.md` §5). Everything above is nullable/optional at the leaf: the Rung-1 tool writes only `evidence`/`hypothesis` nodes and one signed edge.

### 4b. Physical primitives

**Nodes** — the provenance chain (`DATA_ARCHITECTURE.md:64-66`), addressed polymorphically as `(entity_type, entity_id)`:
`survey_responses` · `sensemaking_sessions` · `problem_situations` · `problem_statements` · `solution_proposals` · `projects` · `resources` (case study / commons) · learning-log shares.

**Edges:**
- *Typed edges we know* = real FKs — the concrete one to close today's break is `solution_proposals.problem_situation_id` (replaces free-text `proposal_data.pod_problem_link`) and `resources.project_id` (the commons-flywheel FK, a called-out gap: `GAP_AUDIT.md:146,171`; `DATA_ARCHITECTURE.md:150-151`).
- *Polymorphic edge table* = **`asset_links`** `(source_type, source_id, target_type, target_id, link_kind, created_by, ai_assisted, created_at)`, unique on the 5-tuple (`DATA_ARCHITECTURE.md:139-145`). Covers observation→situation, situation→statement evidence, resource→project provenance, citation→claim.
- *Soft edges* = **`content_embeddings`** `(entity_type, entity_id, model, embedding vector, embedded_at)` — one model-versioned pgvector sidecar, never inline on domain rows; coverage starts with `survey_responses, problem_situations, problem_statements, solution_proposals, learning-log shares, resources` (`DATA_ARCHITECTURE.md:77-80,146-149`).

**Ontology** — a *documented vocabulary*, not an engine (`IMPROVEMENT_ROADMAP.md:202-203`, `DATA_ARCHITECTURE.md:171-173`):
- `link_kind` carries **two vocabularies** (§4a): the Dorst lineage verbs (`extracted_from…supersedes`, plus signed `supports/complicates/refutes`) and the CCF capital/flow association types. The `DATA_ARCHITECTURE.md:141` generic seed (`derived_from/evidence_for/cites/supersedes`) is what these specialize; evolved by migration.
- The **entity-type registry shared with the Entity Explorer** — promote (don't import) the sealed, admin-only `EntityKey` union + `REGISTRY` (`lib/entity-explorer/types.ts:14-32`, `registry.ts:3-6`) into the shared `(entity_type, entity_id)` node-identity source that both `asset_links` and `content_embeddings` validate against.
- **Frame-Innovation stage tags** on knowledge assets — map the Triangulator's Archaeology→Themes method steps onto assets (`IMPROVEMENT_ROADMAP.md:200-201`).

**Sector scoping** — `+ sector_id` on the survey pool + sensemaking sessions so the graph accumulates per sector (`SECTOR_MODEL.md` §7); rollup-on-graduation is the accumulation trigger (§6).

**Provenance/consent** — edges carry `ai_assisted`; AI-touched assets carry `ai_tool`/`reviewed_by`/`reviewed_at` (`DATA_ARCHITECTURE.md:84-89`); field inputs carry `consent_version`/`subject_informed_ai`/`anonymized_at`.

**Read surfaces** (Phase 7 / Phase D): semantic search + thematic clustering + "adjacent research" and evidence-gap suggestions over `content_embeddings` (AI-assisted, human-reviewed); a **cross-cycle browse surface** for past situations/statements/projects/outcomes as next-cycle inputs; **rollup views** (per-cycle participation + cross-cycle participant journey); **early-access read** for upcoming-cohort members; a public/sector atlas surface (`IMPROVEMENT_ROADMAP.md:193-198`, `DATA_ARCHITECTURE.md:155-158`, `SECTOR_MODEL.md` §9).

---

## 5. Gaps a build needs to close

1. **The concrete accumulating graph model itself** — deferred to this sub-doc; the single biggest design gap. Node/edge shape for the *sector-scoped, cross-cohort* artifact (vs. the per-session `asset_links` primitives) is unspecified.
2. **Entire provenance spine unbuilt** — `field_surveys, survey_responses, sensemaking_sessions, problem_situations, asset_links, content_embeddings` all absent; Triangulator not integrated (`PROGRESS.md:124-127`; no migration past `00047`).
3. **No extensions / views** — no pgvector, no pg_trgm, no rollup views (`DATA_ARCHITECTURE.md:51,56`).
4. **Response→card mapping undecided** — direct 1:1, manual curation, or AI-assisted; determines whether every raw response becomes a node or only promoted ones, and whether `survey_responses` needs a "promoted to pool" state (`OLOS_BACKEND_CHANGES.md:704-706`). The most load-bearing unresolved gap for node population.
5. **No `problem_situations` table** — OLOS collapses situation into `problem_statement`+pod (`GAP_AUDIT.md:73`); the rich workbook artifact has no home.
6. **`source_url` has no producer** — read by the Triangulator and specced as a column, but the survey flow never captures it (`triangulator.html:9774`, `app.js:1025`); evidence provenance is defined but uncollected.
7. **Consent / anonymity / retention** — no policy for `participant_id IS NULL` submissions; `anonymized_at` + scheduled scrub required *before* `allow_anonymous` ships (`OLOS_BACKEND_CHANGES.md:711-712`, `DATA_ARCHITECTURE.md:88-89`); moderation is schema-only, unconsumed (`OLOS_BACKEND_CHANGES.md:707-708`).
8. **Per-cycle/per-sector pool isolation unconfirmed** (`OLOS_BACKEND_CHANGES.md:709-710`); the commons-rollup-on-graduation mechanic has no implementation (`SECTOR_MODEL.md` §6).
9. **Sector substrate doesn't exist** — `sectors`, `cycles.sector_id`, `projects.sector_id` are design-only (`SECTOR_MODEL.md` §7); the graph can't scope onto a `sector_id` that isn't there until Phase A.
10. **Node-identity standard unenforced** — nothing defines/validates the `(entity_type, entity_id)` address space; the Entity Explorer union is sealed and non-importable (`types.ts:4-6`).
11. **Atlas browse / evidence-gap / adjacent-research UX** — no route or UI spec beyond one sentence (`IMPROVEMENT_ROADMAP.md:196-198`); "sector knowledge-graph surfacing" is otherwise unspecified (`SECTOR_MODEL.md` §9).
12. **JSONB unversioned** — new `survey_responses`/`sensemaking_sessions` must ship `schema_version` from day one (`DATA_ARCHITECTURE.md:73-76,135`).
13. **Governance gate (#11) unmet** — agreements + data-governance framework + approved-AI-tools policy + facilitator training + attorney review must exist before *any* AI-assist ships. "The data layer can build ahead; the AI features cannot" (`IMPROVEMENT_ROADMAP.md:252-255`).

**Non-goals a build must respect** (so it doesn't over-build): no graph database, no external vector store, no separate knowledge platform, no event-sourcing rewrite, no speculative ontology tables (`DATA_ARCHITECTURE.md:165-173`).

---

## 6. Build plan for the future Fable + ultracode session

Hard dependency chain: **Phase 7 (Ortelius) waits on Phase 6 (Sensemaker spine), which waits on the governance gate #11 and the sector substrate (Phase A)** (`PROGRESS.md:127`, `IMPROVEMENT_ROADMAP.md:189-190,252-255`, `SECTOR_MODEL.md` §9). The data layer may build ahead of the AI features; the AI features may not build ahead of governance.

**Workstream 0 — Prerequisites (blocking, mostly owner/legal, not code).** Resolve decisions #11 (governance gate), #13 (pilot scope), #14 (embeddings model — this fixes `vector(n)`). Land the sector substrate (`sectors` + `sector_id` FKs) from Phase A. *No fan-out — sequential gates.*

**Workstream 1 — Ingestion from Triangulator + survey (Phase 6, source nodes).** Build `field_surveys` + `survey_responses` (anon-capable, `consent_version`, `moderation_status`, `ip_hash` rate-limit, `/s/[share_slug]` public submit) and `sensemaking_sessions` (JSONB + `schema_version`, keyed to cycle + field survey, upsert `(participant_id, cycle_id)`). Swap the Triangulator's localStorage `ingestSurveyPool` for a fetch against the `survey_responses` API; add the `source_url` producer to the survey flow. Reskin-only invariant holds — the canvas/classify/export engine stays untouched (`DESIGN_INTENT.md:151`). **Migrations sequenced: `field_surveys`+`survey_responses`+RLS, then `sensemaking_sessions`+RLS** (`OLOS_BACKEND_CHANGES.md:681-682`). *Fan-out fits here: parallel agents on (a) survey stack + RLS, (b) Triangulator-integration seam, (c) consent/moderation/retention scrub job — converging on the shared record shapes.*

**Workstream 2 — Graph store + ontology (Phase 6, the spine).** Build `problem_situations` (`sensemaking_session_id`, `problem_owner_id`, status), the `asset_links` polymorphic edge table + `link_kind` enum, the real FKs (`solution_proposals.problem_situation_id`, `resources.project_id`), and `content_embeddings` (+ `CREATE EXTENSION vector`). Promote the Entity-Explorer `EntityKey` union into the shared `(entity_type, entity_id)` node-identity registry and validate both tables against it. Decide and implement the response→card mapping (gap #4). Add Frame-Innovation stage tags. *Fan-out fits: parallel agents on (a) edge table + FK backfill, (b) embeddings sidecar + lazy embed job, (c) node-identity registry promotion — but they share the node-identity contract, so land that contract first, then fan out.*

**Workstream 3 — Sector rollup + accumulation (Phase D).** Add `+ sector_id` scoping to the survey pool + sensemaking; implement the graduation commons-rollup (step 5, theme-based) triggered by admin close; build the cross-cycle rollup views. Depends on Phase C (graduation transition). *Fan-out: rollup views vs. accumulation-on-close mechanic can parallelize.*

**Workstream 4 — Read / Atlas surfaces (Phase 7 + Phase D).** Embedding backfill + semantic retrieval (search, thematic clustering, adjacent-research + evidence-gap suggestions — AI-assisted, human-reviewed, gated on #11). The cross-cycle browse surface (past situations/statements/projects/outcomes as next-cycle inputs). Sector knowledge-graph surfacing (public atlas). *Fan-out fits well: retrieval/clustering backend, browse-surface UI, and public atlas rendering are largely independent once the graph + embeddings exist.*

**Workstream 5 — Early-access gating.** Grant upcoming-cohort members read access to the sector's prior field research + the live survey (`SECTOR_MODEL.md` §4, §11); enforce closed/B2B-cycle non-contribution/visibility rules once decided (open question, §7). *Small — sequential after WS3/WS4.*

**Where multi-agent fan-out pays off:** WS1, WS2, and WS4 each decompose into 2–3 independent tracks that converge on a shared contract (the record shapes, the node-identity registry, the graph+embeddings tables respectively). The pattern for ultracode: **land the shared contract with one agent, then fan out the tracks that consume it.** WS0 and WS5 are sequential gates — do not fan out.

---

## 7. Open questions for the owner

1. **Pilot scope (#13)** — which theme, cohort, and Build Cycle pilots the structured research workflow? (`IMPROVEMENT_ROADMAP.md:259-260`)
2. **Embeddings model/provider (#14)** — which model and dimension (fixes `vector(n)`), constrained by "participant data will not be used for model training"? (`IMPROVEMENT_ROADMAP.md:261-263`)
3. **Governance gate (#11)** — are the agreements, data-governance framework, approved-AI-tools policy, facilitator training, and attorney review in place? Nothing AI-assisted ships until they are. (`IMPROVEMENT_ROADMAP.md:252-255`)
4. **Response→card mapping** — does every raw survey response become a graph node, or only curated/promoted ones (direct 1:1 / manual / AI-assisted)? This is the most load-bearing modeling choice. (`OLOS_BACKEND_CHANGES.md:704-706`)
5. **Anonymous-data retention/privacy** — retention window + `anonymized_at` scrub policy before `allow_anonymous` ships. (`OLOS_BACKEND_CHANGES.md:711-712`)
6. **Accumulation granularity** — "theme-based, not 1:1 per cohort" needs a concrete merge/dedupe rule when a new cohort's graph rolls onto an existing sector graph. (`SECTOR_MODEL.md` §11)
7. **Closed / B2B cycles vs. the commons** — closed cycles "may not publish to the commons" and their model is deferred (`SECTOR_MODEL.md` §4, §10); do they contribute to or read the sector graph at all?
8. **Cohort naming + historical backfill** — how existing cycles attribute their field research onto sectors retroactively. (`SECTOR_MODEL.md` §10)
9. **The `'Survey Response'` vs `'Friction Signal'` tag** — a client-only Triangulator display attribute today with no column; if the distinction matters to the graph it needs an explicit home. (`triangulator.html:9777`)
10. **Sector governance over the accumulated commons** — the Steering Committee / `sector_committee` is deferred and out of scope for now (`SECTOR_MODEL.md` §5, §10); who governs the rolled-up graph in the interim?
