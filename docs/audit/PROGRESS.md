# Transfer Progress — OLOS dev vs. the roadmap

**What this is:** a status snapshot of the prototype→OLOS transfer against
`docs/audit/IMPROVEMENT_ROADMAP.md` (v2). Read the roadmap for the *why* of each
item; this doc records *where we are*. Assessed 2026-07-05 against `dev` (through
PR #157); dev history is entirely this workstream (no external contributors to
reconcile). Verified against the code, not memory.

Legend: ✅ done · 🟡 partial · ⬜ not started · ⏳ deferred (deliberate).

---

## Scorecard

| Phase | Status | One-line |
|---|---|---|
| **Phase 0** — hygiene + safety | ✅ (1 item ⏳) | Shipped; only the revocation-cron re-registration is deliberately held |
| **Phase 0.5** — schema hardening | ✅ | Migrations 00037–00039 applied + verified on dev |
| **Pod Squad batch** | ✅ | All 5 memo items shipped |
| **Phase 1** — Learning Log pivot | 🟡 ~90% | Log + gate + Poderator repoint + dashboard done; share-feed reader now landed (Phase 2); only wk-7/13 milestones open |
| **Testing pathway** (extra) | ✅ | 00042 — not in the roadmap; admin-granted tester accounts + self-reset |
| **One-pod/one-project + 12-week model** (extra) | ✅ | PRs #152–#156: `pod_limit` (00043), 12-week rail (wk0 Kickoff→wk12 Showcase), lean mobile registration, brand left-align sweep |
| **Phase 2** — Directory + Me | ✅ | PR #157 — `/directory`, `/u/[handle]`, updates feed, standalone nominations, migration 00044. Profile cred-band + locked badges + links deferred |
| **Phase 3** — Learning dest + editorial | 🟡 nav only | Directory added to app-nav + tab-bar (4 of the 5 tabs); Learning dest, saved/hearts, editorial not started |
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

**Phase 1 remainder (the ~10%):**
- **Milestone logs (wk-7/13):** the `kind` enum exists in `learning_logs`, but there's
  **no prefill UI** and no Poderator milestone card. (Roadmap Phase 1; memo "evaluations in OLOS".)
- ~~**The share has no reader**~~ — **CLOSED by Phase 2 (PR #157).** `learning_logs.share_publicly`
  writes a `profile_updates` row, and the Phase-2 `updates-feed` now reads it — as the community
  "All" feed on `/directory`, member-scoped on `/u/[handle]`, and "Your shares" on `/profile`.
  Sharing now pays off for the member.

**Dashboard completion — ✅ done** (Phase 1 item 5): setup checklist (actionable rows +
"Start →", collapse-to-strip when done), "Your commitments" (the six dated anchor events +
`.ics` download), and dismissible "Up next" cards for the currently-open cycle windows. The
engaged dashboard now renders greeting → checklist → phase rail → Learning Log →
commitments → Up next → pods → past cycles.

**Poderator throughline remainder:** `process_signals` (table + composer — the owner's core
"shepherd, not manager" R&D mechanic) is **absent**; the frame-journey spine, teams drill-down,
and milestone-logs card are absent. Shepherd voice: partial (orientation card added; page
copy pass pending).

---

## Phase 2 — done (PR #157), with tails

Shipped: migration `00044` (`handle` UK + auto-gen trigger + backfill, `bio`, `headline`,
`public_profile_visible` default false, `metro_id` FK — applied + verified on dev), `/directory`
(service-client display allowlist, role chips + search, stretched-link cards), `/u/[handle]`
visitor mode (allowlist-only, zero PII), the shared `member-profile-view` (owner|visitor),
the `updates-feed` reader, widened `PATCH /api/participants/[id]` (bio/headline/handle + 409),
standalone `POST /api/nominations`, and Directory in both nav bars.

**Deferred tails (small):** the profile **cred band** (render the signed Open Cycle Agreement
from the already-readable `cycle_agreements`), **locked-badge states** (Phase 5 supplies the
earning systems; the locked shells were meant to render from Phase 2), and external **links**
on the profile editor. None blocks the directory; all are quick follow-ups.

## Not started (Phases 3–7) — the substance of what remains

- **Phase 3 (Learning + editorial):** no authed `/learning`, no `saved_items`+hearts (the
  `.heart` CSS is still ported-but-unused). **Nav now Home · My Cycle · Directory · Me** —
  Directory landed with Phase 2; **Learning is the one remaining tab.** No `/stories`, no
  landing stories row, no start-a-waitlist create.
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
- **Prod promotion:** dev is at migration `00044`; prod stops at `cycle_agreements`. The
  promotion backlog is `00033`–`00044` (public content → hardening → Learning Log → testers →
  `pod_limit` → directory).

---

## Owner-decision queue — current state

Resolved-by-build (defaults chosen, worth explicit ratification): **#2 gate cadence**
(fixed weekly window built), **#3 cutover** (defaulted to the next cycle / kickoff),
**#7 directory default** (members-only; `public_profile_visible` opt-in, default false —
confirmed + shipped in Phase 2). **#5/#6 partially set** by the one-pod/one-project decision:
`pod_limit` is now a cycle-config value (default 1); team caps (#6) still use OLOS defaults.
Still open and blocking their phases: **#1** pulse-field disposition, **#4** voter eligibility,
**#5** unit of formation (arena shape), **#6** team caps, **#8** survey stack, **#9** licensing
legal review, **#10** resources editor, **#11** Sensemaker governance gate, **#12** interaction
telemetry, **#13** Ortelius pilot scope, **#14** embeddings model.

---

## Recommended next moves

1. **Finish Phase 1** (wk-7/13 milestone logs + the Poderator milestone card) — the last ~10%,
   small and high member-value; closes the Learning Log pivot cleanly.
2. **Phase 2 tails** (cheap): profile cred band from `cycle_agreements`, locked-badge shells,
   external links in the profile editor — round out "Me" now that the directory is live.
3. **Phase 3 (Learning destination + editorial)** — the natural next surface: authed `/learning`
   (route-shell over existing teasers) + `saved_items`/hearts completes the nav to the full five
   (only the **Learning** tab remains), then `/stories` + landing editorial.
4. **`process_signals`** whenever — independent of everything, the owner's core shepherd mechanic.
5. Get **owner decisions #1, #4–6** answered before Phase 4; **#11** before any Phase 6 build.
