# Vibe Scan — recurring AI-coding defect patterns, codebase-wide

**What this is:** a systematic scan of the codebase for the defect classes that keep
showing up in fixes — unlinked parallel configs, seed data displayed as live,
duplicate derivations, create-vs-edit asymmetries, duplicate actions. The deliverable
is an **inventory of weirdness plus the decision questions we need answered to
simplify** — not fixes. Scan date: 2026-07-15, dev-lineage @ `5377f4d`.

**How to read:** each finding cites `file:line` evidence, the user-visible symptom,
a severity, and the product question that unblocks simplification. Verdicts:
`CONFIRMED` (read the code, it disagrees/duplicates) · `DOCUMENTED-BRIDGE` (the
duplication is a declared, intentional migration bridge — the question is *when it
retires*, not whether it's a bug) · `REFUTED` (suspected, checked, fine).

Companion docs: [`GAP_AUDIT.md`](GAP_AUDIT.md) (2026-07-04 — intent-vs-reality;
partially stale, see §Ledger) · [`../feedback-running-list.md`](../feedback-running-list.md)
(hands-on testing feedback #1–#11 + July-11 triage).

## Executive summary

Six domain passes produced **38 distinct confirmed findings (16 high severity)**
and cleared ~15 suspects as refuted or as documented, intentional bridges.
Verification: the four highest-impact claims were independently re-read from
source before inclusion (`project_min` silent strip; archived projects joinable;
waitlist "waiting" count structurally 0; pod-vs-project register guards), and two
findings were independently reported by two scanners each (C1/AD1, C2/PP-bridge).

The five headline discoveries, all live today:

1. **C1 — an admin's "Project min members" edit silently does nothing** (schema
   strips the field; the save still says "Saved").
2. **LL1 — the Poderator health dashboard runs on the retired pulse-check
   system**, so members diligently filing the *enforced* Learning Log can show as
   at-risk, and pods can band "critical," off a signal nobody is asked to send
   anymore.
3. **CT1 — every public waitlist-lab card shows 0 people waiting**, because the
   count reads a column that is never set for waitlist labs (the very fix that
   made member counts live got the waitlist half wrong).
4. **C3 — Cycle 4 members will see Cycle 3's dates** on the commitments card,
   join ceremony, and `.ics`: the hardcoded anchor-events constant was supposed
   to be replaced by the `cycle_events` table, which exists, is seeded — and is
   read by nothing.
5. **CT3/LL3 — "how many members" has four different answers** depending on which
   page you're on, because each count site independently re-decides whether
   staff, test, inactive, and archived people count.

The dominant *root causes* match the suspected patterns: half-finished
migrations (bridge built, consumers never repointed: C3, LL1, C9), per-surface
re-implementations of one concept (counts, windows, join buttons), and
create-side surfaces that never got an edit-side twin (cycle fields, events,
onboarding answers, pulse thresholds).

---

## The pattern taxonomy (grounded in fix history)

| # | Pattern | Canonical past instance |
|---|---|---|
| P1 | Configs/stores that do the same job but aren't linked | Registration hours stored in `cycle_agreements.answers` while the profile read a separate availability list (`77b318a`); project follow wrote `project_subscriptions` while the feed read `follows` (`aebcb70`) |
| P2 | Display values that are dummy/seed data, not calculated | Homepage lab counts read hand-set `metros.members` — DC showed 312 vs 62 real (`9763c5f`); prototype dates shipped in `anchor-events.ts` (`0968d93`) |
| P3 | Same thing calculated multiple ways in multiple places | Metro label computed at 6 join sites → "Washington, DC, DC" (`5460f11`); vote budget derived independently in ballot and server (`779da15`) |
| P4 | Over-complicated logic | Directory tab snap-back from stale searchParams adoption (`04eaf0a`); `.single()` throwing on missing config instead of a clear message (`779da15`) |
| P5 | Config editable in one place but not another | Cycle theme copy hardcoded until `cycle_config.theme_description` (`c3cdd32`); Register CTA vanishes when a cycle flips `active` though the join route still accepts it (feedback #1) |
| P6 | Duplicative actions/buttons | Duplicate composer-less feed in the directory; two follow mechanisms; redundant log-due alert (`aebcb70`) |
| P7 | Over-broad permission gates / scope confusion *(emergent from fix history)* | Pod pulse data exposed via a globally-granted permission — fixed three times on the same page (`3d55574`, `04eaf0a`, `aee0bdf`); `/admin/org` absorbed lab cycles (`8201b58`) |
| P8 | Stale/archived data still surfacing *(emergent)* | Archived metros still returned by public queries (`7aaa8cb`) |

---

## Findings

> Populated by the 2026-07-15 scan (six domain passes: cycles/windows,
> pods/projects/votes, participants/auth/roles, counts/labs/content,
> learning-logs/moderator, admin/owner/validations). Ranked within each pattern by
> severity: **high** = users see wrong data or are blocked · **med** = inconsistent
> behavior/UX · **low** = maintainer-only risk.

### Domain: cycles / schedule / windows

**C1 · [P5] · high · CONFIRMED — Admin's "Project min members" edit is silently discarded** *(live bug, spot-verified)*
`cycle-config-form.tsx:322` sends `project_min` in the config PATCH, but `updateCycleConfigSchema` (`lib/validations/cycles.ts:17-57`) has no `project_min` key; the non-`.strict()` zod object strips it, so the save 200s without writing. This is a recurrence of the exact bug class the schema's own comment (lines 38–42) says was fixed for phase markers in #247. `project_min` is load-bearing: `lib/projects/shortlist.ts:38,42`, `app/api/projects/[project_id]/register/route.ts:100,134`, `lib/projects/finalize.ts:96,104`.
*Symptom:* admin edits project-min, sees "Saved", DB keeps the old value; shortlist caps and registration minimums run on stale config.
*Question:* fix is one line — but should the schema also become `.strict()` (or gain a form↔schema test) so a fifth silently-dropped field can't recur?

**C2 · [P1] · high · CONFIRMED — Second write path into cycle windows skips the phases sync**
`lib/cycles/schedule.ts:8-11` claims "one write path, zero divergence risk": the config PATCH (`app/api/cycles/[cycle_id]/config/route.ts:72-85`) writes `cycle_config` then `syncPhasesFromConfig()`. But the testing tool `advance-phase/route.ts:124-127` writes the same columns directly and never syncs. Since `checkWindow` is phases-first (`lib/auth/windows.ts:67-87`), advancing a phase via Testing Controls leaves the real gate on the stale `cycle_phases` row.
*Symptom:* tester "opens" a phase, testing tab shows it open (it reads raw config, `testing-controls.tsx:31-46`), but participants' submits 403 "not currently open."
*Question:* patch `advance-phase` to sync too, or pull forward Stage 2 (phases as the sole write authority) so there's structurally one writer?

**C3 · [P2] · high · CONFIRMED (bridge never completed) — Hardcoded Cycle-3 anchor dates will show wrong data to Cycle-4 members**
`lib/cycles/anchor-events.ts:19-71` has six hardcoded Jul–Oct 2026 events with no `cycle_id`, consumed by `dashboard/cycle-commitments.tsx` (takes zero props) and `cycles/[cycle_id]/join/ceremony.tsx:232` (page is cycle-scoped, data isn't). Migration `00086` created and seeded per-cycle `cycle_events` — but **nothing reads that table** (zero `.from("cycle_events")` call sites).
*Symptom:* Cycle-4 registrants will see Cycle 3's dates/venues on the commitments card, the join ceremony, and the `.ics` download.
*Question:* who wires the two consumers to `cycle_events` before Cycle 4 opens — and does the constant then get deleted?

**C4 · [P8] · high · CONFIRMED — "Begin closing" collapses the member dashboard, contradicting the code's own status semantics**
`lib/cycle/labels.ts:17-22,36-38` documents `closing` as "still-alive teal" (grouped with live statuses), and close-out side effects fire only on `archived`/`closed` (`lib/cycle/closeout.ts:9-11`). But every operating-cycle resolver checks `status === "active"` only: `lib/cycle/active.ts:46`, `dashboard/page.tsx:99` (gates Learning Log section, pod CTAs, milestones), `cycles/page.tsx:73-75` (phase timeline), `lib/learning-logs/baseline.ts:141,157`.
*Symptom:* the moment an admin clicks "Begin closing," members lose the phase timeline, the Learning Log section, and pod CTAs — though pods haven't dissolved.
*Question:* is `closing` supposed to be live (`status IN ('active','closing')` everywhere) or a deliberate wind-down that hides the dashboard — and whichever way, which artifact (resolvers or badge convention) gets corrected?

**C5 · [P5] · high · CONFIRMED — Cycle core fields are write-once**
`POST /api/cycles` accepts name/slug/start_date/end_date/mode/sector_id/lab_id (`app/api/cycles/route.ts:36-156`); `app/api/cycles/[cycle_id]/route.ts` exports only GET; no other route touches those columns; the admin workspace renders name and dates as plain text (`admin/cycles/[cycle_id]/page.tsx:542-553`).
*Symptom:* a typo'd cycle name or wrong date can only be fixed by a raw DB update.
*Question:* is cycle identity intentionally immutable, or should a PATCH exist for at least name/slug/dates — and with what guardrails once a cycle is active (dates drive week math)?

**C6 · [P3] · med · CONFIRMED — Canonical cycle resolver exists but has zero production callers**
`lib/cycle/active.ts:39-51` `getOperatingCycle` is called only from its test. `cycles/page.tsx:73-75` inlines the same filter; `dashboard/page.tsx:88-97` has its own `pickCycle` closure; the admin workspace queries inline a third shape (`page.tsx:244-252`). The file's comment excuses only the org-cycle inlining.
*Symptom:* maintainer-only today (all agree); any rule change (new status — see C4! — or lab exclusion) must be repeated in 3+ places.
*Question:* make the helpers the only call path, or accept inlining for pages that already hold the full cycles list?

**C7 · [P3] · med · CONFIRMED — Four independent "which window is open" computations**
(1) `checkWindow` (phases-first), (2) `registrationWindow`/`deriveRegistrationWindow` (`lib/cycles/schedule.ts:212-258`, phases-first, own fallback), (3) `cycle-phase-indicator.tsx:81-115` (config-only), (4) `testing-controls.tsx:25-49` (config-only). (3)/(4) are display-only, but they're exactly what makes C2 user-visible: the display can say "open" while the gate says "closed."
*Question:* should the two display surfaces go phases-first as well (same fix closes C2's visible half)?

**C8 · [P7] · med · CONFIRMED — Window gate never checks cycle lifecycle status**
`lib/auth/windows.ts:35-102` rejects `mode === "org"` but never checks `cycles.status`; no caller pre-checks it. Combined with the testing tool writing fresh future timestamps, writes could succeed against an archived cycle's dissolved pods.
*Question:* should `checkWindow` reject non-live cycles outright, mirroring its org-mode rejection?

**C9 · [P1] · low · DOCUMENTED-BRIDGE — `LAB_TZ` constant vs dead `metros.timezone` column**
`lib/cycles/lab-time.ts:18-21` is honest ("until metros.timezone ships"), but 00086 already added and populated the column and nothing reads it. A non-ET lab would silently get DC windows.
*Question:* wire the column before any non-ET lab launches, or drop it until then?

**C10 · [P4] · low · CONFIRMED — Phase boundaries encoded 3× inside the phase indicator**
`cycle-phase-indicator.tsx:144-145` re-inlines week→phase boundaries (`<=3 ? 1 : <=7 ? 2 : 3`) instead of reading the `WEEKS[].phase` table defined at lines 33–52; the `PHASES[].weeks` labels ("0–3"/"4–7"/"8–12", lines 54–58) are a third hand-synced copy.
*Question:* none needed — derive `currentPhaseNum` from `WEEKS`; the labels could also be generated.

Refuted in this domain: admin `.single()` by-id fetches (scoped by PK, fine); cycle-workspace tab sync (correct server-resolve + `history.replaceState` pattern); no stray hardcoded date literals beyond `anchor-events.ts`.

### Domain: pods / projects / voting

**PP1 · [P8] · high · CONFIRMED — Owner-archived projects remain joinable** *(spot-verified)*
`app/api/projects/[project_id]/register/route.ts:20-28` fetches `project.status` but never validates it — contrast the pod route's explicit `["forming","active"]` allowlist (`app/api/pods/[pod_id]/register/route.ts:67-69`). The register-projects page also lists projects with no status filter (`register-projects/page.tsx:91-96`) and only disables Join on member-count (`project-registration.tsx:187-201`).
*Symptom:* a participant can register into a project an owner archived (`status='inactive'`).
*Question:* none really — the project route should mirror the pod route's allowlist; the question is only which statuses count as joinable.

**PP2 · [P6] · high · CONFIRMED — Pod join/withdraw duplicated with divergent failure behavior AND divergent status filtering**
Same endpoint, two clients: `dashboard/pod-join-section.tsx:54-76` checks `res.ok` but shows nothing on failure (a profile-incomplete or lab-mismatch 403 silently no-ops), label "Withdraw"; `register-pods/pod-registration.tsx:70-124` shows error/success banners, label "Leave". New: the dashboard filters pods client-side to `forming|active` (`pod-join-section.tsx:38-41`) while register-pods applies **no status filter** (`pod-registration.tsx:34-53`) — the shared GET (`api/cycles/[cycle_id]/pods`) doesn't filter either, so dissolved pods show a live Join button there (server 400s after the click).
*Symptom:* failed joins look like nothing happened on the dashboard; dissolved pods look joinable on register-pods.
*Question:* should both surfaces share one join/withdraw hook + one pod-list filter so behavior can't drift?

**PP3 · [P5] · med · CONFIRMED — Pod editing fragmented across ~6 endpoints; GET exposes fields nothing can edit**
Name (`/api/pods/[pod_id]/name` — admin or pod moderator) · status forming→active only (`/api/admin/pods/[pod_id]` — admin or lab lead) · member contact edits (`/api/pods/[pod_id]/members/[participant_id]`) · member add/remove (`/api/admin/pods/[pod_id]/memberships[...]`) · moderators (`/api/pods/[pod_id]/moderators`) · archive (owner console). Pod GETs return `slack_channel_id`/`drive_folder_id`/`github_repo_url` which **no PATCH accepts** (`api/pods/[pod_id]/route.ts:14-17`).
*Symptom:* capability discoverability — who can change what about a pod depends on which of six surfaces you know about; integration fields are read-only ghosts.
*Question:* are the integration fields awaiting auto-provisioning (per the invariant note in `admin/pods/[pod_id]/route.ts:33-63`) or missing an edit surface? And does pod administration eventually get one home?

**PP4 · [P7] · med · CONFIRMED — Lab members can't vote on NULL-metro problem statements but can join the resulting pods**
`api/problem-statements/[cycle_id]/route.ts:23-32` scopes a lab member's visible statements to their own metro only (no OR-null branch), while finalize tags pods from those statements with `lab_id` from the statement's metro, and NULL-lab pods are joinable by everyone (`api/pods/[pod_id]/register/route.ts:50-65`).
*Symptom:* a lab member is excluded from voting on statements whose pods they may later join.
*Question:* intentional grandfathered-bucket design, or should NULL-metro statements be votable by all (mirroring NULL-lab pod joinability)?

**PP5 · [P2] · low · CONFIRMED — Missing `cycle_config` row: display shows caps, enforcement skips them**
`api/projects/[project_id]/register/route.ts:110` skips the max-cap check entirely when config is missing; the display route hardcodes fallbacks `project_min || 3, project_max || 7` (`api/projects/[project_id]/route.ts:60-61`).
*Symptom:* (edge case) UI says "max 7" while the server enforces nothing.
*Question:* one shared config-with-defaults reader for caps?

**PP6 · [P4] · low · CONFIRMED — `.single()`→`maybeSingle()` hardening reached only 2 of 6 phase pages**
`propose`/`vote` pages got the fix + explicit "cycle not configured" message (779da15); `register-pods/page.tsx:19`, `register-projects/page.tsx:26-32`, `solutions/page.tsx:28`, `solution-vote/page.tsx:26-32` still `.single()` with a generic fallback message.
*Question:* none — finish the pattern.

**PP7 · [P5] · low · CONFIRMED — Chartered projects can be created with names the rename endpoint then rejects**
`charterProjectSchema` (`lib/validations/workstreams.ts:54-67`) caps 40 chars with no word limit; the rename route reuses the pod schema's ≤3-word rule. Voted projects are fine (LLM generates ≤3 words).
*Question:* same naming rule at charter-time, or drop the word cap on rename?

Refuted in this domain: vote-budget drift (779da15 holds — budget derived from config at each authoritative site, client takes `isSubmitter` from server; no orphaned config field); cap-field confusion (`pod_limit`/`pod_min`/`project_min`/`project_max` each read where they belong, consistent active-member filters); conflicting pod-status writers (transition sets don't overlap); pod view page (both past exposures fixed with comments; open RLS on rosters is documented design).

### Domain: learning logs / pulse / Poderator

**LL1 · [P1+P8] · high · CONFIRMED — Poderator's primary health signal still runs on the retired pulse-check system**
The Learning Log replaced pulse enforcement (`pulse-check/page.tsx:58-60` — "never a lock"; no pulse cron in `vercel.json`; no dashboard link to `/pulse-check`). But the Poderator's band/trend/at-risk math is 100% `pulse_checks`-derived: `lib/moderator/pod-detail.ts:296-319`, `lib/moderator/rollup.ts` (`pulsingThisWeek`/`atRisk`/`engagementTrend`), `lib/moderator/pods-list.ts:130-236`. Learning-log compliance (`lib/moderator/log-health.ts`) is only an additive secondary card feeding nothing into the bands or nudges.
*Symptom:* a member diligently filing enforced weekly Learning Logs can show as `late`/`at_risk` with a "critical" pod band, and at-risk nudges can fire — because the primary metric never reads `learning_logs`.
*Question:* repoint band/trend/at-risk onto Learning Log completion, or is pulse deliberately kept as the compliance signal? Neither code nor docs states an answer (GAP_AUDIT A3 is stale here).

**LL2 · [P3] · high · CONFIRMED — Poderator "logged this window" ignores `cycle_id`, disagreeing with the gate it describes**
`lib/moderator/log-health.ts:71-78` queries `learning_logs` by participant + lookback with **no `.eq("cycle_id", ...)`**, while the member gate scopes per-cycle (`lib/learning-logs/gate.ts:100-107`, rule documented in `gate-logic.ts:20-26`).
*Symptom:* the avatar strip can show a member green from a log filed against a different cycle (dual-enrolled core contributors) while that member is actually locked at their dashboard.
*Question:* none — add the cycle scope to match the gate's attribution rule.

**LL3 · [P3] · high · CONFIRMED — Staff/test exclusion applied on pod detail but not on the all-pods list or rollup**
`lib/moderator/pod-detail.ts:248-258` deliberately filters `is_staff_or_test` before band math; `lib/moderator/pods-list.ts:109-120` and `lib/moderator/rollup.ts:104-121` never join those flags (confirmed no reference in 6 rollup files).
*Symptom:* the same pod shows different band/missing counts on the all-pods list vs its detail page whenever it contains a staff/test account — the exact noise the detail view was built to hide (and a direct Pod Squad memo ask).
*Question:* none — apply the same exclusion; the question is whether an "active member" definition should live in one shared helper (see also counts findings).

**LL4 · [P5] · med · CONFIRMED — Pulse-band and at-risk thresholds are DB-configurable with no admin UI**
`cycle_config.pulse_band_warning_min/critical_min/at_risk_consecutive_misses` (00026) have zero form fields anywhere in `app/` — SQL-only tuning. Code defaults match migration defaults (no drift).
*Question:* is per-cycle tuning needed (add to the config form), or is this dead config surface to remove — especially if LL1 retires pulse-based bands entirely?

**LL5 · [P3] · low · CONFIRMED — Reminder cron hand-rolls eligibility instead of importing `eligible.ts`**
`app/api/cron/learning-log-reminder/route.ts:95-115` re-implements the eligible+already-logged predicate that `eligibleLogCycles`/`resolveGate` encapsulate — the fourth copy of logic that was consolidated precisely because "three call sites used to drift" (`eligible.ts:3-12`).
*Question:* none — consume the helper.

Refuted in this domain: `log_due_at` vs milestone-week clocks (different questions, both internally consistent — at most a UX labeling issue); `eligible.ts` is genuinely single-source at all three call sites; milestone weeks consistent across form/readers/defaults; "Moderator" copy leak fixed, no new leaks; moderator routes properly pod-scoped (`requireModeratorForPod`), vote-progress intersects scoped ids with the cycle.

### Domain: participants / profiles / auth / roles

**PA1 · [P5] · high · CONFIRMED — Placeholder-name guard missing from problem-statement submission**
`requireCompleteProfile()` is wired into votes, learning-logs, pulse-checks, pod register, solution-proposals, project-votes, leadership-logs — its own doc comment (`lib/participants/placeholder.ts:11-14`) lists "the submission-endpoint guards" — but `app/api/problem-statements/route.ts` has no import/call.
*Symptom:* a placeholder-named account can publish a problem statement rendered as "Unknown Unknown" to the whole cycle — the exact leak the guard prevents everywhere else.
*Question:* none — add the guard (or document the exemption).

**PA2 · [P5] · high · CONFIRMED (nuanced) — Onboarding data that can never be seen or edited again**
Two related holes: (a) six columns (`gender`, `dcpl_info`, `participation_commitment`, `volunteer_interest`, `text_updates`, `photo_video_consent`) hold real migrated survey answers (`scripts/migration/column_mapping.csv`) but appear in no profile, admin, or edit surface, and `participantsUpdateSchema` (`.strict()`) rejects them; (b) the join ceremony collects three free-text answers (`theme_interest`, `learning_goals`, `professional_goals` → `cycle_agreements.answers`, `ceremony.tsx:69-89`) that are **never read anywhere** — the agreement GET omits `answers`, and the entity explorer deliberately excludes it.
*Symptom:* members give thoughtful answers that vanish; poderators never see intake context (a direct Pod Squad memo ask).
*Question:* surface these on profile/poderator drawer, or stop asking? Who owns the keep/drop call per field?

**PA3 · [P2] · med · CONFIRMED — Long-form registration route is dead code with a DB-violating schema**
Nothing calls `POST /api/registrations` (the live funnel uses `/api/registrations/funnel` + `funnel-registration.ts`). The dead route's `registrationSchema` allows `ai_tool_familiarity` 0–10 while the DB CHECK is 1–5 (`00001:88`) — any future caller 500s on boundary input. `lib/validations/short-registration.ts` is similarly orphaned (its route was deleted).
*Symptom:* maintainer-only today; a trap for the next bulk-import script.
*Question:* delete the dead route + schemas, or fix and keep them?

**PA4 · [P1] · med · CONFIRMED — `staff`/`tester` exist in the authority model but no grant path writes them**
`AuthorityRole` includes `staff`/`tester` with `canGrant()` rules (`lib/auth/grants.ts:37-38,88-92`), and the access console renders a "Core contributors & testers" section from `participant_roles` (`admin/access/page.tsx:70-71,297-298`) — but the actual admin actions write `participants.is_staff` (`api/admin/staff-flag/route.ts:36`) and the `testers` table (`api/admin/testers/route.ts:31,42`) directly, and migration 00065's forward-sync triggers don't cover them.
*Symptom:* the access console's staff/testers section can never populate from the real grant actions; two vocabularies for the same status.
*Question:* route staff/tester through `grantRole()`, or remove them from `AuthorityRole`/the console until then?

**PA5 · [P3] · low · CONFIRMED — Role-intent labels drift between signup and profile edit**
The same stored values get four independent literals: `funnel-registration.ts:7-8`, `participants-update.ts:98`, funnel `ROLE_OPTIONS` ("Attend events & workshops"), profile-edit `ROLE_INTENTS` ("Community").
*Symptom:* a member who picked "Attend events & workshops" sees it rendered as "Community" when editing.
*Question:* none — hoist one shared `{value,label}` list.

**PA6 · [P3] · low · CONFIRMED — Handle slugify: DB and JS mirrors diverge at the 40-char boundary**
`slugify_handle()` (00044) trims dashes then truncates; `lib/participants/handle.ts:11-20` truncates then trims — a trailing hyphen can survive only on the DB side. The file header says "keep the two in sync."
*Question:* none — align the order next touch.

Refuted/reclassified in this domain: `OWNER_EMAILS` runtime overlap (scripts-only since 00066 — but `lib/auth/CLAUDE.md:410,422` still documents the retired env-var owner bootstrap, contradicting its own "Owner is not self-serve" section 40 lines up — doc fix needed); role-vocabulary trio is documented and cross-referenced except the staff/tester gap (PA4); availability hours bridge is live and correct (agreement route mirrors into `participant_options`).

### Domain: admin / owner / validations (cross-cutting)

**AD1 · [P5] · high · CONFIRMED — Silent-strip audit: `project_min` is the only live drop (= C1), rest of the schema surface is clean**
Full form↔schema diff across `lib/validations/`: announcements, spotlights, surveys (settings + questions), workstreams, weekly-messages, name-edit, and all log schemas are symmetric or `.strict()` (a wrong key 400s instead of silently dropping). The one live hole is `project_min` (C1). `revokeInvitationSchema` is exported but unused (route parses no body).
*Question:* adopt `.strict()` (or a form↔schema test) as the house rule for the remaining non-strict schemas, so the next added form field can't silently strip?

**AD2 · [P5] · med · CONFIRMED — `resources` (and `events`) archivable via owner console but with zero create/edit surface**
`lib/owner/registry.ts:86-108` registers both; `resources` has no admin write surface anywhere (content enters via seed migration only — a GAP_AUDIT item still true).
*Symptom:* flag-on owners can archive content nobody can author or fix in-app.
*Question:* is a resources/events authoring surface planned (GAP_AUDIT B1 §4), or should owner-registry entries wait for it?

**AD3 · [P6] · low · CONFIRMED — Two admin surfaces grant the same global roles**
`/admin/access` and `/admin/participants/[id]/permissions` "Quick Assign" both grant owner/admin/developer/observer. Both correctly funnel through `grantRole()`/`revokeRole()` (`lib/auth/grants.ts`) — duplicative UI, not a correctness bug.
*Question:* which page is the canonical entry point (the other linking to it)?

**AD4 · [P1] · low · REFUTED-as-drift / CONFIRMED-as-duplication — Mirrored env-flag modules**
`lib/owner/flag.ts` and `lib/entity-explorer/flag.ts` are hand-duplicated but currently identical (the 118af33 case-fix pattern is in both).
*Question:* extract `parseBooleanFlag()` when a third flag appears, or now?

Status updates to the ledger (verified this scan): **GAP_AUDIT B4 violations 1–2 are RESOLVED** — both revocations routes now call `reconcileEnrollmentActivation()`; the `revocation-check` cron remains deliberately unregistered in `vercel.json` pending its documented staging soak (the sole cron/route orphan — decision: is the soak done?). **`POST /api/registrations/short` was removed** but left `short-registration.ts` orphaned. **No new `/admin/org`-style scoping leaks** (org page now `.is("lab_id", null)`; labs pages scoped). Announcements vs weekly-messages: distinct purposes, clearly labeled — refuted as confusion. Admin layout gating + owner step-ups correct.

### Domain: counts / labs / public content / social

**CT1 · [P3] · high · CONFIRMED — Public "people waiting" is structurally always 0 for waitlist labs** *(spot-verified)*
`lib/content/queries.ts:109-130` (`withMemberCounts`, from the 9763c5f fix) derives BOTH `members` and `waiting` from `participants.metro_id`; its comment claims "a waitlisted member's metro_id points at the waitlist lab." But no code path ever sets `metro_id` to a waitlist lab: the funnel keeps it NULL (`api/registrations/funnel/route.ts:149-153` — "Waitlisted/lab-less members stay NULL"), and `setActiveLabMembership` rejects non-active labs (`lib/labs/membership.ts:160-179`). Admin pages count `metro_waitlist_signups` (real rows) instead.
*Symptom:* homepage and `/local-labs` always pitch waitlist cities with 0 waiting, while admin shows real signups. The count fix's own comment is wrong about the data model.
*Question:* none — `waiting` should read `metro_waitlist_signups` (like admin); `members` stays on `metro_id`. They're different populations.

**CT2 · [P1] · high · CONFIRMED — Editing your ZIP desyncs `metro_slug` from `metro_id`**
`api/participants/[participant_id]/route.ts:97-101` re-derives `metro_slug` from the new zip (via `metroFromZip`, no active-lab filter) but never touches `metro_id`. Every other membership write sets both together, active-labs-only. Display surfaces (directory `lib/directory/data.ts:196-197`, profile, `/u/[handle]`) render `metro_slug`; gating and every count use `metro_id`.
*Symptom:* a member who edits their ZIP can display as belonging to a lab they're not gated or counted in.
*Question:* should a ZIP edit reassign lab affiliation at all, or only suggest — with reassignment always via `setActiveLabMembership`?

**CT3 · [P3] · high · CONFIRMED — "Active member" means four different things across count surfaces**
The count matrix (site × filters):

| Site | Population | inactive filter | staff/test excluded | archived excluded |
|---|---|---|---|---|
| Poderator all-pods (`lib/moderator/pods-list.ts:108-179`) | pod_memberships | yes | **no** | n/a |
| Poderator pod detail (`pod-detail.ts:250-281`) | pod_memberships | yes | **yes** | n/a |
| Admin cycle dashboard (`api/dashboard/[cycle_id]/route.ts:39-61`) | pod_memberships | yes | **no** | n/a |
| Directory rollups (`lib/directory/data.ts:122-213`) | pod/project_memberships | yes | **yes** | n/a |
| Admin labs list (`admin/labs/page.tsx:50-104`) | participants.metro_id | n/a | **no** | **no** |
| Public homepage (`lib/content/queries.ts:109-130`) | participants.metro_id | n/a | test only, **not staff** | n/a |

*Symptom:* any pod with a staff/test seat shows different member counts on the all-pods list vs its own detail page vs the directory; lab counts differ between admin and homepage. (Same root cause family as LL3.)
*Question:* what is THE definition of an active member (inactive? staff? test? archived?) — and should it live in one shared helper that every count site calls?

**CT4 · [P8] · high · CONFIRMED — Deactivated participants still listed in the directory and at `/u/[handle]`**
`lib/directory/data.ts:100-108` filters `is_test`/`is_staff` but not `archived_at`; `/u/[handle]/page.tsx:31-46` same. `participants.archived_at` (00079) is exactly the owner-console "deactivate" flag (`lib/owner/archive.ts:32-43`). Pod rosters are correctly closed on archive; only the directory grid and public profile leak.
*Question:* none — add `.is("archived_at", null)` alongside the existing exclusions.

**CT5 · [P5] · med · CONFIRMED (root cause for filed feedback) — Follower count stale because `refreshOnChange` is opt-in**
`follow-button.tsx:18,42` only calls `router.refresh()` when passed `refreshOnChange`; the profile page renders the count server-side and omits the prop (`/u/[handle]/page.tsx:110-114`). Counts themselves are computed consistently.
*Question:* should `refreshOnChange` default true wherever a numeric count renders beside the button?

**CT6 · [P5] · med · CONFIRMED — Events: no create/edit path for non-Luma events**
Only writes to `events`: Luma sync + flag-gated owner archive. No POST/PATCH route exists. Spotlights/stories got a real admin CRUD (`admin/content`); events didn't.
*Symptom:* an HQ-hosted event not on Luma cannot enter the site except by raw SQL.
*Question:* is events content Luma-only by design, or does it need the lightweight editorial path spotlights got?

**CT7 · [P6] · med · CONFIRMED — Waitlist join insert copy-pasted across two endpoints**
`api/labs/waitlist/route.ts` (find-or-create by city, zod-validated) and `api/metros/[metro_id]/waitlist/route.ts` (by id, no body schema) duplicate the same `metro_waitlist_signups` insert + 23505 dedup. Two entry UIs are fine; the shared insert should be one helper — especially before feedback #11 adds fields to it.
*Question:* extract `joinWaitlist()` (mirroring `setActiveLabMembership`) before #11's field additions land?

Refuted/updated in this domain: **GAP_AUDIT B5's `lib/metros.ts` row is stale** — the hardcoded zip map is retired; it reads `metros.zip_prefixes` and only *suggests* (though see CT2 for the live bug in the same code path). **RSVP rate limiting now exists** (`ANON_RSVP_LIMIT=5/hr`, `lib/api/rate-limit.ts`) — GAP_AUDIT's "pre-launch blocker" is stale. Homepage "50 ex-feds"/"fall 2025" are one-time historical facts, not drifting duplicates; `CYCLE_ANATOMY` is a documented bridge (but hardcodes the 3-month arc). No duplicate directory feed remains; saved/heart single path; announcements/spotlights status filters correct.

---

## Questions to answer to simplify

These are the product/owner decisions that unblock consolidation. Each cites the
findings it resolves; answering them collapses whole clusters of weirdness at once.

### Schedule & cycle lifecycle
1. **Which is the source of truth for the cycle schedule — `cycle_config` window
   columns, `cycle_phases`/`cycle_events`, or `ANCHOR_EVENTS` — and by when do the
   other two retire?** Today all three exist; the constant is what members see
   (C3), the columns are what most pages compute from (C7), and the phase rows
   are what the actual gate enforces (C2). Any answer is workable; three answers
   at once is the bug factory.
2. **Is `closing` a live status or a wind-down?** The badge convention says live,
   every resolver says dead (C4). Decide, then fix whichever side is wrong.
3. **Should cycle name/slug/dates be editable after creation, by whom, and with
   what guardrails once weeks/milestones derive from the dates?** (C5)

### Membership & counting
4. **What is THE definition of an "active member"** — which of `inactive_at`,
   `is_staff`, `is_test`, `archived_at` exclude someone, and do any surfaces
   intentionally deviate (e.g., admin views counting staff)? One shared helper
   should encode the answer. (CT3, LL3, CT4)
5. **What does lab affiliation mean, and what changes it?** Should a ZIP edit
   re-derive it at all (CT2), and should the public "waiting" number come from
   `metro_waitlist_signups` (CT1)?

### Health & rituals
6. **Is pulse-check still a real signal, or does Learning Log completion drive
   Poderator bands/at-risk/nudges now?** The enforced ritual and the measured
   ritual are currently different systems (LL1). If pulse retires: the pulse-band
   config columns and their missing admin UI (LL4) retire with it.
7. **Must a log be attributed to the specific cycle whose window it satisfies,
   everywhere?** The member gate says yes; the Poderator view says any log counts
   (LL2).

### Collected-but-invisible data
8. **For each onboarding/ceremony answer that no surface displays — the six
   legacy columns and the three join-ceremony free-text answers — keep and
   surface it (where?), or stop collecting it?** (PA2) This is also the Pod Squad
   memo's "Upskiller basic-info overview" ask.

### Editability gaps (create-without-edit)
9. **Do events stay Luma-only by design, or do they get the lightweight admin
   CRUD that spotlights got?** Same question for `resources` before the owner
   console flag flips on. (CT6, AD2)
10. **Where does pod administration live?** Six endpoints, four permission
    shapes, no single surface; integration fields readable but not writable
    (PP3). Related: the still-open feedback #9 (page-admin management home).

### Access & eligibility
11. **Should NULL-metro (HQ/grandfathered) problem statements be votable by
    everyone, mirroring how NULL-lab pods are joinable by everyone?** (PP4)
12. **Are `staff`/`tester` roles in the authority model or not?** Either the
    grant actions write `participant_roles` like everything else, or the access
    console stops advertising a section that can never populate (PA4).

### Process guardrails
13. **Adopt `.strict()` (or a form↔schema conformance test) as the house rule for
    update schemas?** `project_min` is the second silently-stripped field in this
    exact form; the first one's fix added the missing fields but not a guard
    against the third. (C1, AD1)
14. **Is the `revocation-check` staging soak done?** The cron is rewritten,
    reconciler-compliant, and still unregistered.

---

## Proposed simplification backlog

### Tier 1 — mechanical fixes, no decision needed (each ≤ ~10 lines)
- Add `project_min` to `updateCycleConfigSchema` (C1)
- Add `["forming","active"]`-style status allowlist to project register (PP1)
- Add `.is("archived_at", null)` to directory people query + `/u/[handle]` (CT4)
- Add `.eq("cycle_id", cycleId)` to `getLogHealth`'s log query (LL2)
- Add `requireCompleteProfile()` to `POST /api/problem-statements` (PA1)
- Exclude `is_staff`/`is_test` in `pods-list.ts` + `rollup.ts` to match `pod-detail.ts` (LL3) — *pending Q4's definition*
- Finish `maybeSingle()` + explicit message on the 4 remaining phase pages (PP6)
- `advance-phase` calls `syncPhasesFromConfig()` (C2)
- Delete dead code: `POST /api/registrations` + `registrationSchema`'s 0–10 field, `short-registration.ts`, `revokeInvitationSchema` (PA3, AD1)
- Fix `lib/auth/CLAUDE.md` local-verification steps still describing the retired `OWNER_EMAILS` bootstrap; strike stale GAP_AUDIT rows (B4 resolved, metros.ts retired, RSVP throttled)

### Tier 2 — consolidations (one concept, one implementation)
- `activeMemberCount()` / shared member-filter helper encoding Q4's answer; repoint all six count sites (CT3)
- Public `waiting` reads `metro_waitlist_signups` (CT1); shared `joinWaitlist()` helper under both waitlist endpoints (CT7)
- One pod join/withdraw client hook + one pod-list status filter for dashboard and register-pods (PP2)
- Phase-indicator + testing-controls go phases-first like `checkWindow` (C7); `checkWindow` gains a cycle-status guard (C8)
- `getOperatingCycle`/`getRecruitingCycle` become the only cycle resolvers (C6)
- Reminder cron consumes `eligibleLogCycles`/`resolveGate` (LL5)
- Shared role-intent `{value,label}` list (PA5); shared `parseBooleanFlag()` (AD4); align handle-slugify order (PA6)

### Tier 3 — decision-gated builds (blocked on §Questions)
- Repoint `cycle-commitments.tsx` + join ceremony onto `cycle_events`; delete `ANCHOR_EVENTS` (Q1 — **needed before Cycle 4**)
- Repoint Poderator bands/at-risk/nudges onto Learning Log completion; retire or demote pulse surfaces + pulse-band config (Q6)
- `PATCH /api/cycles/[cycle_id]` for name/slug/dates with active-cycle guardrails (Q3)
- Treat `closing` as live in resolvers, or re-document the status (Q2)
- Events/resources admin authoring surface (Q9)
- Surface or stop collecting the invisible onboarding/ceremony answers (Q8)
- ZIP-edit no longer writes `metro_slug`; lab reassignment via `setActiveLabMembership` only (Q5)
- Unify pod administration onto fewer surfaces (Q10)

---

## Ledger — already-filed issues (not re-reported above)

Seeded from the existing catalogues so this scan doesn't double-count them.

### From `docs/feedback-running-list.md` (2026-07-12)

| # | Item | Pattern | Status there |
|---|---|---|---|
| 1 | Register CTA only renders for `status='upcoming'`; gone once `active` though join route accepts it | P5 | 🔍 root-caused, open |
| 2 | Can't see own problem statement after submitting | P5 | 🆕 |
| 3–5 | Voting UX: budget clamp, vote visibility, vote removal | P3/P6 | ✅ addressed (#224) |
| 6 | Zip→state autofill on profile | — (feature) | 🆕 |
| 7 | Availability not carried registration→profile | P1 | ✅ hours (#238); root pattern remains dual-store |
| 8 | "Pre-registered" card is a dead end | — (UX) | 🆕 |
| 9 | Page-admin management on the view page; where should it live? | P5/P6 | hidden on pods (#225); decision open |
| 10 | Intro/welcome screen shows on return sign-in | P4 | 🆕 |
| 11 | What to collect on no-lab waitlist join | — (design) | 🆕 |
| — | July-11 triage items (see doc) — many ✅ on #224–#228 | various | mixed |

### From `docs/audit/GAP_AUDIT.md` (2026-07-04 — **partially stale**)

Audited at PR #144; since then learning logs, the directory, follows, stories, and
the owner console have shipped, so Part A rows describing those as `missing` are
historical. Items believed still live and relevant to this scan:

| Item | Pattern | Status as verified by this scan (2026-07-15) |
|---|---|---|
| B4 violations 1–2: revocations routes bypassing the reconciler | P7-adjacent | **RESOLVED** — both routes now call `reconcileEnrollmentActivation()`; cron still unregistered pending soak (Q14) |
| B5: `lib/metros.ts` hardcoded zip map still wired into the funnel | P1 | **STALE** — module reads `metros.zip_prefixes` and only suggests; but see CT2 for a live bug in the same path |
| B5: dead code — `POST /api/registrations/short`, `.heart` CSS | hygiene | route removed; `short-registration.ts` schema left orphaned (Tier 1) |
| B5: placeholder-name debt (`Unknown` rows) gated by `lib/participants/placeholder.ts` | P2 | still live; guard coverage has one hole (PA1) |
| B5: stale docs (`TUL_MVP_Spec.md` FastAPI backend, roadmap §6 tracker) | P2 (docs) | still true |
| B1 §1.6/1.7: `events`/`resources` column drift; `resources.from_line` text not FK | P1 | still true; spec errata never written |
| A4 voter-eligibility policy fork (`non_submitter_votes` wiring) | P1/P5 | budget wiring verified clean post-779da15; the policy fork itself remains an owner call |
| A7 "Moderator" rendered-copy leak at vote-progress page | copy rule | **FIXED** — renders "Poderator"; no other leaks found |
| RSVP rate limiting missing (spec pre-launch blocker) | security | **FIXED** — `ANON_RSVP_LIMIT=5/hr` via `lib/api/rate-limit.ts` |

### Known-good reference patterns (use these when consolidating)

- **Paired create/patch schemas in one file** — announcements, surveys (`lib/validations/`)
- **Single shared action component** — `app/components/follow-button.tsx` (one component, one endpoint, reused everywhere)
- **Centralized lifecycle registry** — `lib/owner/registry.ts` + `app/components/owner-lifecycle.tsx` + `api/owner/[entity]/[id]`
- **Extracted single-source helpers born from past fixes** — `lib/metros-label.ts` (`metroLabel`), `lib/format/rel-time.ts` (`relTime`), `lib/cycle/week.ts` (`getCycleWeek`), `lib/learning-logs/eligible.ts`
