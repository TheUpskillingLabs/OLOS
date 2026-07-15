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

---

## Questions to answer to simplify

*(populated after adjudication)*

---

## Proposed simplification backlog

*(populated after adjudication)*

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

| Item | Pattern | Notes |
|---|---|---|
| B4 violations 1–2: revocations routes demote/promote directly, bypassing the reconciler | P7-adjacent | verify current state (see Findings) |
| B5: `lib/metros.ts` still wired into the funnel despite the real `metros` table | P1 | verify |
| B5: dead code — `POST /api/registrations/short`, `.heart` CSS | hygiene | verify |
| B5: placeholder-name debt (`Unknown` rows) gated by `lib/participants/placeholder.ts` | P2 | verify |
| B5: stale docs (`TUL_MVP_Spec.md` FastAPI backend, roadmap §6 tracker self-admittedly wrong) | P2 (docs) | still true as of this scan's exploration |
| B1 §1.6/1.7: `events`/`resources` column drift vs spec names; `resources.from_line` text instead of `project_id` FK | P1 | spec errata never written |
| A4 voter-eligibility policy fork (problem votes budgeted, project votes submitter-only; `non_submitter_votes` config partially unwired) | P1/P5 | owner decision §10-Q1 still open |
| A7 "Moderator" rendered-copy leak at vote-progress page | copy rule | verify fixed |
| RSVP rate limiting missing (spec pre-launch blocker) | security | verify |

### Known-good reference patterns (use these when consolidating)

- **Paired create/patch schemas in one file** — announcements, surveys (`lib/validations/`)
- **Single shared action component** — `app/components/follow-button.tsx` (one component, one endpoint, reused everywhere)
- **Centralized lifecycle registry** — `lib/owner/registry.ts` + `app/components/owner-lifecycle.tsx` + `api/owner/[entity]/[id]`
- **Extracted single-source helpers born from past fixes** — `lib/metros-label.ts` (`metroLabel`), `lib/format/rel-time.ts` (`relTime`), `lib/cycle/week.ts` (`getCycleWeek`), `lib/learning-logs/eligible.ts`
