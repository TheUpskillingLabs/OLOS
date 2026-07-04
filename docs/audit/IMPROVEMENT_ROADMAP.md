# Improvement Roadmap — the reconciled sequence

**What this replaces:** `docs/PROTO_TRANSLATION_PLAN.md`'s Stage-C list (C1/C7 shipped; C2–C6
re-planned here with current knowledge) and the live remnants of `docs/OLOS-roadmap.md`
(§3.7 Phase C, the AC-gap items, decisions D1–D4 — absorbed below). Grounded in
`docs/audit/DESIGN_INTENT.md` + `docs/audit/GAP_AUDIT.md`. Phases are ordered by
dependency and member impact; each is shippable alone.

---

## Phase 0 — Hygiene + safety (no product change; do first, it's all small)

1. **Fix the two §3.7 reconciler bypasses** — route `revocations/check` (demote) and
   `revocations/reactivate` (promote) through `reconcileEnrollmentActivation`
   (GAP_AUDIT B4). These are the same class of bug that caused the May incident.
2. **Rate-limit the public RSVP** (`/api/events/[event_id]/rsvp`) + add `ip_hash` and the
   spec's nullable `participant_id` — the pre-launch blocker (§8). Same pattern then covers
   future public writes (survey, waitlist).
3. **Doc hygiene:** banner `TUL_MVP_Spec.md` + `OLOS-architecture-brief.md` as historical
   (FastAPI never existed); update `PROTO_TRANSLATION_PLAN.md` stage statuses (C1/C7 shipped,
   `.theme-legacy` gone) and point its Stage-C section here; sync `OLOS-roadmap.md` §6;
   errata the backend doc's column names to the as-built ones (GAP_AUDIT B1 drift note).
4. **Retire `lib/metros.ts`** — funnel zip→metro assignment reads the real `metros` table.
5. **Delete `/api/registrations/short`** (dead endpoint) and fix the rendered "Moderator" leak
   (`moderator/cycles/[cycle_id]/vote-progress/page.tsx:135` → "Poderator").
6. **Bootstrap tests + CI:** Vitest + a GitHub Actions workflow running
   `lint + build + tests`. First targets (per `lib/auth/CLAUDE.md`): `resolveUserRoles`,
   `fulfillInvitation`, `reconcileEnrollmentActivation`, and the finalize tally math.
7. **Re-register the revocation cron** in `vercel.json` once the staging soak passes
   (roadmap §3.7 Phase C's last step) — after item 1 lands.

## Phase 1 — The Learning Log pivot (the deepest conceptual change)

Replaces pulse-check as the weekly practice ritual (proto CLAUDE.md: "replaces the Practice
Journal, and the Pulse before it"). Migration path in GAP_AUDIT A3: pulse history stays
private and untouched; new cycles write `learning_logs`.

1. **Schema:** `learning_logs` (clarity/alignment 1–5, `is_blocked` + `blocker_context`,
   accomplished/exploring/next_focus, `share_publicly`, `kind` weekly|milestone_7|milestone_13)
   + `profile_updates` (with `learning_log_id` provenance) — backend §6/§1.9. No per-day
   unique index ("unlimited logs" is intent).
2. **Member UI:** the 3-part card on the dashboard (sliders + blocked toggle / three prompts /
   live share preview) — keep OLOS's post-save confirmation card (better than the prototype's
   silent reset).
3. **The gate, corrected to intent:** fixed weekly window (cron arms `log_due_at` per cycle,
   Friday close) replacing the rolling personal 7-day timer; instant unlock + "You're back
   in ✓"; admin grace/pause toggle (the prototype's Testing-Controls twin). Reuse the existing
   layout-redirect gate mechanism — it's already right.
4. **Poderator repoint:** health bands read clarity/alignment averages (sentiment, not just
   compliance); needs-attention gains the **blocked-first tier with the member's own words**;
   keep the at-risk/nudge/dismissal machinery as the quiet-logger tier.
5. **Dashboard completion:** setup checklist (visible Start →, collapse-to-strip), dismissible
   "Up next" todos (on `nudge_dismissals`), "Your commitments" dated rows + `.ics` from the
   Luma-synced anchor events (also closes the C1 signed-screen `.ics` tail).
6. Owner calls needed before build: see Decision queue #1–#3.

## Phase 2 — Directory + Me (the Connect layer, minimal credible launch)

1. **The RLS decision (load-bearing):** keep `00020` tight; serve `GET /api/directory` +
   `GET /api/profiles/[handle]` via service client with an explicit display-column allowlist.
   Raw `participants` RLS never widens over PII.
2. **Schema:** §1.8 columns (`handle` UK, `bio`, `public_profile_visible` default false,
   `metro_id` FK reconciling `metro_slug`).
3. **Routes:** `/directory` (cards, mentor-filter chips ready but empty until Phase 4, metro
   search — backend already live) and `/u/[handle]` visitor mode reusing the profile
   component read-only.
4. **Me:** widen the existing Mode-A/B edit pattern (bio/headline/handle/links) rather than
   rebuild; profile gains the cred band (Build Cycle agreement — `cycle_agreements` already
   readable), updates feed (from Phase 1 shares), locked-badge states (earning signals come
   later — "trust is earned" renders honestly from day one).
5. **Near-free win:** standalone `POST /api/nominations` decoupled from pulse-checks (table +
   RLS already live) → the directory card's Nominate button.

## Phase 3 — Learning destination + editorial

1. Authed `/learning` (events + library + saved) — mostly a route-shell over existing teasers.
2. `saved_items` table + hearts (the `.heart` CSS is already ported; add the affordance to
   `MediaFrame` + `POST/DELETE /api/saved`).
3. App nav completes to the prototype's five: Home · My Cycle · Learning · Directory ·
   Me-avatar (Pulse leaves the nav when Phase 1 moves the ritual to the dashboard).
4. Public editorial: `/stories` + landing stories row (hardcoded spotlights first, like
   `about/`), share-your-story modal → `story_submissions` (clone the feedback-widget
   pattern), landing survey-CTA + situations strip when their backends exist.
   Also: **start-a-waitlist** (`POST /api/labs` create-metro, city-first per the owner rule —
   the join half already shipped; this is the create half with `created_by` provenance).
5. Resources authoring: register `resources`/`events`/`metros` in the entity-explorer as the
   stopgap admin; real CRUD editor only if non-eng authoring becomes real (backend §4's own
   framing). Change `resources.from_line` → `project_id` FK while the table is empty
   (`00036`) — cheap now, expensive later; it powers the commons flywheel.

## Phase 4 — Formation experience layer (the pipeline works; give it its ceremonies)

1. **Ignition:** register response returns `{activated:true}` at `project_min` → full-screen
   interstitial + "Your project" pinned card.
2. **Project canvas:** §1.10's four proposal columns (frame/intervention/success_metrics/
   evidence) — the project already FKs its winning proposal, so the canvas renders with no
   new storage; open-seat visualization; request-a-mentor block lands with Phase 5.
3. **Step-back / leaving well:** add `stepped_back` to the reconciler's model FIRST, then
   `POST /api/cycles/[id]/step-back` + rejoin through it; Poderator sees it; gate stops
   chasing (GAP_AUDIT B4's "next risk site" done safely).
4. **Phase-info ⓘ modals** (pure copy — timing exists, meaning doesn't) + a home for the
   "✨ Naming projects…" beat around the finalize POST.
5. **Case-study peer approval** (`narrative_revisions` + the approve route, thresholds per
   backend §2) → unlocks the public Work pages (`/projects` `/pods` `/people` — public by
   artifact, private by process) once approved artifacts exist.
6. `cycles.cycle_mode` (§2b) so future closed cycles skip the Open-Cycle commons terms the
   ceremony currently assumes.
7. `problem_situations` + Triangulator provenance only when Phase 6 gives situations a source.
8. Owner call needed: Decision queue #4–#6 (voter eligibility, formation arena, caps).

## Phase 5 — Trust + mentors

`mentor_profiles` (+ `verified_by_labs` — resolves roadmap D3 toward a separate table),
mentor intake flow (publishes immediately, no queue), `mentor_requests` (evidence-first,
API-enforced), `mentor_testimonials` (requested-only state machine), `follows` + the updates
Following filter, `citations` (domain allowlist), badge derivations (QA-verified / client
endorsed / commons contributor — each lands with its earning system; locked states already
render from Phase 2).

## Phase 6 — Survey → Triangulator (the Contribute + Sensemake stages)

`field_surveys` + `survey_responses` (anon-capable, `/s/[share_slug]` public submit — reuse
the Phase-0 rate-limit pattern), the public survey flow + share screen, `sensemaking_sessions`
(JSONB) replacing Triangulator localStorage, pool ingest keyed to the cycle's field survey,
`problem_situations` provenance completing Phase 4.5. This stage carries the most §10 open
questions — settle moderation/retention/mapping before build (Decision queue #8).

## Poderator throughline (lands piecewise)

Phase 1 → health-band + blocked-tier repoint. Phase 4 → journey spine + teams drill-down
(formation context), milestone-logs card. Phase 5 → member-drawer mentor flag. Plus, any
phase: `process_signals` (§6b — table + composer + prefills; the owner's core shepherd
mechanic, independent of everything else), pod-scoped feedback inbox (`feedback` table
already exists), shepherd voice pass on page copy.

## Deliberate-deviation ledger (OLOS is better — ratify, don't "fix")

| Deviation | Why keep |
|---|---|
| OAuth read-only email in the funnel | Already ratified (Stage B precedent) |
| LLM project/pod naming (Claude) | The real version of the prototype's deterministic fake — prototype says so itself |
| 13-week `CyclePhaseIndicator` rail | Exceeds the prototype's week rail |
| Withdraw-to-switch on project registration | Prototype is join-once; withdraw is kinder |
| Post-save confirmation card (vs silent reset) | Clearer feedback |
| `nudge_key` re-firing dismissals; persisted roster filters | Stronger than session-dismiss |
| Server-enforced ballot lock (409) + blind voting window | Prototype's confirm-modal is UI-only |
| Timestamp-derived phase windows | Exactly what backend §1.10 recommended |
| Server-component reads instead of the spec's `GET /api/events|resources` JSON APIs | Next.js-native; add JSON routes only when a non-page consumer appears |

**Consciously deferred (small, no phase):** `events.cycle_week`/`cycle_id` + the admin
event-annotation route (revisit when anchor-event↔week-rail wiring needs them);
`metros.display_order`; a dedicated `onboarding_tasks` table if the Phase-1 checklist's
simpler persistence proves insufficient; Delivery Facilitator + Client Sponsor roles (land
with their Phase-5 badge systems).

## Owner-decision queue (blocks marked phases; everything else proceeds)

1. **Pulse fields with no Learning-Log home** — keep/drop `energy_level`, `highlight`,
   `tailwinds`, `tools_used`, `benefits`, `new_connections`, in-pulse nominations (Phase 1).
2. **Gate cadence** — confirm fixed weekly window + admin grace/pause replaces the rolling
   7-day timer (Phase 1).
3. **Cutover timing** — Learning Log starts with the next cycle vs mid-cycle switch (Phase 1).
4. **Voter eligibility** (backend §10-Q1) — everyone-with-budgets (proto: 5/3) vs
   submitter-only (OLOS today) (Phase 4; config knobs already exist for either).
5. **Unit of formation** — prototype's one cycle-wide arena vs OLOS's ≤2-pod parallel arenas;
   also pod-size band (12–30) enforcement (Phase 4).
6. **Team caps** — proto 3–5 per team / 4 projects vs OLOS defaults 7/8 (cycle-config value).
7. **Directory default** (§10-Q8) — `public_profile_visible` opt-in confirmed? (Phase 2).
8. **Survey stack** (§10-Q2/3/4/5) — response→card mapping, moderation posture, anon
   retention (Phase 6).
9. **Licensing legal review** (§10-Q12) — MIT + CC BY 4.0 + typed-name signature are already
   encoded in code/copy; legal sign-off still open (pre-launch for real members).
10. **Resources editor** (§10-Q7) — entity-explorer stopgap vs real CRUD editor day one
    (Phase 3).

## Already done (for the record)

Design system app-wide · onboarding funnel (Stage B) · cycle ceremony C1 (`00031/00032`) ·
public content C7 (`00033–00036`, landing flip, Luma sync + crons) · moderator pulse
dashboard · admin (config/invitations/participants/permissions) · login popup · cities
search + `/local-labs` · every.org donate popup · §3.7 reconciler + Phase A/B.
