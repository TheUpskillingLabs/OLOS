# Transfer Progress — OLOS dev vs. the roadmap

**What this is:** a status snapshot of the prototype→OLOS transfer against
`docs/audit/IMPROVEMENT_ROADMAP.md` (v2). Read the roadmap for the *why* of each
item; this doc records *where we are*. Assessed 2026-07-05 against `dev` (through
PR #151); dev history is entirely this workstream (no external contributors to
reconcile). Verified against the code, not memory.

Legend: ✅ done · 🟡 partial · ⬜ not started · ⏳ deferred (deliberate).

---

## Scorecard

| Phase | Status | One-line |
|---|---|---|
| **Phase 0** — hygiene + safety | ✅ (1 item ⏳) | Shipped; only the revocation-cron re-registration is deliberately held |
| **Phase 0.5** — schema hardening | ✅ | Migrations 00037–00039 applied + verified on dev |
| **Pod Squad batch** | ✅ | All 5 memo items shipped |
| **Phase 1** — Learning Log pivot | 🟡 ~70% | Log + gate + Poderator repoint done; milestones, dashboard completion, feed-reader open |
| **Testing pathway** (extra) | ✅ | 00042 — not in the roadmap; admin-granted tester accounts + self-reset |
| **Phase 2** — Directory + Me | ⬜ | Not started |
| **Phase 3** — Learning dest + editorial | ⬜ | Not started (nav still lacks Learning/Directory) |
| **Phase 4** — Formation ceremonies | ⬜ | Not started (`stepped_back` enum reserved in 00037) |
| **Phase 5** — Trust + mentors | ⬜ | Not started |
| **Phase 6** — Data Sensemaker | ⬜ | Not started |
| **Phase 7** — Living Atlas (Ortelius) | ⬜ | Not started |
| **Poderator throughline** | 🟡 | Health-band + blocked tier + orientation card done; process_signals, journey spine, milestone card open |

---

## Done in detail

**Phase 0 (PR #145):** reconciler bypasses fixed (`revocations/check` + `reactivate`
now route through `reconcileEnrollmentActivation`); public RSVP rate-limited
(`ip_hash` + nullable `participant_id`, `lib/api/rate-limit.ts`); doc hygiene
(historical banners on `TUL_MVP_Spec.md` + `OLOS-architecture-brief.md`; stale-tracker
notes); `/api/registrations/short` deleted; rendered "Moderator"→"Poderator" leak
fixed; Vitest + `.github/workflows/ci.yml` (21 tests); Entity Explorer registry gains
`events`/`resources`/`metros`/`cycle_agreements`.

**Phase 0.5 (PR #145):** `00037` (status CHECKs incl. `stepped_back`; `set_updated_at()`
trigger; `search_path` pins + `can_write_cycles()`; 7 indexes), `00038` (`metros.zip_prefixes`
+ FK; `lib/metros.ts` now DB-backed), `00039` (RSVP columns). `pulse_checks.survey_responses`
versioned + strict Zod. Applied + verified on dev.

**Pod Squad batch (PR #146):** `is_staff`/`is_test` (`00041`) + roster hide-toggle;
pod-scoped feedback inbox; workshop sign-ups (over `event_rsvps.participant_id`);
poderator-scoped member PATCH (contact fields only); A-vs-B orientation card restored.

**Phase 1 core (PR #146):** `learning_logs` + `profile_updates` (`00040`); the 3-part
dashboard card; the fixed weekly gate (`learning-log-window` Friday cron arms
`cycle_config.log_due_at`; `learning-log-reminder` repointed; pulse gate retired, Pulse
left the nav, Home carries the log-due pip); Poderator health repoint (`lib/moderator/log-health.ts`
— clarity/alignment averages, blocked-first list in the member's own words, logged/waiting
compliance strip).

**Testing pathway (PR #147–#151):** `testers` (`00042`), self-reset endpoint, admin toggle
(now in the permissions panel), reset-in-avatar-menu, sign-out→home. Not a roadmap item —
built on request to make the onboarding loop testable pre-kickoff.

---

## Open within partially-done work

**Phase 1 remainder (the ~30%):**
- **Milestone logs (wk-7/13):** the `kind` enum exists in `learning_logs`, but there's
  **no prefill UI** and no Poderator milestone card. (Roadmap Phase 1; memo "evaluations in OLOS".)
- **Dashboard completion:** **no** setup checklist, **no** dismissible "Up next" todos,
  **no** "Your commitments" dated rows + `.ics`. The dashboard renders greeting →
  phase rail → Learning Log → pod-join only. (Roadmap Phase 1 item 5; memo "weeks labeled with dates".)
- **The share has no reader:** `learning_logs.share_publicly` **writes** a `profile_updates`
  row, but nothing displays it — no updates feed exists yet. Until the Phase 2 "Me"/Discover
  feed lands, sharing is a no-op to the member. (Not a bug; the reader is scoped to Phase 2.)

**Poderator throughline remainder:** `process_signals` (table + composer — the owner's core
"shepherd, not manager" R&D mechanic) is **absent**; the frame-journey spine, teams drill-down,
and milestone-logs card are absent. Shepherd voice: partial (orientation card added; page
copy pass pending).

---

## Not started (Phases 2–7) — the substance of what remains

- **Phase 2 (Directory + Me):** no `/directory` route, no `§1.8` columns (`handle`, `bio`,
  `public_profile_visible`, `metro_id` FK), no `/u/[handle]` visitor mode, no updates-feed
  reader, no standalone `POST /api/nominations` (still pulse-bundled). `/profile` is still the
  registration read-out.
- **Phase 3 (Learning + editorial):** no authed `/learning`, no `saved_items`+hearts (the
  `.heart` CSS is still ported-but-unused), nav still **Home · My Cycle · avatar** (Learning
  and Directory never added), no `/stories`, no landing stories row, no start-a-waitlist create.
- **Phase 4 (Formation ceremonies):** no ignition interstitial, no project-canvas fields
  (`frame/intervention/success_metrics/evidence`), no step-back route (enum reserved), no
  phase-info ⓘ modals, no `narrative_revisions` case-study approval, no `cycle_mode`.
- **Phase 5 (Trust + mentors):** none — `mentor_profiles`, `mentor_testimonials`, `follows`,
  `citations`, badges all absent.
- **Phase 6 (Data Sensemaker):** none — `field_surveys`, `survey_responses`,
  `sensemaking_sessions`, `problem_situations`, `asset_links`, `content_embeddings` all absent;
  Triangulator not yet integrated; gated on the governance preconditions (decision #11).
- **Phase 7 (Ortelius):** none — foundations wait on Phase 6.

---

## Deferred / infra

- **Revocation-check cron:** route exists, **not** registered in `vercel.json` (awaits the
  ≥48h staging soak after the reconciler fix — roadmap Phase 0 item 7). Only intentional
  Phase-0 hold.
- **`ENTITY_EXPLORER_ENABLED`:** the registry is wired; the env flag is a Vercel setting
  (owner action, not code) — confirm it's on for dev if the explorer should be live.
- **Prod promotion:** dev is at migration `00042`; prod stops at `cycle_agreements`. The
  promotion backlog is `00033`–`00042` (public content → hardening → Learning Log → testers).

---

## Owner-decision queue — current state

Resolved-by-build (defaults chosen, worth explicit ratification): **#2 gate cadence**
(fixed weekly window built), **#3 cutover** (defaulted to the next cycle / kickoff).
Still open and blocking their phases: **#1** pulse-field disposition, **#4** voter eligibility,
**#5** unit of formation, **#6** team caps, **#7** directory default, **#8** survey stack,
**#9** licensing legal review, **#10** resources editor, **#11** Sensemaker governance gate,
**#12** interaction telemetry, **#13** Ortelius pilot scope, **#14** embeddings model.

---

## Recommended next moves

1. **Finish Phase 1** (milestones + dashboard completion) — small, high member-value, closes
   the pivot cleanly.
2. **Phase 2 (Directory + Me)** — gives `profile_updates` its reader (so sharing pays off) and
   lands the biggest missing member surface; the near-free `POST /api/nominations` rides along.
3. **`process_signals`** whenever — independent of everything, and it's the owner's core
   shepherd mechanic.
4. Get **owner decisions #1, #4–6** answered before Phase 4; **#11** before any Phase 6 build.
