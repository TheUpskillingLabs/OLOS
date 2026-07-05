# Project Ortelius — North-Star Architecture

**The Living Atlas as a consented civic decision engine**

*Status: North-star design. Grounds in `SECTOR_MODEL.md`, `SENSEMAKING_FLOW.md`, `ORTELIUS_KNOWLEDGE_GRAPH.md`. The theory stack (Dorst Frame Innovation · Community Capitals · Actor-Network Theory · the human-bootstrapped flywheel) is fixed; this elevates it. It supersedes nothing until ratified.*

> **How to use this document — the Fable + ultracode v1 build tee-up.** This is both the frontier *north-star* (the ceiling) and the *hand-off brief* for the future **Fable + ultracode** session that will design and build **Ortelius v1**. Read the ceiling for direction; build the **`[floor]`** for v1.
>
> **v1 = the `[floor]` row of §11**, which is "the ceiling with `sys_to = ∞`" — nothing v1 ships is ever migrated, only extended:
> - the dead-simple **hunch + evidence** leaf (`SENSEMAKING_FLOW.md` §8, Rung 1);
> - the **field-survey intake** + **BYO-LLM extraction** — the two gate-free slices (`SENSEMAKING_FLOW.md` §3–4; the Civics & Elections instrument is the concrete `field_surveys`/`survey_responses` spec);
> - `sensemaking_sessions` · `asset_links` + `content_embeddings`;
> - the append-only, **hash-chained `ontology_events` log carrying the full envelope on day one** (`valid_*`, `sys_*`, `action_type`, and the consent + label + provenance columns of §2) — so bitemporal replay, the label store, and the audit trail are **additive later, never a rewrite**;
> - deterministic structural analytics **with uncertainty bands** + the attribution eval.
>
> Everything past the floor is **`[N-gated]`** on a **measurable threshold** (§11) or the **governance gate #11**; nothing AI-trained ships until the consent lattice (§8) + gate #11 are in place.
>
> **Lock these owner decisions *before* the build session (§12):** the **C2 training-opt-in economics** (#1 — if the eligible fraction is tiny, the "AI-native" premise re-scopes to the small-clean-corpus + eval story), the **response→card mapping** (#5), and **which buyer leads** (#6). Companion build docs: `ORTELIUS_KNOWLEDGE_GRAPH.md` (grounded WS0–5 build order), `SENSEMAKING_FLOW.md`, `SECTOR_MODEL.md`.

**Read this as altitude, not inventory.** Where a capability needs data the program will not produce for years, it is marked **roadmap** and its unlock is a **measurable threshold**, never "when scale demands." Throughout, three tags run in the margin of the argument: **[floor]** ships from cohort one; **[N-gated]** unlocks at a stated data threshold; **[novel]** vs. **[assembled]** says honestly whether a piece is a real contribution or a correct composition of known parts. Every claim here is written to survive an adversarial technical due-diligence, not a design-review committee.

---

## 1. Positioning: the counter-Foundry

Palantir Foundry integrates an institution's data so the institution can **act on a population** — target, adjudicate, operate. The purpose is set by the operator; the data subject is rarely a party. That model is powerful, and for a large and growing set of civic partners it is politically **unbuyable**: the privacy blowback is the product.

Ortelius integrates a community's own field observations so **the community can reason for itself**. The inversion is not a slogan — it is architectural, and it is the whole design:

| Axis | Foundry / Gotham | Ortelius |
|---|---|---|
| Who sets the purpose | the operating institution | **the data subject** (the consent lattice, §8) |
| Direction of action | *on* a population | *for* a community (it maps its own actor-network) |
| Consent | institution-to-institution | **individual, layered, revocable, live-queried** |
| Corpus | proprietary, closed | **MIT / CC-BY commons, PROV-O-interoperable** |
| Provenance | operator-visible lineage | **externally anchored, publicly verifiable** (§4) |
| AI's role | central inference | **proposer inside a human referee; synthetic barred from ground truth** |
| Release privacy | access control | access control **+ small-cell suppression + DP on aggregates + free-text scrub** |

The intellectual spine is **Helen Nissenbaum's contextual integrity**: information shared *to help my community reason about its own problems* is a different norm than the same data flowing *to an institution acting on my community*. Ortelius is built to preserve that context; Foundry is built to transcend it.

**Honest framing to a Palantir architect (this is the credibility move):** Ortelius does not claim to *be* Foundry. Foundry's real moat — heterogeneous data integration, the transform/pipeline lineage graph, ontology branching/merge, marking-based cell-level access control — is not what this is. Ortelius is a **governed decision-and-labeling substrate for a domain Foundry does not serve** (civic frame-innovation), whose provenance and action envelope are deliberately shaped to be **portable into Foundry as an integration source**. Claiming to rebuild the demo-friendly 20% (Objects/Links/Actions) on one Postgres and calling it a Foundry rival is exactly the tell of someone who has not operated one. We say the true thing instead.

### What Ortelius is at the frontier — the thesis

> **Ortelius is a consent-governed, bitemporal, provenance-complete decision substrate for civic sensemaking, in which one append-only event stream is simultaneously the decision ontology, the audit trail, the enrolment ledger, and — for the contributions whose authors opt in — a supervised label store. A dead-simple *hunch-and-the-evidence-for-or-against-it* tool is the floor; the frontier machinery (bitemporal replay, theory-as-math analytics, Bayesian belief calibration, agentic frame proposal) lives behind promotion, opt-in consent, and a governance gate.**

The frontier is not a bigger model. It is that a civic community's own act of making sense of its situation is captured once, cleanly, with consent and lineage, and is thereby usable as decision-support, as an audit record, and as an unusually clean research corpus — without ever being usable *against* the people who produced it.

---

## 2. The one interlock: the event stream is the atlas

The six pillars are not six systems. They are six **readings of one object**. Ortelius records every sensemaking gesture — submit, extract, swipe, second, draw-a-signed-edge, cluster, promote, cast-a-ballot, form-a-pod, propose-a-reframe — as an event in a single append-only stream (`ontology_events`). Each event is, at once:

| Reading | Pillar | The event *is*… |
|---|---|---|
| a **decision** | 1 · decision ontology | a typed, precondition-gated action-type write with a declared write-back target |
| a **bitemporal fact** | 1 · bitemporal store | valid-time (when it held in the field) + transaction-time (when we recorded believing it) |
| a **label** | 2 · label store | a supervised example with an annotator provenance envelope — **eligible for training only if its author granted C2** |
| an **enrolment** | 3 · network science · 4 · epistemics | ANT coalition weight (`weight = f(seconds)`) and a corroboration signal for the belief model |
| an **audit record** | 6 · governance | hash-chained and externally anchored, provable to an outside auditor |

Everything downstream is a **projection** folded from this stream: the property graph (`kg_nodes`/`kg_edges` — the modest MVP's `asset_links` + FK model), the gold-label view, the bitemporal history tables, the network-science metric tables, the belief sidecars, the public atlas. **The bitemporal event log is the label store is the audit trail is the enrolment ledger.** That single sentence is the architecture; the rest of this document is what hangs off it and — critically — what the red-team forced us to *change* about each hanging piece.

### The shared event envelope (the contract every pillar reads)

```
ontology_events(
  event_id            -- total order (bigint identity)
  correlation_id      -- an action + its write-back cascade
  action_type         -- FK to a versioned action-type (code artifact, not a string)
  op                  -- assert | retract | supersede | anonymize
  subject_ref, object_ref            -- (entity_type, entity_id), validated vs. node registry
  payload             -- action args, validated by the action-type's schema
  valid_from, valid_to               -- WORLD time
  recorded_at                        -- BELIEF time (immutable)
  -- annotator / label envelope --
  actor_participant_id               -- null = anonymous public submit (/s/[slug])
  actor_standpoint[]                 -- feeds DIVERSITY, never credibility weight (§5, §6)
  ai_assisted, ai_tool, ai_model     -- human vs. machine-proposed
  confidence, reviewed_by, reviewed_at
  -- governance --
  sector_id, cycle_id
  consent_c1, consent_c2, consent_version   -- commons / training, per-tier (§8)
  purpose             -- purpose-of-access justification, recorded on reads too
  prev_hash           -- hash chain; roots externally anchored (§4)
  schema_version
)
```

This envelope is the cross-pillar contract. `ai_assisted` is where the flywheel's collapse-guard lives (§5). `consent_c2` is where the training/erasure reconciliation lives (§8). `actor_standpoint` is where the equity fix lives (§6). `prev_hash` + external anchoring is where the operator-abuse defense lives (§4). One envelope, and the governance gate is enforced *in the data*, not in a policy PDF.

---

## 3. The scaffolding floor stays dead-simple (the invariant the ceiling never touches)

`SENSEMAKING_FLOW.md` §1 is law, and it applies at the **architecture** layer, not just the UI: a first-timer sees *a hunch, and the evidence for or against it.* Rung 1 writes exactly an `evidence` node, a `hypothesis` node, and one signed (`supports/complicates/refutes`) edge. Everything in §4–§8 — bitemporality, action-types, the label store, min-cuts, belief posteriors, agents — is computed **behind** the member and stored in sidecars. **Nothing the simple tool wrote is ever migrated or rewritten.** Complexity arrives only by the three additive moves (promote a stage · attach a nullable tag · draw an edge).

This is not a nicety; it is what makes the whole thing buildable and safe. The MVP graph (`kg_edges`/`kg_nodes` with `sys_to = ∞` and no history) **is a strict projection of the ceiling** — the read-side of the event stream with transaction-time collapsed. You build the floor exactly as `ORTELIUS §6` specs it; transaction-time comes free the day you add a history table and a trigger; valid-time comes free by defaulting a `tstzrange` to `[now, ∞)`. **The ceiling and the MVP are the same schema at two `sys_to` horizons** — reconciled, not merely compatible. The frontier is unlocked additively and gated; the leaf never pays for it.

---

## 4. Capability 1 — Decision ontology on a bitemporal, audit-grade substrate

**What it is.** The product's mechanics *already are* action-types waiting to be named. We make the decision the primitive (Foundry's Objects · Links · **Action-Types** · Functions decomposition — the shape a Palantir architect recognizes on sight), on an event-sourced, bitemporal core (event sourcing + CQRS, Fowler/Young; SQL:2011 bitemporal, Snodgrass; accretion as in Datomic/XTDB).

**Two clocks, mapped to two real things.** *Valid time* = when a fact held in the field (a regime held 2019–2024; evidence describes the world as observed). *Transaction time* = when we came to believe it (this cohort asserted the edge; a moderator retracted a signal). `AS OF (valid_t, sys_t)` reconstructs "what we believed at `sys_t` about how the world stood at `valid_t`" — which is the exact discipline that (a) lets a late-arriving 2021 observation land at `valid_from=2021, sys_from=2026` without overwriting anything, and (b) lets a training corpus reconstruct the information state available at decision time, so it does not leak hindsight labels.

**Red-team fixes, folded in (not appended):**

- **Feed Foundry, don't cosplay it.** Positioned as a portable source system (§1). We do **not** claim data-federation, pipeline-lineage, or branch/merge that we don't build.
- **Actions and Functions are versioned code, not `text` columns.** The deep-dive's `precondition text` — a stored SQL predicate string — was an injection surface and unversioned business logic. **Cut.** Action-types are code-reviewed, tested, versioned artifacts referenced by ID; the `action_types` table holds only metadata + a pointer to the artifact + a JSON-Schema for `payload`. "Functions" (e.g. `weight = f(endorsements)`) are named, tested compute artifacts, not cached aggregates dressed in Foundry vocabulary.
- **A concurrency model, stated.** The graph is small (10²–10³ nodes per cohort — see §5), so the honest answer is a real one: competing writes on a node are **last-writer-wins-with-supersede** (the prior version's `valid_to` is set; both are replayable), and genuinely mergeable relations (independent edges) simply coexist as separate events. No fictional git-style ontology branching; a documented supersede semantics that a reviewer can reason about.
- **The audit log must survive its own operator.** Trigger-immutability + `REVOKE UPDATE` is rewritable by a DB superuser — it violates the one control (NIST 800-53 **AU-9**, audit protection from privileged users) that matters for a counter-Palantir. **Fix:** events are **hash-chained** (`prev_hash`) and the chain roots are **anchored to external append-only storage** (an RFC-3161 timestamping authority and/or a transparency log — Sigstore/Rekor-style). "We never trained on / never altered X" becomes a **verifiable computation against an anchor the operator cannot rewrite**, not a pinky-swear. Separation of duties: the training-corpus materializer is the only principal with base-table read, runs under `SECURITY DEFINER`, and its output is content-addressed and bound to the manifest by hash (SLSA/in-toto-style build provenance), so the manifest records what the optimizer *ate*, not what the run *declared*.
- **No serving-latency cosplay.** We do not promise sub-second deep bitemporal graph traversal over a live+history union in Postgres, because at this graph size we don't need to. Commit to small-graph rigor; the "operational ontology" claim is honest at 10³ nodes.
- **Consent-safe erasure over an immutable log.** PII is encrypted per-subject (`pii_key_id`); the `anonymize` op deletes the key (crypto-shredding, the standard event-sourcing/GDPR pattern) — but see §8 and §9 for why key-deletion is **not** sufficient anonymization for an n=12 graph, and what we actually do instead.

**Honest ledger.** Event-sourcing, bitemporal SQL:2011, accretion, Zanzibar-style relationship auth for DRI/pod authority, crypto-shredding — all **[assembled]** from mature parts. What is **[novel]** is the *mapping*: that a civic community's sensemaking gestures form a clean set of governed action-types with a bitemporal world-vs-belief semantics, and that the same log is the label store and the externally-anchored audit trail.

**Why it impresses** — *Palantir:* action-types with declared write-back + externally-verifiable lineage is their operating model, spoken honestly as a source system. *Lab:* bitemporal separation of world-time from belief-time is exactly the de-leaking discipline a decision-prediction corpus needs. *Fed:* every state change flows through a typed, precondition-gated, externally-anchored, logged action — the substrate an ATO's AU-/AC-families actually want, versus ad-hoc `UPDATE`s.

---

## 5. Capability 2 — The label store and the small-but-clean corpus engine

**What it is.** Every human gesture is already a supervised label — a swipe is a signal/noise judgment, a signed edge is a relation-valence judgment, a cluster is a must-link constraint, a second is a corroboration. The event stream **is** the labeled corpus, for free, because the product working *is* the labeling. Small task models (extraction, triage, relation, capital/actant tagging, a community-aligned embedding) run in a **batch backend, never in the request path** — honoring "no in-app LLM" — and propose candidates into the *same swipe/second queues members already use*. The AI is a **proposer inside a human referee**.

**The single most important red-team correction — scale honesty.** A cohort is 24–40 people producing thousands of survey rows and sparse gestures; the rarest label (`propose_reframe`) will exist in the **dozens**. This is a **small-data regime**, and Tesla/SAM "data engine" framing is wrong here. We therefore **reframe the moat**: not "a novel large corpus" but **"a small, exceptionally clean, richly-provenanced, consented corpus of civic sensemaking decisions."** Value is in *annotation structure and provenance*, not volume. Concretely, every ML claim is gated:

- **Every task carries an N-threshold and an eval gate.** A model's *semi-automatic* tier (model proposes → human confirms) unlocks for a task only when held-out **macro-F1 ≥ the weak-supervision baseline** at a stated N; its *automatic* tier (model labels overflow, human QA-samples) unlocks only when held-out agreement reaches the **human–human ceiling** and confidence is calibrated. Below threshold, the honest thing runs: **cluster-then-sample + exhaustive labeling of the informative slice**, which at thousands-of-rows is often strictly better than active learning. Active-learning acquisition (uncertainty + a *tractable myopic one-step* value-of-information + diversity/coreset + a stratified exploration quota to prevent sampling bias) is used **only where it beats uniform sampling in an ablation** — not asserted.
- **The annotator model needs engineered overlap, so we engineer it.** Dawid-Skene/GLAD/IRT are unidentifiable on disjoint swipes; they collapse to the prior. **Fix (a data-collection design, not a formula):** plant **gold anchor items** and **forced-redundant swipes** so a controlled subset gets ≥K independent annotations. Only then do we estimate reliability, and we report κ with confidence intervals. Cold-start (cohort one) is explicitly **counts + coverage flags**, not a confusion-matrix model. This is the difference between citing Dawid-Skene and being able to run it.
- **Model collapse is the wrong scare, cut to one true sentence.** Collapse (Shumailov et al., *Nature* 2024) is a *generative*-model, train-on-your-own-outputs phenomenon. We train *discriminative* classifiers with a **hard human-gold filter**: `is_gold := verification ∈ {human_originated, human_confirmed} AND consent_c2 AND split='train'`. The provenance-typed schema's real contribution is not "we defeated collapse" — it is that **we can measure and cap the human/synthetic mix per training batch and structurally bar synthetic content from being promoted to ground truth** (an AI proposal enters as `hypothesis`-tier, `ai_assisted=true`, unweighted; only human seconds give it weight). That is a data-quality control.
- **Resolve the flywheel↔collapse tension honestly.** If AI-mapped overflow never re-enters training, the "flywheel" is *supervised learning with human QA* — safe and unoriginal. We say so. The **compounding** is real but lives in **the accreting human gold across cohorts** (a sector's `annotator_params`, community-aligned metric, and gold labels warm-start the next cohort), not in self-training. Cohort N starts where N−1 finished; that is the honest flywheel.
- **Endorsement ≠ inter-annotator agreement, and seconds are socially contaminated.** A `second` is a biased social signal (herding, cascades), not blinded multi-annotation. We compute IAA only on the engineered-overlap anchor set, and we treat endorsement as *corroboration weight* (§6), never as ground-truth agreement.

**The one genuinely novel piece — and its validation gate.** The **community-aligned metric**: an embedding supervised by *this community's* clustering and seconding, so "distance" means "distance as these practitioners see it," not generic semantic similarity. This is **[novel]** and it is the *least-validated* piece, so it ships behind an explicit test: it graduates only when a **held-out triplet-agreement eval** shows the learned metric predicts held-out community clustering **better than its base encoder**. Named base encoders and their training-data provenance are disclosed in the model card (a sovereignty claim is void if the foundation was scraped without consent — so the base for any in-boundary deployment is a permissively-licensed or in-house model, stated).

**Honest ledger.** Weak supervision, active learning, Dawid-Skene/GLAD/IRT, calibration — all **[assembled]**, and mostly **[N-gated]** or deferred. The community-aligned civic metric is the **[novel]** claim, held behind a validation gate.

**Why it impresses** — *Palantir:* an ontology-bound HITL verification layer with `train_manifest_hash` reproducibility and per-row provenance. *Lab:* a small, de-leaked, provenance-complete, *consented* corpus of sensemaking decisions with a published model-vs-human-ceiling agreement curve — clean is scarcer than big post-*NYT v. OpenAI*, and we don't overclaim it as pretraining-grade. *Fed:* in-house/in-boundary models, no data egress, a held-out human test set that gates deployment, and a published health metric — auditable, sovereign AI.

---

## 6. Capability 3 — Theory-as-math: uncertainty-quantified structural analytics

**What it is.** The three theories become computable. A **regime** is a community/module in the actor-network (Leiden or a Bayesian stochastic block model, for its uncertainty); its **OPP** (Callon's obligatory passage point) is the **min-cut actant at that community's throat**; the regime is held by **reinforcing capital loops** (CCF spiraling rendered as a signed causal loop diagram); and a **reframe** is proposing a *new* OPP to displace it. Each construct is separately computable and they compose into one candidate object handed to humans.

**The decisive red-team correction — the graph is a measured instrument, not ground truth.** Every metric runs on edges (`polarity ±1`, `capital`, `translation_state`, valid-time) that are **hand-coded by volunteers still learning the field** — sparse, non-uniformly sampled, subjectively coded. Min-cut, betweenness, and community structure are exquisitely sensitive to the edges nobody drew and the signs two coders would dispute. This changes the design, not a footnote:

- **Coding is instrumented.** A documented coding protocol; **measured inter-annotator agreement (Krippendorff's α) per edge attribute**, reported, with a floor below which edges are excluded. A **coverage/missingness model** (what fraction of the network is mapped).
- **Every output ships with uncertainty — no point claims.** OPP candidates report a **min-cut stability set** (enumerate near-minimum cuts; the min-cut is non-unique, so we show whether the chokepoint is robust across them or admit it isn't). Communities carry credible intervals from the Bayesian SBM. Centralities are bootstrapped over resampled coders/edges. On a 40–200-node cohort graph, a single edge flip moves everything — so we quantify that, always.
- **The OPP definition is made well-posed.** s = actants tagged `enrolled_actor`, t = `goal_resource`; vertex capacities are the *declared* corroboration weight; and the min-cut candidate is fused with an **epistemic** signal (density of `complicates/refutes` in its neighborhood). A bottleneck that is *also* where the evidence contradicts itself is the algorithmic signature of a Dorstian paradox — **[novel]** as a decision-support *signal*, surfaced as a **hypothesis-generating candidate for human validation**, never auto-asserted.
- **Drop what cannot be honest here.** **LEEA is cut** — Loop Eigenvalue Elasticity Analysis needs a calibrated dynamical model (real rate constants, a Jacobian) that ±1 field-coded signs cannot support; fabricating the parameters would make the eigenvalues fiction. **Pearl `do()`/"counterfactual" language is struck** — cycles (hence FCM) plus correlational coding give no identification strategy; simulation is called simulation. If FCM is used at all for intervention what-ifs, it requires **magnitude weights from a documented elicitation method** and reports the panel-to-panel variance (±1 weights + sigmoid saturate trivially).
- **Standpoint feeds diversity, never credibility (the equity fix, shared with §7).** We do **not** encode that a "field-worker" outweighs a "passing observer" — that is disparate treatment, dominant exactly when data is sparse, and self-declarable. `actor_standpoint` drives a **coverage/diversity metric** ("have we heard from people who work in the field?"), a governance-configurable parameter defaulting to **equal weight**, appealable, with a fairness audit — not a credibility multiplier baked into the math.
- **Targeting guardrails are first-class, and determinism does not exempt them.** In the Civics & Elections seed sector, "the eligibility-verification *standard* is the systemic chokepoint; the highest-leverage move is to displace it" is an influence-operations optics catastrophe the moment the non-human actant is swapped for the institution or person who owns it. **Hard policy, enforced in schema:** structural analysis attaches to **roles, categories, non-human actants** (standards, institutions, infrastructures) — **never to named identifiable individuals** without due process and a **right of reply**; institution/standard designations require **corroboration + right-of-reply** before display; **consequential designations are gated regardless of whether an LLM or a deterministic min-cut produced them** ("advisory + deterministic = ungated" is rejected — determinism buys explainability, not safety). Endorsement counts drive the cut, so **Sybil/collusion resistance is required** (§10), tied to the invite-gated cohort's real identity assurance.
- **The longitudinal claim is powered or downgraded.** "Did this cohort's reframe move the sector's regime?" needs change-point detection (PELT / Bayesian online CPD / Laplacian anomaly detection) over a bitemporal snapshot series — but n is a *handful of cohorts*, and the signal is **confounded by coding intensity** (next cohort maps more edges, so the graph changes because *effort* changed). Bitemporality timestamps *recording*, not *coverage*. **Fix:** the claim is **preregistered, coverage-controlled, and — until powered — labeled hypothesis-generating, not "a number."** Critical-slowing-down early-warning is *not* claimed on ~10 subjectively-coded snapshots.
- **The "grand unification" is demoted.** "Dorst's ascent *is* Meadows' ladder *is* Callon's new OPP" is the most quotable line and the least defensible; as a thesis it invites every domain expert (especially STS reviewers, for whom quantifying ANT is a betrayal of the theory) to dismiss the pillar. It moves to **speculative discussion**, one paragraph, clearly flagged.

**Honest ledger.** Leiden/SBM, min-cut/betweenness, change-point detection, FCM — **[assembled]** off-the-shelf network science. The **[novel]** contribution is narrow and real: *theory-guided, uncertainty-quantified structural analytics on a rigorously-coded small civic graph, whose human validations are a research dataset, delivered as guard-railed decision-support.* No GNN "moat" is claimed — at these label volumes a GNN overfits, and its labels would be circular (trained to reproduce the betweenness heuristic that generated its targets). The GNN is **roadmap**, gated on label volume that may never arrive at single-sector scale.

**Why it impresses** — *Palantir:* explainable, deterministic, decades-battle-tested link analysis (min-cut, betweenness) with provenance and uncertainty — auditable, not a black box. *Lab:* a well-posed, uncertainty-quantified operationalization of STS constructs, honest about identification limits. *Fed:* "where is the systemic chokepoint, with what confidence, and who may we name" answered under explicit misuse guardrails — decision-support that survives a FOIA / civil-liberties review because it never names a person without process.

---

## 7. Capability 4 — Bayesian collective epistemics: "data, not vibes," made a number

**What it is.** Turn `weight = f(count)` into a calibrated belief layer: evidence→hypothesis edges carry a **log-likelihood-ratio** (I.J. Good's weight of evidence), corroboration is a **calibrated posterior from an annotator measurement model** rather than a raw tally, the system computes **what decision-relevant evidence it is missing**, and it **flags credence that outruns evidence diversity**. Glass-box classical inference — no in-app LLM — so every number decomposes into a signed, inspectable ledger tracing to source rows.

**The decisive red-team correction — you cannot calibrate truth that has no label.** Dawid-Skene/GLAD/IRT assume a latent *objective* label. That holds for **"is this extract signal vs noise"** and, marginally, **"is this edge valid."** It does **not** hold for **"is this hypothesis/frame *true*"** — a Dorst frame is *generative and useful or not*, not true/false, and `logit(base_rate)` for "hypotheses being true" has no reference class. So:

- **Rename the central object.** Hypothesis "credence" becomes **decision-relevant support** — a calibrated summary of *how much corroborated evidence, from how diverse a base, backs this node for the decision the cohort must make* (which clusters clear the ballot and the 12-person pod floor). The measurement model (annotator reliability, calibrated corroboration) is applied **only to the well-posed sub-tasks**; **truth-calibration on frames is deleted.**
- **The annotator model rides the same engineered-overlap design as §5.** Without planted gold + forced redundancy, IRT/D-S are unidentifiable at 12–30 people; with it, we estimate reliability and *report the power analysis* proving the blind-confirmation guard and the human-ceiling estimate have detection power at this N. Where correlation must be priced (double-counting: many edges tracing to few independent sources — the provenance chain makes this *observable*), we compute effective sample size over the **observable source-attribution graph only**, and label the annotator-correlation term a **heuristic**, not a full joint covariance we cannot estimate.
- **Overconfidence detection becomes a coverage flag, not a suppression gate.** "High support, low diversity" (few independent sources, or one social bloc) widens the interval and **flags for review** — it does **not** silently block a promotion, because a homogeneous-but-correct expert consensus would be wrongly gated and a distributed adversary games it the other way. Any promotion gate keeps a **human override and a redress path** (§8, §10).
- **VOI is honest.** Full expected-information-gain (nested expectations) is intractable and we do not ship it under a Bayesian label. We ship **myopic one-step EVSI with a closed form** plus the **evidence-type-entropy gap** (a hypothesis supported only by Dorst's `player`/`value` lenses with nothing on `counterfactual`/`boundary` has a structural blind spot — this reads directly off the ontology), and we **validate in simulation that the deployed proxy tracks true EVSI** before claiming it directs collection. **Active-inference / free-energy framing is cut** — it adds nothing over one-step EVSI and reads as decoration.
- **Calibration is censoring-aware or it is not claimed.** Only *promoted* hypotheses get outcomes (pods run, interventions land); the gate and ballot *suppress* the rest, so a naïve reliability diagram is computed on a right-censored, selection-biased sample. We either correct for the censoring explicitly or scope the calibration claim only to sub-tasks with real, uncensored outcomes.

**Honest ledger.** Weight-of-evidence, D-S/GLAD/IRT, one-step VOI, effective-sample-size, calibration — **[assembled]**, textbook, 15–50 years old, and **[N-gated]**. The **[novel]** framing is modest and defensible: applying annotator-measurement + decision-relevant support + evidence-type-gap VOI to *collective civic sensemaking as a first-class product surface*, with the truth-label category error explicitly avoided.

**Why it impresses** — *Palantir:* a decomposable, provenance-complete, effective-sample-size-aware trust ledger over human sensors. *Lab:* scalable-oversight annotator modeling + honest one-step optimal design + a censoring-aware calibration curve, with the "no latent truth for frames" error avoided up front. *Fed:* "grounded in data" becomes an auditable number with a confidence interval, a provenance chain, and a groupthink flag — defensible to an IG, with standpoint reduced to a coverage flag so it clears a disparate-treatment review.

---

## 8. Capability 5 — Agentic Frame Creation and the wicked-reasoning eval

**What it is.** Dorst's Frame Innovation as a **blackboard of specialist agents over the Ortelius graph** (RAG-grounded — GraphRAG fits because Ortelius *is* a typed community-structured graph), where each agent's output is a set of **proposed graph mutations that must cite their evidence spans or are rejected at the write path** (attribution-as-a-constraint, AIS/ALCE-style), and **every proposal enters the same swipe/second queue members already use** — the AI is a proposer, humans are the only validators.

**The decisive red-team correction — lead with what ships from cohort one; demote what needs data we don't have.**

- **Shippable now [floor]:** the **attribution/frame-quality eval** and the **human-vs-model frame-off**. The attribution floor (citation precision/recall + NLI entailment) is machine-checkable and hallucination-sensitive — a credible objective metric available from the first cohort's corpus. The frame-off (held-out real paradoxes → human pods vs. the pipeline → blind expert + LLM-judge Elo, with position-bias controls and a **reported human-agreement κ** on the judge) is the headline experiment, and its honest result is *where models match humans (Themes, Archaeology — scale tasks) and where they don't yet (Paradox, Frames — the creative reframe).*
- **Roadmap, gated, labeled as such:** the **Process Reward Model**. PRM-scale process supervision (PRM800K is ~800k step-labels) is **3–4 orders of magnitude** beyond a civic cohort's output; it may never reach threshold at single-sector scale. It is explicitly future work, its unlock is a stated step-label count, and the pillar does **not** stand on it. The **outcome-grounding axis** (did model frames resembling human-chosen frames correlate with better real outcomes?) needs multiple completed cohorts per sector and a **preregistered causal design with an estimand** — labeled roadmap, not a headline metric.
- **No benchmark circularity.** A strict **train/eval firewall**: **pre-AI human traces are frozen as immutable eval gold**, and **agent proposals never enter the queues that feed benchmark gold**. A benchmark whose gold was co-produced by the models it scores is dead on arrival; this is the fix.
- **Technique honesty.** **Self-consistency on paradox identification is cut** — sample-and-marginalize needs an enumerable answer space; a wicked paradox has none. Replaced with **diversity-sampling + expert adjudication**. Multi-agent debate (mixed replication) is not load-bearing. The **abstain rule is first-class**: insufficient grounding emits an `evidence-gap` node (a survey-distribution target), not a claim.
- **"Non-hallucinating" is not claimed.** A model can cite a real span that doesn't support the claim, and the NLI verifier is itself errorful. The honest posture: **grounded-with-attribution, abstains under low retrieval confidence, with a measured residual error rate** — never "cannot hallucinate," which is a liability the first time it does.
- **Deployment boundary + in-boundary model host.** For any federal offering, the reference agents run on a **government-hosted / in-boundary model** (GovCloud / an authorized boundary), and the member-facing extraction stays BYO-LLM **for the community offering only** — with the explicit caveat (§9) that BYO-LLM is *uncontrolled egress*, not a privacy feature. Marking/consent-tier **propagation through retrieval and summarization** is specified: a GraphRAG community summary inherits the most-restrictive consent tier and marking of its constituent nodes, and a summary that would mix tiers is blocked.

**Honest ledger.** GraphRAG + supervisor + verifier is something a lab builds before lunch — **[assembled]**, and *not the contribution*. The **[novel]** asset is the **data**: a consented, provenance-typed, human-refereed corpus of wicked-problem framing traces, and the *attribution + frame-off eval* that is real from cohort one. The corpus is a moat only to the extent it is clean and un-replicable-without-this-governance — not because it is large.

**Why it impresses** — *Palantir:* an ontology-native, provenance-complete, marking-propagating human-corroboration loop — deployable as a source system, not a rival platform. *Lab:* an un-saturated, hard-to-game, attribution-grounded eval for wicked-problem framing (a capability current models are visibly weak at and no eval measures), shipped with Datasheets/Data Cards/Model Cards and a firewalled gold set — plus a values-in-the-loop split (humans own values, AI provides scale) that fits a Constitutional-AI posture. *Fed:* every synthesized claim traces to consented field evidence, the system abstains rather than fabricates (with a measured error rate), model-training is opt-in and separately governed, and the AI surface sits behind an explicit governance gate.

---

## 9. Capability 6 — The legitimacy layer: consent, provenance, and the moat, honestly

This is the layer that resolves the project's **one load-bearing contradiction**: the flywheel needs training data; decision #14 says "participant data will not be used for model training." As written, mutually exclusive. The resolution is not to pick one — it is to **split "training" into a purpose lattice** and make the two the same sentence, disambiguated by *purpose* and *recipient*.

**The four-tier consent lattice** (extends the survey's existing two consents; purpose-limitation per the NIST Privacy Framework — not GDPR as the primary frame, since this is US civic):

| Tier | Purpose | Default |
|---|---|---|
| **C0 Participation** | submit into this cycle; be seen by cohort + sector | **required** (gates submit) |
| **C1 Commons** | include the *promoted, synthesized* artifact in the open MIT/CC-BY commons | **opt-in**, distinct from C0 |
| **C2 Internal training** | use the contribution to train **models The Labs itself operates**, in-house/in-boundary | **opt-in, hard-fenced** |
| **C3 Contact** | re-contact; mentor pipeline | opt-in |

**Load-bearing choices, each a red-team fix:**

- **C2 is never bundled into C0** (bundling is what makes consent invalid and is an FTC dark-pattern target). A member can contribute fully and decline training with zero degradation. **Anonymous submissions can grant C0/C1 but *cannot* grant C2** — you cannot get valid revocable training consent from an unauthenticated stranger — so anonymous field data is commons-usable and **training-excluded by construction.**
- **`train_eligible` is enforced, not a view a dev can forget.** The deep-dive's "it's a VIEW so there's no bypass" is naïve — a view is not access control. **Fix:** the training corpus is materialized **only** by an attested `SECURITY DEFINER` build service that is the sole principal with base-table read; the output is content-addressed and bound by hash to the externally-anchored manifest (§4). "Prove you never trained on withdrawn/anonymous/third-party data" is a verifiable computation against an anchor the operator cannot rewrite.
- **The C2 promise (member-facing, plain register):** *"If you turn this on, we can use what you share to teach **our own tools** to sort the flood of observations this sector produces — so the next cohort starts further ahead. We will **never** hand your contribution to an outside AI company to train theirs. We will **never** sell it. We will **never** use it to target or profile you or your community. And you can pull it back out."* Three hard "nevers" + one consented "can," enforced in contract, data plane, and audit — scroll-gated (`attachAgreeGate`), per-tier `consent_version`.
- **Withdrawal is honest about its bounds.** Prospective revocation (drop from `train_eligible`) is **guaranteed and immediate**. Retrospective is **bounded, not magical**: models already trained are cleaned at a **scheduled retrain cadence with the row absent by construction** — we do **not** promise verifiable unlearning, and **SISA is not cited as a fix** (it is from-scratch-sharded-training cost reduction, doesn't apply to fine-tuned embeddings, and unlearning is not verifiable). Commons copies already distributed under CC-BY are **irrevocable by license** — stated plainly at C1 signing, never sprung. So the "consent cannot drift" claim is **retired** and replaced with the true one: *prospective-guaranteed, retrospective-bounded, distributed-copies-unreachable* — and we say all three.
- **Privacy on release is specific.** DP is for **count aggregates only** (stated ε, a tracked composition budget per sector, and an honest utility caveat — sparse civic microdata noised at a protective ε makes ward-level rollups weak; the Census DAS analogy cuts both ways). **k-anonymity/suppression** below a small cell size. And the **real re-identification vector — free-text content** ("the guy who runs the polling place on 5th") — gets a **separate named-entity-suppression + human-review pass**, plus a **cohort-size gate**, because deleting a PII key while retaining an n=12 graph's shape and timing is pseudonymization, not anonymization. DP does nothing for the text; we don't pretend it does.
- **Provenance is standards-based and externally verifiable.** W3C **PROV-O** over the lineage (contributions = `prov:Entity`, members/models = `prov:Agent`, sensemaking/extraction/training = `prov:Activity`), serialized as JSON-LD (the Triangulator already exports typed-edge JSON-LD — this elevates it). **C2PA is dropped** except for actual media assets — it is capture/edit provenance for image/video/audio, a category error on text/graph artifacts; a standards-literate fed catches it and it weakens the correct PROV-O adoption beside it.
- **Governance is independent, not self-audit.** An interim **Data Steward** runs the scrub/retrain crons and is the named-accountable human on every training manifest — but oversight adds **external review** (community representatives / a third-party auditor with real authority), because "governance by member exit" is not oversight and §the-withdrawal-bounds already admit exit can't reach distributed copies or trained models.
- **Federal reality, current.** Not "an ATO writes itself" — that line ends the meeting. A named **authorization boundary + impact level** (FedRAMP Moderate/High or a DoD IL), an **SSP skeleton**, control **implementations** mapped to **NIST 800-53** families and a **NIST AI RMF** profile, ConMon, POA&M. **Privacy Act of 1974 + SORN + PIA**; the survey as an information collection implies a **PRA / OMB control number**; possible **Common Rule / IRB** determination; **Federal Records Act / NARA** retention reconciled with the erasure design (tiered retention + legal hold). Policy currency: **EO 14110 was revoked (Jan 2025) and OMB M-24-10 rescinded/replaced (M-25-21/-22)** — we cite the *current* instruments, keep NIST RMF/Privacy Framework/800-53, and drop GDPR as the primary frame.
- **BYO-LLM is named as uncontrolled egress, not sold as privacy.** For the community offering, member-run extraction through the member's own model account means the raw civic text **does** enter a third party, with accountability laundered onto the subject. For any privacy or federal claim, extraction must run on a **self-hosted / in-boundary model** — then it is a real control. We do not claim BYO-LLM as a privacy guarantee.

**Why legitimacy matters — stated correctly.** Legitimacy/governance is a **license to operate** and a **precondition to assembling the corpus**, not itself a moat — it has no switching cost or network effect and is copyable by any competitor willing to do the work. The **actual moat** is the **enrolled community + the accumulated consented commons + institutional relationships**; governance is what lets you assemble that asset *legitimately* and what a competitor cannot shortcut, because a consented, provenance-complete, human-verified, revocable, purpose-fenced civic corpus can only be built *with this governance in place before the data*. In CCF terms, demonstrated trust is **political capital** that compounds and recruits the next cohort and partner; in ANT terms, **consent is the obligatory passage point that enrols the human contributors** — a network enrolled through genuine revocable consent stays assembled, one enrolled through dark patterns de-enrols the moment trust breaks. (These framings are kept to a sentence each — the sociology is a lens, not a load-bearing claim, because to a technical buyer "obligatory passage point" reads as pretension if leaned on.)

**Why it impresses** — *Palantir:* subject-held purpose control + externally-anchored, marking-propagating lineage + defense-in-depth materialization — Foundry's rigor pointed at the market Foundry can't serve. *Lab:* per-example, revocable, provenance-manifested training eligibility — the governance frontier labs are being forced toward, native. *Fed:* Privacy-Act/SORN/PIA-shaped, Census-grade release privacy, current-policy control mapping, in-boundary hosting, and an audit an outside party can verify — the legitimacy a partner needs to touch community data at all.

---

## 10. The governance gate as the obligatory passage point

Gate #11 (`ORTELIUS §5` gap #13) is not a policy PDF — it is an **enforced precondition in the data**. Every `ai_assisted` action carries `gate_flags={'governance_11'}` and is **inert until the gate's artifacts are signed**: the C0–C3 agreement texts (scroll-gated, attorney-reviewed), the data-governance framework (this document, ratified), the **approved-AI-tools allowlist** (C2 data touches only in-house/in-boundary models; extraction host named), human-in-the-loop-always (`reviewed_by` required before any AI output reaches the commons or a member surface — the swipe/second mechanics *are* the HITL at scale), and facilitator training. **The data + consent layer builds ahead; no AI-assisted feature enrols into production until the gate's OPP is passed.** This is the one place all six pillars meet, and it is machine-checkable.

---

## 11. Phased path: the modest Postgres floor to the frontier ceiling

The MVP is not a competitor to the ceiling — it is the ceiling with `sys_to = ∞`. Build order is unchanged from `ORTELIUS §6`; this document only specifies what the tables *grow into*, so WS1/WS2 land the envelope columns (`valid`, `sys_*`, `action_type`, the consent/label envelope) on day one and never migrate the leaf.

| Phase | What ships | Substrate |
|---|---|---|
| **Floor [floor]** | the hunch+evidence leaf; `field_surveys`/`survey_responses`/`sensemaking_sessions`; `asset_links`+`content_embeddings`; the event log as a trigger-populated, hash-chained audit/outbox table beside synchronous projection writes; **deterministic** network-science analytics *with uncertainty bands*; the attribution eval | Postgres + `vector` + `pg_trgm` + `btree_gist`; external anchor for the hash chain |
| **+ Bitemporal** | history tables + valid-time ranges (SQL:2011 pattern); `AS OF` replay | additive; no rewrite |
| **+ Consent lattice** | C0–C3, the attested `train_eligible` materializer, scrub/retention crons, DP-on-counts + free-text scrub | gate #11 WS0 |
| **+ Annotator model [N-gated]** | Dawid-Skene/IRT — **unlocks only when the engineered-overlap anchor set makes κ identifiable**; until then, counts + coverage flags | data-collection design, not new infra |
| **+ Task models [N-gated]** | triage/relation/capital classifiers — a task's semi-automatic tier unlocks **only when held-out F1 ≥ weak-supervision baseline**; automatic tier at the human-ceiling | batch backend |
| **+ Community metric [gated]** | the community-aligned embedding — unlocks **only on the triplet-agreement validation** vs. base encoder | — |
| **+ Agentic frame-off [floor-ish]** | attribution eval + human-vs-model frame-off from cohort one; agents behind gate #11 | in-boundary model host |
| **Ceiling [roadmap]** | log-as-source-of-truth CQRS with a replay-correctness test; PRM process supervision (gated on ~10⁴ step-labels — may require cross-sector pooling); the regime-shift longitudinal claim (preregistered, coverage-controlled, ≥K cohorts); GNN (gated on label volume that may not arrive) | XTDB/Datomic as the honest no-ceiling endpoint |

**The triggers are measurable thresholds, not vibes.** That is the difference between a roadmap and an aspiration in citation clothing.

---

## 12. Load-bearing open questions (owner decisions)

1. **Consent economics — the make-or-break number.** Project the **C2 opt-in rate** after all correct exclusions (unbundled, revocable, anonymous-excluded). If the training-eligible fraction is tiny, the flywheel has no fuel and the "AI-native" premise must be re-scoped to *the small-clean-corpus + eval* story. Decide before building the training path.
2. **The C2 promise wording** — ratify the three-"nevers" + one-"can" string; attorney-bless the retrospective-withdrawal *ceiling* language.
3. **Standpoint: coverage flag vs. governed weight** — confirm the default is **equal weight** and standpoint feeds **diversity**, not credibility (the recommended, review-surviving choice), or ratify an appealable weighted parameter with a fairness audit.
4. **Targeting policy** — ratify that structural designations attach to roles/categories/non-human actants only, that named-individual designation requires due process + right-of-reply, and that consequential designations are gated regardless of determinism.
5. **Response→card mapping** (the pre-existing most-load-bearing gap): does every raw response become a node, or only promoted ones?
6. **Which buyer leads first.** The substrate serves all three, but the *offerings* differ (Palantir: portable source system; lab: the eval/dataset; fed: a hardened in-boundary deployment). Sequencing one avoids satisfying none.
7. **Anonymous retention window** and the **cohort-size floor** below which no per-pod structure is released.
8. **Interim commons custodian** — the Data Steward + *external* oversight, until the deferred Steering Committee exists.

---

## 13. The sharpest risks, and how the design answers each

| Risk | The honest danger | Mitigation, in the design |
|---|---|---|
| **Model collapse** | recursive training on synthetic degrades the corpus | it is the wrong scare for discriminative classifiers with a hard human-gold filter; the real control is **provenance-typed batches that cap synthetic fraction and bar synthetic from promotion to ground truth**; compounding lives in accreting *human* gold, not self-training |
| **Consent / the #14 contradiction** | flywheel vs. no-training promise are mutually exclusive as written | **purpose lattice**: C2 unbundled, revocable, anonymous-excluded, attested-materialized, externally-manifested; the trainable set is honestly the consented subset (and §12.1 forces the owner to size it) |
| **Legitimacy is not a moat** | governance is copyable, no switching cost | reframed: governance is the **license to assemble** the real moat (enrolled community + consented commons + relationships) that a competitor *cannot legitimately shortcut* |
| **Re-identification** | an n=12 graph + free text re-identifies even after key-deletion | **cohort-size gate + small-cell suppression + free-text NER scrub + human review**; DP scoped to count aggregates only, with the utility caveat stated |
| **Targeting / misuse** (elections) | "displace the chokepoint" is an influence-op optic | roles/categories/non-human only; named-individual gating + right-of-reply; **consequential designations gated regardless of determinism** |
| **Endorsement gaming / Sybil / collusion** | astroturf reshapes the min-cut and inflates support | Sybil resistance tied to the **invite-gated cohort's identity assurance**; collusion detection distinct from echo-chamber; cut/credence robustness to adversarial edges reported |
| **Operator abuse** (the counter-Palantir's home turf) | an audit log the admin can rewrite proves nothing | **hash-chain anchored to external append-only storage**; separation of duties; the training materializer is the only base-table reader; the operator-abuse threat model is treated as *the* threat model |
| **Scale honesty** | every ML claim cashes out to "once we have data we don't have" | every ML capability is **N-gated with a measurable unlock**; the floor (leaf + deterministic analytics + attribution eval + the clean corpus) is real from cohort one; the rest is labeled roadmap |

---

## 14. The honest novel-vs-assembled ledger

**Assembled from mature parts (say so):** event sourcing/CQRS, bitemporal SQL:2011, Datomic/XTDB accretion, crypto-shredding, Zanzibar auth, W3C PROV-O; Dawid-Skene/GLAD/IRT, weak supervision, active learning, calibration; Leiden/SBM, min-cut/betweenness, change-point detection, FCM; GraphRAG/supervisor/verifier orchestration; Datasheets/Model Cards/Croissant; NIST RMF/800-53 mapping.

**Genuinely novel (and each held behind a gate, not asserted):**
1. **The unification object** — one externally-anchored event stream that is *simultaneously* decision ontology, bitemporal replay, consented label store, enrolment ledger, and audit trail, for civic sensemaking. The integration is the contribution.
2. **The community-aligned civic metric** — an embedding supervised by *this community's* sensemaking judgments — behind a triplet-agreement validation gate.
3. **Structural × epistemic paradox surfacing** — OPP as min-cut ∩ concentrated complications — as guard-railed, uncertainty-quantified decision-support, not an oracle.
4. **Per-example, revocable, purpose-fenced consent lineage that provably flows into training eligibility** — the clean-corpus governance, verifiable against an anchor the operator can't rewrite.
5. **The wicked-reasoning attribution + frame-off eval**, real from cohort one — with the process-reward and outcome-causal ambitions demoted to clearly-labeled roadmap.

---

**One line.** *Ortelius is the legitimate, participatory, consented, open civic counterpart to Foundry: one consented event stream that a community uses to reason for itself — decision ontology, audit trail, and a small, exceptionally clean label store in the same object — with a dead-simple hunch-and-evidence tool at the floor, the frontier machinery behind an enforced governance gate, and every ambitious claim either shippable from cohort one, unlocked at a measured threshold, or honestly labeled roadmap.*