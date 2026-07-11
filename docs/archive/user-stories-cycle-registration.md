> **📁 ARCHIVED — historical record.** Gap analysis written for PR #190 (2026-07-06); its P0/P1 stories shipped in that same PR. Every "Current gap." section below describes the *pre-implementation* code: `lib/cycles/registration.ts` (`getRegistrationCycle()`), the 6-state cycle status vocabulary, the registration window (migration 00033; 00034 in the same PR is an unrelated drift repair), and the dashboard/cycles-page fixes all exist now. See [docs/EVOLUTION.md](../EVOLUTION.md) for the full story of how the app got here.

# User Stories — New-User Registration & Joining an Upcoming Cycle

**Context / launch scenario.** The next core wave of users will register for
**Civics & Elections**, which is an **`upcoming`** cycle — it has not started and
is not `active`. Today the app is built around the assumption that *the cycle a
user registers for is always the single `active` cycle* (right now: Energy &
Climate). That assumption is wrong for this launch and produces confusion:

- Onboarding routes "Join a Cycle" to the **active** cycle, not the one the user
  came to join.
- The cycle **join ceremony** and the **interest** endpoint hard-reject any
  cycle that is not `active`.
- The **/cycles** page makes the active cycle the hero and files the upcoming
  cycle under a heading literally called **"Past cycles."**

**Goal for this milestone (dev → prod ASAP):** a new user can register for The
Labs and join **Civics & Elections** with the *next step always obvious*, and
with the active cycle and past cycles never getting in the way.

---

## The reframe these stories encode

> **"Register for a cycle" must target a chosen cycle — not `status = 'active'`.**

We introduce one product concept: a cycle that is **open for registration**. A
cycle can be open for registration while `upcoming` (before it starts). This is
distinct from `active` (currently running its phases). Recommended
implementation lever (decide in Story 6): a boolean/window on the cycle rather
than overloading `status`.

**Cycle status vocabulary** (DB `cycles.status`): `draft · upcoming · active ·
closing · archived · closed`. Only `active` is first-classed in the UI today;
`upcoming` falls through to an "inactive" badge.

**Priority key:** **P0** = blocks the Civics launch · **P1** = needed for a clean
launch · **P2** = polish / hardening.

---

## Epic A — Register for The Labs and land on the *right* cycle

### Story A1 — Route new registrants to the cycle they came for  · **P0**
**As a** new user who came to join Civics & Elections,
**I want** signup to guide me to register for **Civics & Elections** specifically,
**so that** I'm not dropped into a different, already-running cycle.

**Current gap.** `app/api/registrations/funnel/route.ts` returns only
`active_cycle_id` (`cycles WHERE status='active'`), and `funnel.tsx` routes the
"cycle" role branch to `/cycles/{active_cycle_id}/join`. A Civics registrant is
sent to Energy & Climate.

**Acceptance criteria.**
- Given a registration target cycle (see A5 for how it's chosen), when I finish
  the funnel with "Join a Cycle" selected, then I'm routed to
  `/cycles/{target}/join`, where `{target}` is the cycle I'm registering for.
- If there is no registration-open cycle, "Join a Cycle" still completes signup
  and lands me on a dashboard that tells me what to do next (A4), with **no**
  broken redirect.
- The confirmation email names the cycle I joined and its start date (A3).

**Next steps (dev).**
- `funnel/route.ts`: resolve the *registration-open* cycle (Story A6), return
  `registration_cycle_id` (keep `active_cycle_id` for back-compat).
- `funnel.tsx submit()`: branch on `registration_cycle_id`.
- Thread the target from the entry point (A5): invite token → cycle, or
  `/register?cycle={id}`.

---

### Story A2 — Let users complete the join ceremony for an *upcoming* cycle  · **P0**
**As a** registered user,
**I want** to sign the cycle agreement and register for a cycle that hasn't
started yet,
**so that** I'm enrolled and ready before Civics & Elections begins.

**Current gap.** `app/(dashboard)/cycles/[cycle_id]/join/page.tsx:44` —
`if (!cycle || cycle.status !== "active") redirect("/cycles")`. Civics
(`upcoming`) bounces the user out of the ceremony entirely.

**Acceptance criteria.**
- Given a cycle that is **open for registration** (upcoming or active), when I
  open `/cycles/{id}/join`, then the ceremony renders (does not redirect).
- When I complete it, then a `cycle_agreements` row and an active
  `cycle_enrollments` row are written for that cycle.
- Given a cycle that is `closed`/`archived`/not open for registration, then I'm
  redirected to `/cycles` with an explanation (unchanged behavior for those).
- The ceremony copy adapts when the cycle hasn't started ("Registered — Civics &
  Elections starts July 14" instead of a pod-registration CTA).

**Next steps (dev).**
- Replace the `status !== 'active'` guard with an "open for registration" check
  (Story A6).
- `ceremony.tsx`: handle the not-yet-started confirmation state; the
  `podRegistrationOpen` CTA already degrades — add a "starts on {date}" state.

---

### Story A3 — Make the post-registration next step unmistakable  · **P0**
**As a** new user who just registered,
**I want** a confirmation that says exactly what I signed up for and what happens
next,
**so that** I'm never left wondering whether it worked or what to do.

**Current gap.** After the funnel, users route to `/dashboard`, which is centered
on the **active** cycle (Energy & Climate) — a cycle they're not in. The
confirmation email only includes a cycle CTA when the **active** cycle's
pod-registration window is open (`funnel/route.ts` ~L120–150), so a Civics
registrant gets a welcome email with **no** cycle next-step.

**Acceptance criteria.**
- The in-app confirmation names the cycle joined + start date + the single next
  action ("We'll email you when Civics opens for problem submissions").
- The welcome email names the registered cycle and its start date, independent
  of the active cycle's windows.
- Given registration failed, then I see a specific error and a retry, never a
  silent dead-end.

**Next steps (dev).** `registration-confirmation-template.ts` +
`funnel/route.ts` email block: base the cycle CTA on the *registered* cycle, not
the active one. Add a "cycle starts {date}" confirmation state to the ceremony.

---

## Epic B — Remove distractions: the right cycle is front-and-center

### Story B1 — Feature the registration cycle on /cycles; stop mislabeling it  · **P0**
**As a** prospective member,
**I want** the cycle I should register for to be the obvious, prominent choice,
**so that** past cycles and the current active cycle don't confuse me.

**Current gap.** `app/(dashboard)/cycles/page.tsx`: the hero is
`cycles.find(status==='active')`; **everything else** (including `upcoming`
Civics) renders in a grid under the heading **"Past cycles"** (L104), sorted by
`start_date`. `upcoming` isn't in `STATUS_VARIANT`, so it shows an "inactive"
badge (L108–109).

**Acceptance criteria.**
- A cycle that is open for registration shows a prominent **"Register" / "Join"**
  CTA card (not a plain link into a read-only cycle page).
- The **"Past cycles"** section contains only genuinely past cycles
  (`closed`/`archived`) — never an `upcoming` cycle.
- `upcoming` renders with its own correct label/badge (not "inactive").
- For a not-yet-registered user, the registration cycle is visually the hero,
  above the active cycle.

**Next steps (dev).** Split `otherCycles` into `upcoming/registration`,
`active`, and `past`. Add `upcoming` (+ `closing`/`archived`) to
`STATUS_VARIANT` and the `CycleStatus` type. Give registration-open cycles a
CTA card.

---

### Story B2 — A "not yet in a cycle" dashboard that points to the next step  · **P0**
**As a** newly registered user not yet enrolled in the active cycle,
**I want** my dashboard to tell me what to do next,
**so that** I'm not staring at a cycle timeline I have no part in.

**Current gap.** `dashboard/page.tsx` sets `activeCycle = status==='active'` and
looks up *my* enrollment/pods **in that active cycle**. A user enrolled only in
Civics sees the Energy & Climate timeline with no pod — reads as "you're behind"
when they're actually early.

**Acceptance criteria.**
- Given I'm enrolled in an upcoming cycle, then the dashboard leads with **that**
  cycle ("Civics & Elections — starts July 14"), not the active one I'm not in.
- Given I'm registered for The Labs but not enrolled in any cycle, then I see a
  clear "Register for the current cycle" CTA (the registration cycle), not an
  empty/irrelevant timeline.
- The pulse-check nudge only appears for cycles that have actually started.

**Next steps (dev).** Select the user's *own* enrollments first; choose the
"primary" cycle to feature (enrolled-upcoming > enrolled-active > registration-
open). Add empty/registration states.

---

## Epic C — Admin control & the underlying model

### Story C1 — Admin marks a cycle "open for registration"  · **P1**
**As an** admin,
**I want** to open a specific (usually upcoming) cycle for registration,
**so that** new users are pointed at the correct cycle without a code change.

**Current gap.** No such lever. "Active" conflates *currently running* with
*where new users go*. Adding cycles is possible in `/admin`, but there's no
"registration target" concept.

**Acceptance criteria.**
- Given I open Civics for registration, then A1/A2/B1 all resolve to Civics.
- Only one cycle is the registration target at a time (or the rule is explicit
  and enforced).
- Closing registration cleanly reverts the funnel/cycles behavior.

**Next steps (dev). Decide the mechanism (blocks A1/A2/A6):**
either (a) a `cycles.registration_opens_at / registration_closes_at` window, or
(b) a `cycles.open_for_registration boolean`, or (c) reuse the existing
`cycles.mode` (`open`/`closed`) + `upcoming` status. Add an admin toggle. Update
`SCHEMA.md` + a migration.

---

### Story C2 — One shared "registration-open cycle" resolver  · **P1**
**As a** developer,
**I want** a single function that answers "which cycle is open for registration?"
and "is cycle X open for registration?",
**so that** the funnel, join page, interest endpoint, /cycles, and dashboard all
agree.

**Current gap.** The `status === 'active'` check is duplicated and inconsistent
across `funnel/route.ts`, `join/page.tsx:44`, `interest/route.ts` (400), and
`cycles/page.tsx`. Fixing one without the others reintroduces confusion.

**Acceptance criteria.** All five surfaces call the same helper; changing the
rule changes every surface at once. Covered by the A/B stories' acceptance
tests.

**Next steps (dev).** Add `lib/cycles/registration.ts`
(`getRegistrationCycle()`, `isOpenForRegistration(cycle)`); replace the four
inline `status` checks.

---

### Story C3 — Interest endpoint accepts the registration cycle  · **P1**
**As a** registered user,
**I want** to submit cycle-interest details for the cycle I'm registering for,
**so that** the long-form profile is captured even before the cycle is active.

**Current gap.** `app/api/cycles/[cycle_id]/interest/route.ts` returns
`400 "This cycle is not currently accepting interest"` unless `status==='active'`.

**Acceptance criteria.** Interest is accepted for a registration-open cycle;
still rejected for closed/archived cycles.

**Next steps (dev).** Swap the `status !== 'active'` check for
`isOpenForRegistration` (C2).

---

## Epic D — Correctness & launch hardening

### Story D1 — Statuses render correctly everywhere  · **P2**
**As a** user,
**I want** every cycle to show an accurate status label,
**so that** an upcoming cycle never reads as "inactive" or "past."

**Next steps (dev).** Extend `CycleStatus` + `STATUS_VARIANT` to the full set
(`draft/upcoming/active/closing/archived/closed`); audit all `StatusBadge` cycle
usages. Add human labels (e.g. `upcoming → "Starts {date}"`).

### Story D2 — Validate the cycle status constraint  · **P2**
**Current gap.** `cycles_status_check` is `NOT VALID` — bad statuses can slip in.
**Next steps.** Reconcile existing rows, then `VALIDATE CONSTRAINT` in a
migration.

---

## Launch-readiness checklist (must clear before prod)

These are blockers surfaced during live testing that gate the Civics launch,
independent of the stories above:

- [ ] **`problem_statements.proposal_data` exists in prod.** It was **missing in
  dev** (drift; migration `00007` records it) and 500'd both problem-statement
  submit and voting. Restored in dev — **verify prod has the column before any
  voting/proposal phase or those flows are dead.**
- [ ] **`SUPABASE_SERVICE_ROLE_KEY` set correctly in prod** (no stray wrapping
  characters). A malformed key makes every server query fail *silently* by
  bouncing logged-in users to `/register`. Recommend adding a startup guard that
  fails loud.
- [ ] **Reconcile migration drift.** Dev tracks ~24 timestamp-versioned
  migrations not in the repo; repo `00030–00032` aren't tracked in dev. Produce a
  baseline so repo == prod == dev before launch.
- [ ] **Profile cleanup shipped** — Neighborhood / DCPL Card / "Labs fit" removed,
  `null / 5` fixed. ✅ Done (`profile/page.tsx`).

---

## Appendix — current-state references

| Behavior | File | Note |
|---|---|---|
| Funnel returns only active cycle | `app/api/registrations/funnel/route.ts` | `active_cycle_id` from `status='active'` |
| Funnel routes "cycle" branch | `app/(auth)/register/funnel.tsx` (`submit`) | → `/cycles/{active_cycle_id}/join` |
| Join ceremony active-only guard | `app/(dashboard)/cycles/[cycle_id]/join/page.tsx:44` | redirects if `status!=='active'` |
| Interest active-only guard | `app/api/cycles/[cycle_id]/interest/route.ts` | 400 if `status!=='active'` |
| /cycles hero + "Past cycles" | `app/(dashboard)/cycles/page.tsx` | upcoming filed under "Past cycles"; badge falls back to "inactive" |
| Dashboard centers active cycle | `app/(dashboard)/dashboard/page.tsx` | my-enrollment looked up in active cycle only |
| Status set | `cycles.status` CHECK | `draft/upcoming/active/closing/archived/closed` |
| Open/closed mode | `cycles.mode` CHECK | `open/closed` (existing lever) |
</content>
