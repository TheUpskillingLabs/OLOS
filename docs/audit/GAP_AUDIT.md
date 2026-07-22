# Gap Audit — prototype intent vs OLOS reality

**How to read:** every row compares the prototype's design intent (see
`docs/audit/DESIGN_INTENT.md`) against what OLOS actually ships. Verdicts:
`parity` (intent holds) · `partial` (some of it) · `missing` (none of it) ·
`diverged-better` (OLOS exceeds the prototype — candidate for a ratified deviation) ·
`diverged-worse` (OLOS contradicts the intent). Audit date: 2026-07-04, dev @ PR #144.
Produced by six side-by-side deep reads of both repos; prototype refs are `onboarding-proto`
paths, OLOS refs are this repo.

---

## Part A — Surface audit

### A1. Landing + public content (mostly shipped this cycle)

| Feature | Verdict | Notes |
|---|---|---|
| Landing `/` (hero → cycles → workshops → library → labs w/ leading search) | parity | Highest-risk flip (public landing replacing the login redirect) done and public-safe (`app/page.tsx`, `proxy.ts`) |
| Stories row on landing + `/stories` page + share-your-story submissions | missing | `app/page.tsx:26` defers it; no `spotlights`/`story_submissions` tables (HANDOFF §8 parked). Feedback widget (`00029` + `/api/feedback`) is the ready-made template for the concierge submission write |
| Public situations strip (cycle accountability, UX F3) + ungated survey CTA | missing | Both landing-section gaps; survey CTA blocked on §1.2/§1.3 backend |
| `/events`, `/library`, `/local-labs` (+slugs), `/about`, `/build-cycles` | parity | Events diverged-better: live Luma sync (`00035`, cron) vs the prototype's static cache |
| The Work public layer `/projects` · `/pods` · `/people` | missing | Public-by-artifact pages; need `narrative_revisions` (peer approval) + opt-in portfolio columns first |
| Cards are teasers w/ real pages; browse free; email-only RSVP | parity | ~~RSVP has **no rate limiting**~~ **RESOLVED 2026-07** — `ANON_RSVP_LIMIT=5/hr` via `lib/api/rate-limit.ts` (verified by VIBE_SCAN_2026-07) |

### A2. Funnel + auth

| Feature | Verdict | Notes |
|---|---|---|
| Google-auth explainer → role intent → 5-screen signup → scroll-gated agreement | parity | Stage B port; OAuth read-only email is the ratified diverged-better precedent |
| Login as popup over the launching page | parity | `app/@authmodal/(.)login` (July 2026) |
| Cycle ceremony: threshold → questions → Open Cycle Agreement → signed | parity | C1; `cycle_agreements` (`00032`) §3.7-safe. Missing tail: `.ics` download + pod-chooser handoff on the signed screen |

### A3. Home / dashboard — Learning Log vs pulse-check (the deepest conceptual gap)

OLOS has **no `learning_logs`** anywhere; the shipped system is the pulse-check the Learning
Log is designed to replace (proto CLAUDE.md: "replaces the Practice Journal, and the Pulse
before it").

| Feature | Verdict | Notes |
|---|---|---|
| Part 1: clarity + alignment sliders (1–5) + "I'm blocked" toggle → "what do you need?" | diverged-worse | OLOS has one `energy_level` scalar + prose `blockers` (`pulse-check-form.tsx:340-426`) — the structured two-axis health signal and the blocked-alert primitive don't exist |
| Part 2: three mad-libs prompts (figured out / exploring / next focus) | diverged-worse | OLOS is a ~10-field weekly survey (7 textareas + tools + benefits + connections + nominations) — the prototype deliberately cut to 3 prompts to kill friction |
| Part 3: share-to-feed preview + toggle → `profile_updates` | missing | Pulses are 100% private; no share pipeline, no updates feed anywhere |
| Unlimited logs, reset-on-save | partial | 1/day unique index (`00004`) caps it; OLOS's post-save confirmation card is arguably better than the silent reset |
| Weekly HARD gate + instant unlock | parity (mechanism) / diverged (cadence) | OLOS gate is real and app-wide (`(dashboard)/layout.tsx:73-93` redirect + lock overlay) — but keyed to a **rolling personal 7-day timer** off `last_pulse_completed_at`; intent is a **fixed weekly window** (cron-armed `logDueAt`, Friday close) + admin grace/pause toggle |
| Milestone logs wk-7/13 (`kind` variants, prefilled, never grades) | missing | No `kind` column, no prefill-from-history |
| Setup checklist (visible Start →, collapse to "All done ✓" strip) | missing | Dashboard has no onboarding checklist; the placeholder-name gate (`layout.tsx:49-56`) could front the profile row |
| "Up next" todos (phase-aware, dismissible) | partial | Phase-window chips exist (`cycle-phase-indicator.tsx:358-379`) but nothing is dismissible; `nudge_dismissals` (`00023`) is the ready primitive |
| "Your commitments" dated rows + anytime `.ics` | missing | No anchor-event commitment list, no `.ics` anywhere; Luma-synced `events` is the natural source |
| Week rail | **diverged-better** | `CyclePhaseIndicator` (12-week rail, milestones, live progress, window chips) exceeds the prototype — keep |
| No public composer; LL shares are the only update source | parity by absence | OLOS never had a composer; build `profile_updates` fed only by LL shares from day one |

**Migration path (from the deep read):** keep `pulse_checks` + history untouched (authored
under a private contract — never backfill into a public feed); new cycles write
`learning_logs`; field-map `accomplishment→accomplished`, `blockers→blocker_context` (+infer
`is_blocked`), `challenge→exploring`; `next_focus`/`clarity`/`alignment` net-new; seed the
first gate window from `last_pulse_completed_at`; repoint the reminder cron. `energy_level`,
`highlight`, `tailwinds`, `tools_used`, `benefits`, `new_connections`, in-pulse nominations
have **no Learning-Log home** — each needs a conscious keep/drop call (owner queue).

### A4. My Cycle / formation

| Feature | Verdict | Notes |
|---|---|---|
| Solution proposal submit / UPSERT / edit prefilled | parity | OLOS richer: window buffers + warning banner (`solutions/page.tsx:37-52`) |
| Budget ballot lock ceremony (locks on cast, no per-voter attribution) | parity | OLOS enforces server-side (409) + blind voting during the window |
| **Voter eligibility** | **diverged-worse (policy fork)** | Prototype: everyone votes, submitters 5 / others 3 (`app.js:95,378`). OLOS: **submitter-only**, exactly `project_submitter_votes` spent (`project-votes/route.ts:117-129`). `non_submitter_votes` exists in config but wires to the problem-statement vote. Owner decision §10-Q1 |
| Tally: cap math + threshold + ranked winners + naming beat | parity | Identical cap formula; OLOS names via Claude (`lib/llm/names.ts`) — the real version of the prototype's fake. No home yet for the "✨ Naming projects…" beat (tally is an admin POST, not a phase) |
| Project self-registration + caps + one-per-cycle | parity | OLOS adds withdraw-to-switch (better). Default caps differ: proto 5 max/4 projects vs OLOS 7/8 (`00001`) — config knob, needs a cycle-config decision |
| Team ignition moment | missing | forming→active transition exists as data (`register/route.ts:124-131`) with zero ceremony; the register response can return `{activated:true}` |
| Project canvas (frame/intervention/metrics/evidence, open seats, case study, mentor request) | missing | Biggest formation build gap. `projects` already FKs the winning proposal, so §1.10's four columns flow in with no new storage |
| Problem situations (read-only voted-in history, Triangulator provenance) | partial | OLOS collapses situation into problem_statement+pod; no `problem_situations` table |
| Step-back / leaving well / rejoin | missing | No route, no `stepped_back` status; reconciler union doesn't model it — must be added THROUGH the reconciler (§3.7) |
| Pod chooser + sizing bands 12–30 | partial | OLOS caps pods-per-member (≤2), never pod size; different axis |
| Phase info ⓘ modals | missing | Pure copy; OLOS shows timing everywhere but never meaning |
| Phase dispatch from admin controls | parity | Timestamp-derived windows (`advance-phase`), exactly what backend §1.10 predicted |

**Structural fork (owner-level):** the prototype's formation is **one cycle-wide arena**
(cohort = the pod); OLOS runs **N parallel pod-scoped arenas** (join ≤2 pods, per-pod
proposals/ballots/tallies, cycle-wide team registration). The prototype is the richer
*experience* spec; OLOS the richer *pipeline*. The gap is mostly presentational (ceremonies,
canvas, copy) plus two genuine policy forks: voter eligibility and the unit of formation.

### A5. Learning + saved + stories

| Feature | Verdict | Notes |
|---|---|---|
| Authed `/learning` destination (events + library + saved) | missing | `app-nav.tsx:18-19` documents the deferral; teasers + queries already exist — mostly a route-shell job |
| Saved items / hearts | missing | No `saved_items` table; `.heart` CSS ported but dead (`globals.css:457-461`) |
| Events/resources data contracts | parity | The data layer is done; the gap is UI-only |
| Resources authoring (backend §4 CMS admin) | missing | Content only enters via seed migration; `resources`/`events`/`metros` not even registered in the entity-explorer |

### A6. Directory + Me

| Feature | Verdict | Notes |
|---|---|---|
| `/directory` route + member cards + filters | missing | The single largest surface gap; blocker is RLS, not UI |
| Members-only visibility | diverged-worse (blocks everything) | `00020` = SELECT own row + pod-mates + admin. Recommended: keep `00020` tight; serve `GET /api/directory` via service client with an explicit **display-column allowlist** — never widen raw-table RLS over PII |
| Visitor mode (`/u/[handle]`) | missing | No `handle` column; `GET /api/participants/[id]` is own-or-admin only |
| Owner profile (badges, citations, cred band, updates, portfolio) | diverged-worse | `/profile` is a registration read-out, not the credential surface; the Mode-A/B edit pattern is solid — widen it, don't replace it |
| Follows / testimonials / vouched / citations / mentor CTA | missing | Whole trust layer: `follows`, `mentor_profiles`, `mentor_testimonials`, `citations` all absent |
| Nominations | diverged-worse | Table + insert RLS live (`00017`) but the ONLY write is bundled inside a pulse-check; `POST /api/nominations` doesn't exist — a thin decoupled route away from parity |
| Metro search in directory | partial | Backend fully shipped (`00033`); no page to host it |

### A7. Poderator

| Feature | Verdict | Notes |
|---|---|---|
| Copy-to-clipboard AI bundle, **no in-app LLM** | parity | Verified definitively: clipboard-only (`ai-summary-block.tsx:46,169`) — exact rule match |
| Pod switcher + all-pods rollup | diverged-better | KPIs + persisted last-view exceed the prototype |
| Roster (filter/sort/persist) + at-risk nudges + dismissals | diverged-better | `nudge_key` re-fire model is stronger than session dismiss |
| Health bands | diverged-worse | Bands measure **compliance** (missed pulses), never **sentiment** (clarity/alignment) — a Poderator can see who's quiet but not who's stuck |
| Needs-attention: blocked-first with the member's own words | partial | At-risk only; no blocked tier, no process-signal prefill |
| Process signals (the R&D loop) | missing | The owner's core shepherd mechanic — design-only (§6b); no table/route/UI |
| Frame-journey spine + Teams drill-down | missing | Phase resolver + guidance prose exist in `lib/moderator/` but the spine/teams views don't |
| Compliance strip (avatars, gate pip) / member drawer (intake, scoped edits, mentor flag) / milestone card / pod feedback inbox | partial→missing | Drawer exists as pulse-review only; no intake context, no scoped edits, no mentor flag; no milestone or feedback views |
| Shepherd framing/voice | missing | Page copy is neutral-operational; persona identity carried only by nav chrome |
| **Naming leak** | violation | `vote-progress/page.tsx:135` renders visible "Moderator" — the one rendered-copy leak (rule: UI says Poderator) |

### A8. Admin

| Feature | Verdict | Notes |
|---|---|---|
| Cycle config editor + phase advance (Testing Controls) | parity | Timestamp-window model |
| Invitations, participants + permissions | parity | |
| Aggregate-only vote progress | parity | Lives on the moderator route |
| Learning-Log gate toggle (arm/clear `logDueAt`) | missing | N/A until the Learning Log lands; becomes the admin twin of the weekly cron |
| Entity Explorer | partial | Fully coded, default-OFF flag; new content tables unregistered |

---

## Part B — Backend audit

### B1. Spec-item matrix (OLOS_BACKEND_CHANGES § → OLOS state)

| § | Item | OLOS state | Verdict |
|---|---|---|---|
| 1.1 | `metros` | `00033` | partial — column drift (`st/partner/members/waiting_baseline` vs spec `state_abbr/library_partner/display_order/created_by`); no `created_by`, no `cycles.metro_id` FK, no `POST /api/labs` create-metro |
| 1.1b | `metro_waitlist_signups` | `00033` + `/api/metros/[id]/waitlist` | built |
| 1.2 | `field_surveys` | — | missing |
| 1.3 | `survey_responses` (anon-capable) | — | missing (grep hits are the `pulse_checks` JSONB column) |
| 1.4 | `sensemaking_sessions` | — | missing (Triangulator persistence still localStorage-only) |
| 1.5 | `onboarding_tasks` + progress | — | missing |
| 1.6 | `events` Luma cache | `00033`/`00035` | partial — column drift (`api_id/img/location_name` vs spec names); no `cycle_week`, no `cycle_id` FK |
| 1.7 | `resources` | `00033` (`00036` emptied it) | partial — `from_line` text instead of `project_id` FK (breaks the commons-provenance flywheel), `author` text not `author_id` |
| 1.8 | participants `handle/bio/public_profile_visible/metro_id` | — | missing (`metro_slug` string ≠ `metro_id` FK) |
| 1.9 | `profile_updates` | — | missing |
| 1.10 | `problem_situations` · proposal rich columns · `narrative_revisions` · `citations` | `00018` shipped the UPSERT key only | missing (all four) |
| 2 | config knobs | `00001`+`00026` | partial — no `pod_max` (30 cap) |
| 2b | `cycles.cycle_mode` | — | missing |
| 2c | `cycle_agreements` | `00032` + agreement route | **built, §3.7-correct** (insert-inactive-only) |
| 2c | step-back route + `stepped_back` status | — | missing (reconciler union doesn't model it) |
| 3 | Luma module + cron | `lib/integrations/luma.ts`, `vercel.json` | built |
| 3 | `event_rsvps` | `00033` | partial — spec's nullable `participant_id` and `ip_hash` both dropped; **route unthrottled** |
| 4 | resources CMS API + admin | — | missing; not in entity-explorer registry either |
| 5 | `mentor_profiles` + `mentor_testimonials` (resolves roadmap D3) | — | missing |
| 6 | `learning_logs` + weekly-window gate + milestone kinds + poderator reads | — | missing (the pivot) |
| 6a | `mentor_requests` + `follows` | — | missing |
| 6b | `process_signals` | — | missing |
| 7 | `GET /api/directory` + `GET /api/profiles/[handle]` | — | missing (RLS `00020` blocks members-wide reads) |
| 8 | `/` public landing | `app/page.tsx` | **built** (the doc's highest-risk item) |
| 8 | public paths for `/stories /projects /pods /people /s/* /u/*` | — | missing |
| 8 | Delivery Facilitator + Client Sponsor roles, `projects.qa_verified` | — | missing |
| 8 | **rate limiting / `ip_hash`** | `lib/api/rate-limit.ts` | ~~missing~~ **RESOLVED 2026-07** — anonymous RSVP throttled (`ANON_RSVP_LIMIT=5/hr`) |

**Cross-cutting flag — column-name drift:** `events`/`resources`/`metros` shipped with
prototype-data.js-shaped names, not the spec's names. The drift is fine (the tables predate
any consumer) but the spec doc should be errata'd so future code isn't written against the
paper names. The one drift with real cost: `resources.from_line` (text) instead of
`project_id` (FK) — provenance can't power the commons flywheel (project page ↔ library
cross-links, the Commons-contributor badge) as text.

### B2. RLS posture

- `participants`: SELECT self + shared-active-pod + admin (`00020`) — **blocks the directory**;
  recommended fix is a service-client directory query with a display-column allowlist, NOT a
  broader raw-table policy (PII: email, phone, zip, notes).
- `cycle_enrollments`: writes admin-only — the §3.7 guardrail working as intended (forces
  service-role through the reconciler).
- Formation tables: authenticated-wide SELECT, self-write via `current_participant_id()`.
- `cycle_agreements`: self-read, service-role-write only, insert-only. Correct.
- Public content (`00033`): anon SELECT published rows; `event_rsvps` write-only.
- `pulse_checks`: self + admin; poderator reads go through service-role routes — the same
  pattern `learning_logs` reads will need.

### B3. Write-path map (prototype `saveUserState()` sites → OLOS endpoints)

Exists today (7): ballot cast, project register, pod register, role intents, nomination
(pulse-bundled only), profile edit, cycle agreement.
Missing (~13): follow/unfollow · learning-log save+share · update delete/edit · member todo
dismiss · step-back · rejoin · survey response · mentor request · mentor intake · testimonial
request/cancel/hide · saved/heart.

### B4. §3.7 reconciler-constraint compliance

- Compliant: reconciler itself; agreement route (insert-inactive-only); registration +
  interest inserts (creation is allowed).
- ~~**Violation 1:** `app/api/revocations/check/[cycle_id]/route.ts` — direct demote~~
  **RESOLVED 2026-07** — both revocations routes now call
  `reconcileEnrollmentActivation()` (verified by VIBE_SCAN_2026-07).
- ~~**Violation 2:** `app/api/revocations/reactivate/[participant_id]/route.ts` — direct
  promote~~ **RESOLVED 2026-07** — same.
- Soft: `lib/auth/invitations.ts:103` upserts `active` then immediately reconciles
  (self-correcting; documented).
- Next risk site: the unbuilt step-back route — `stepped_back` must be added to the
  reconciler's model first.

### B5. Engineering health (repo-wide)

| Item | State |
|---|---|
| Tests / CI | **None** — no runner, no `.github/`, scripts are dev/build/start/lint only |
| `revocation-check` cron | Route exists, **not registered** in `vercel.json` (roadmap §3.7 Phase C awaits staging soak) — the cron that once mis-revoked ~75% of a cohort |
| Dead code | `POST /api/registrations/short` route removed; its orphaned `short-registration.ts` schema + the unused `POST /api/registrations` deleted 2026-07 (vibe-scan Tier 1); `.heart` CSS unused; 5 pre-existing lint errors |
| `lib/metros.ts` | ~~Still wired into the funnel~~ **STALE 2026-07** — reads `metros.zip_prefixes` and only suggests; hardcoded zip map retired (see VIBE_SCAN_2026-07 CT2 for a live bug in the same path) |
| Placeholder-name debt | `Unknown` rows from the abandoned spreadsheet migration still gated by `lib/participants/placeholder.ts` |
| Stale docs | `TUL_MVP_Spec.md` + `OLOS-architecture-brief.md` describe a FastAPI/pyjwt backend that never existed; `PROTO_TRANSLATION_PLAN.md` marks shipped stages (C1/C7) deferred and references the deleted `.theme-legacy`; `OLOS-roadmap.md` §6 tracker self-admittedly wrong |

---

## Appendix A — Pod Squad memo crosswalk (June 22, 2026)

The moderators' wish-list memo, mapped to this audit. Notable: the prototype was partly
designed in response to this memo (its CLAUDE.md tags staff/test hiding "memo ask"; the
Poderator orientation card is called "the A-vs-B answer"). The memo's **General question**
(is OLOS a moderator CRM (A) or a participant experience system (B)?) is answered by the
design intent: **B** — member-first, Poderator-as-shepherd; the fact the question had to be
asked confirms the audit's "shepherd framing missing" finding, and argues for restoring the
in-product orientation card the PRD cut.

### Direct hits (memo ask ↔ audit finding ↔ roadmap home)

| Memo ask | Audit finding | Roadmap |
|---|---|---|
| Rename pulse check to convey required | The Learning Log pivot — the gate *enforces* required | Phase 1 |
| Mid/end-cycle evaluations in OLOS, non-redundant, beside pulse data | Milestone log kinds, **prefilled from the member's own logs** | Phase 1 |
| Quick pulse-compliance visibility | Compliance strip (avatar roll-call) — partial/missing | Phase 1 |
| Pod → project drill-down during build | Teams drill-down + journey spine — missing | Phase 4 |
| Problem/project statements visible in real time | Journey spine carries real artifacts — missing | Phase 4 |
| Hide staff/volunteers/test users | `visibleMembers()` intent; `is_staff`/`is_test` absent | Pod Squad batch |
| Access participant-experience feedback | Pod-scoped feedback inbox (table exists, no view) | Pod Squad batch |
| Upskiller basic-info overview | Member drawer intake context — partial | Poderator throughline |
| Non-devs making small data edits | Poderator-scoped PATCH (contact/pod only) — missing | Pod Squad batch |
| Weeks labeled with dates | "Committed dates stay findable" — dated rows + rail labels | Phase 1 |
| Skills/availability to balance teams; spot future mentors | `ai_experience_level`/`availability_snippet` exist; mentor-flag missing | Phases 1/5 |
| "Pulse Insights confusing, not actionable" | Health bands measure compliance, never sentiment/blocked | Phase 1 |

### New items the memo adds

| Ask | Disposition |
|---|---|
| Workshop sign-ups visible to moderators | New view over `event_rsvps` (Luma sync already lands the data) — Pod Squad batch |
| Project-level *engagement* (not just rosters) during build | Sharpens Phase 4: Learning-Log/milestone status pivots by project membership in the build phase |
| Cross-cycle tracking for funding requests | Rollup views — `DATA_ARCHITECTURE.md` §5 |
| Direct DB access if dashboards lag | The dormant Entity Explorer is the safe answer — flag-on in Phase 0 |

### Tension requiring an owner call

**"Surface data on frequency of platform interaction (OLOS and ideally Slack)"** conflicts
with the constitution (shepherd not manager; faltering is process data, never a member
record). The design's position: the gate enforces, the Poderator gets sanctioned signals
(compliance, blocked-with-own-words, milestone status) — not activity telemetry. Escalated
to the roadmap's owner-decision queue rather than silently built or silently dropped.
