# Data Architecture — current state, principles, and the target design

**Why this doc:** the objectives now span four sources — the prototype's design intent
(`DESIGN_INTENT.md`), the Pod Squad memo (June 2026; crosswalk in `GAP_AUDIT.md` Appendix A),
and two AI Use Case Canvases: **Data Sensemaker** (field research producing evidence-based
problem statements, AI-assisted with human checkpoints) and **Project Ortelius** (a
provenance-complete institutional knowledge corpus — the "Living Atlas" — compounding across
cycles). Ortelius's own first step is "design the foundational ontology and data model."
This document is that design, grounded in a 12-dimension audit of the shipped schema
(migrations `00001–00036`, 25 tables). Audit date: 2026-07-04.

---

## 1. Current-state assessment

### Strengths (build on these)

1. **Coherent, battle-tested RLS + permission model.** One `has_permission()` primitive
   backs policies; `SECURITY DEFINER STABLE` helpers resolve identity through an indexed
   `auth_user_id`; real hardening passes shipped (`00019`/`00021` WITH CHECK retrofits,
   `00022` soft-delete leak fix).
2. **Migration hygiene.** Genuinely idempotent DDL, forward-only with documented `-- DOWN`
   comments, per-migration "why" headers, a deliberate seed-vs-migration split, and honest
   scar tissue (`supabase/CLAUDE.md` renumber lesson, `00017` drift repair).
3. **Cycle-scoped, config-as-data core.** `cycle_id` threads nearly every domain table;
   `participants` is cycle-independent identity; `cycle_config` (1:1) holds every knob —
   voting budgets, 12 window timestamps, poderator thresholds, even the per-cycle
   `ai_summary_prompt`. This skeleton is exactly right for longitudinal growth.

### Weaknesses (the hardening batch targets these)

1. **Two engineering standards layered by date.** The oldest, most central tables are the
   weakest: `cycles.status` / `pods.status` / `projects.status` / `cycle_enrollments.status`
   are **unconstrained VARCHAR** (a typo'd `'activ'` inserts silently) while the newest
   tables are CHECK-typed; `00001` uses naked `TIMESTAMP`, newer columns `TIMESTAMPTZ`.
2. **State correctness depends entirely on the app remembering.** Zero triggers; `updated_at`
   hand-set per route; five different soft-delete idioms (`inactive_at` / `left_at` /
   `removed_at` / `revoked_at` / `status+inactive_date`) — one of which already caused the
   `00022` RLS leak; denormalized caches (`last_pulse_completed_at`) drift on any
   out-of-band write.
3. **String-not-FK references + unindexed hot columns.** `participants.metro_slug` has no FK
   and is populated from a hardcoded TS file (`lib/metros.ts`), not the `metros` table;
   option-list IDs live unenforced inside JSONB; `votes.voter_id`,
   `project_votes.voter_id/solution_proposal_id`, `moderator_assignments.cycle_id`,
   `events.status/start_at` are unindexed despite known query patterns.

### Fitness verdicts

- **Cross-cycle longitudinal analytics: fit, with caveats.** The `cycle_id` + stable-identity
  skeleton is right; the blockers are practical — unversioned `.passthrough()` JSONB
  (`pulse_checks.survey_responses`), the TIMESTAMP/TIMESTAMPTZ split, and no rollup views.
- **Provenance-linked research corpus (Data Sensemaker/Ortelius): not yet.** Consent/grant
  provenance exists (`cycle_agreements`, `granted_by/at`, `invited_by`), but **content
  lineage does not**: `solution_proposals` reference problem statements by free text
  (`proposal_data.pod_problem_link`), `resources.from_line` is prose, no history tables, no
  extensions enabled (no pgvector/pg_trgm), no views. The pieces for *who agreed to what*
  exist; the pieces for *where did this insight come from* do not.

---

## 2. Design principles

1. **Provenance-first.** Every synthesized artifact carries structural links to its sources.
   The chain the product implies: survey observation → sensemaking session → problem
   situation → problem statement → solution proposal → project → case study / commons
   resource → next cycle's inputs. (Ortelius: "complete provenance linking synthesized
   insights to original evidence." Data Sensemaker: problem statements "grounded in data,
   not vibes.")
2. **Longitudinal by default.** Nothing resets at cycle end. New tables always carry
   `cycle_id` (nullable where an asset outlives cycles) + immutable `created_at`
   TIMESTAMPTZ; reporting reads span cycles by construction (memo: evaluation data
   "trackable across cycles… for funding requests").
3. **Versioned flexible payloads.** JSONB stays the right tool for evolving qualitative
   shapes — but every blob gains a `schema_version` field, its Zod twin is `.strict()`
   (never `.passthrough()`), and readers branch on version. Structured fields that need
   querying/joining get promoted to columns (the `00018` precedent).
4. **Embeddings-ready, Postgres-native.** Enable `pgvector`; store embeddings in one
   model-versioned sidecar — `content_embeddings(entity_type, entity_id, model,
   embedding vector, embedded_at)` — never inline on domain rows. Semantic retrieval,
   thematic clustering, and "adjacent research" recommendations all read this one table.
   **No dedicated graph or vector database.** Ortelius's "minimum viable graph
   architecture" here = FKs (typed edges we know) + one polymorphic edge table (edges we
   discover) + embeddings (soft edges). Revisit only if this demonstrably fails at scale.
5. **Governance built-in, not bolted on.** Research-input tables carry `consent_version`
   (+ `subject_informed_ai` where AI analyzes responses); synthesized artifacts carry AI
   provenance (`ai_assisted BOOLEAN`, `ai_tool`, `reviewed_by`, `reviewed_at`) — the
   canvases' human-in-the-loop checkpoints as columns, so "AI-generated vs human-validated"
   is a queryable distinction, not a footnote. Anonymous submissions get a retention path
   (`anonymized_at`, scheduled scrub) *before* `allow_anonymous` ships.
6. **One write path per lifecycle** (§3.7 generalized): every state machine gets exactly one
   mutation function; new lifecycle states (e.g. `stepped_back`) are added to the reconciler
   before any route writes them. **Config-as-data** continues: new knobs go in
   `cycle_config`, never constants.

---

## 3. The hardening batch (one migration series; mechanical, no product change)

Ordered, each idempotent, following house style:

1. **Status CHECKs** on `cycles.status`, `pods.status`, `projects.status`,
   `cycle_enrollments.status` (values per the existing inline comments; add
   `stepped_back` to enrollments now so Phase 4's leaving-well doesn't need a second pass).
2. **`set_updated_at()` trigger** (single function, `SECURITY INVOKER`, `search_path`
   pinned) applied to every table with `updated_at`; routes stop hand-setting it.
3. **Pin `search_path`** on `is_admin_or_owner()`, `current_participant_id()`,
   `has_permission()` (the Supabase `function_search_path_mutable` advisory), and add
   `can_write_cycles()` as the honestly-named alias for `is_admin_or_owner()` (new policies
   use the new name; old policies migrate opportunistically).
4. **Missing indexes:** `votes(voter_id)`, `project_votes(voter_id)`,
   `project_votes(solution_proposal_id)`, `moderator_assignments(cycle_id)`,
   `events(status)`, `events(start_at)`, `pulse_checks(participant_id, scheduled_date)`,
   `participants(metro_slug)` (until the FK swap below).
5. **`metros` becomes the source of truth:** backfill/validate `participants.metro_slug`
   against `metros.slug`, add the FK (or migrate to `metro_id` with §1.8's column batch),
   retire `lib/metros.ts` zip mapping into a `metros.zip_prefixes` column or lookup table.
6. **Timestamp policy:** all new columns TIMESTAMPTZ (keep `events.start_at` as wall-time by
   documented exception); document — don't churn — the legacy TIMESTAMP columns, and
   normalize at the view layer for analytics.
7. **Soft-delete convention going forward:** `status` + `{verb}_at TIMESTAMPTZ` pair, RLS
   policies must name the live-row predicate explicitly (the `00022` lesson).
8. **JSONB versioning:** add `schema_version` to `pulse_checks.survey_responses` writes,
   flip its Zod schema off `.passthrough()`; new blobs ship versioned from day one.

## 4. The provenance spine (lands with the Data Sensemaker phase)

New tables (all RLS'd in the same migration, service-role writes where public):

- **`field_surveys`** — the research instrument (cycle_id, title, share_slug,
  `allow_anonymous`, `subject_informed_ai`, status, ai-assist provenance on the
  questionnaire itself).
- **`survey_responses`** — anon-capable inputs (`participant_id NULL`, `consent_version`,
  `moderation_status`, `anonymized_at`), rate-limited public write (`ip_hash` — reuse the
  RSVP pattern from Phase 0).
- **`sensemaking_sessions`** — the Triangulator's canvas state (JSONB + `schema_version`),
  keyed to cycle + field survey; replaces localStorage.
- **`problem_situations`** — the voted-in, Triangulator-mapped situations
  (`sensemaking_session_id`, `problem_owner_id`, messy context, status).
- **`asset_links`** — the typed edge table:
  `(source_type, source_id, target_type, target_id, link_kind, created_by, ai_assisted,
  created_at)` with `link_kind IN ('derived_from','evidence_for','cites','supersedes')`,
  unique on the 5-tuple. Known chains still get real FKs
  (`solution_proposals.problem_situation_id` — closing today's free-text lineage break);
  `asset_links` covers the many-to-many and cross-type edges (observation→situation,
  situation→statement evidence, resource→project provenance, citation→claim).
- **`content_embeddings`** — the pgvector sidecar (+ `CREATE EXTENSION vector`), populated
  lazily by an embedding job; entity coverage starts with survey_responses,
  problem_situations, problem_statements, solution_proposals, learning-log shares,
  resources.
- **`resources.project_id` FK** (replacing text `from_line` as the machine edge — the
  commons flywheel; do while the table is empty per `00036`).

## 5. Longitudinal readiness

- **Rollup views** (plain views first, materialized if slow): per-cycle participation
  summary (enrollment → logs → milestones → project outcome per participant per cycle) and
  the cross-cycle participant journey — the memo's funding-report ask and Ortelius's
  "longitudinal qualitative evidence" both read from these.
- `learning_logs` (Phase 1) designed cross-cycle-queryable from day one: `cycle_id` NULLABLE
  (standalone reflection, the `00004` precedent), `kind` enum, TIMESTAMPTZ throughout.
- Evaluation prefill (milestone logs) reads the member's own prior rows — the memo's
  "avoid redundant questions" — which requires nothing beyond the table being queryable
  by `(participant_id, created_at)`.

## 6. What we are deliberately NOT doing

- **No graph database, no external vector store, no separate "knowledge platform."** The
  Living Atlas starts as Postgres: FKs + `asset_links` + `content_embeddings` + views.
- **No event-sourcing rewrite.** Append-only tables where the domain is append-only
  (agreements, revocations, links, embeddings); plain rows elsewhere.
- **No speculative ontology tables.** Ortelius's ontology governance starts as a documented
  vocabulary (`link_kind` values, entity_type registry shared with the entity explorer),
  evolving by migration like everything else.
