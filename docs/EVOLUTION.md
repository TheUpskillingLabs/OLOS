# How OLOS Got Here

The evolution of the app, era by era — what was built, what was decided, and
where each decision's record lives. Superseded planning docs are preserved in
[`docs/archive/`](archive/) with banners explaining what replaced them; this
doc is the index and the narrative.

**Current truth lives in:** [`README.md`](../README.md) (front door) ·
[`docs/ARCHITECTURE.md`](ARCHITECTURE.md) (stack + domain model) ·
[`SCHEMA.md`](../SCHEMA.md) (database) · [`lib/auth/CLAUDE.md`](../lib/auth/CLAUDE.md)
(auth + permissions) · [`docs/OLOS-roadmap.md`](OLOS-roadmap.md) (status).

---

## Era 1 — The founding spec and the prototype sprint (March–April 2026)

The [founding product spec](archive/TUL_MVP_Spec.md) defined the domain that
still holds today: quarterly **cycles**, in which participants submit problem
statements, vote, form **pods**, propose solutions, vote again, and form
**projects** — with pulse checks as the participation heartbeat.

The spec assumed a Python/FastAPI backend exchanging Supabase tokens for
hand-rolled JWTs. **That backend was never built.** The April prototype sprint
went straight to a Next.js App Router monolith — route handlers under
`app/api/`, Supabase Postgres underneath — and in roughly two weeks shipped the
whole first cut: cycle phases, guided problem-statement submission, voting,
pod/project surfaces, pulse checks, admin & moderator management, a **granular
permissions model** (`participant_permissions` + role presets) that quietly
replaced the spec's flat five-role model, the invitation system, a developer
role with a testing mode, and two security audits.

> Translation habit that started here and still applies: when an old issue says
> "FastAPI/Alembic/JWT," read "Next.js route handler / SQL migration /
> Supabase session cookie."

## Era 2 — Wave 1: real infrastructure (late April – mid May 2026)

Wave 1 turned the prototype into a system that could onboard real people
(tracked in [`OLOS-roadmap.md`](OLOS-roadmap.md)):

- **Pulse check V2** (migration `00010`) with the expanded `ai_tools` list and
  Labs-aligned benefit options; **option_lists seeded by migration** (`00012`),
  not seed files.
- **Design system v1.0** — the dark theme ([archived](archive/DESIGN_SYSTEM.md)).
- **Legacy data migration** — column-mapping CSV + `migrate.py`
  (Sheets → Postgres), documented in [`scripts/migration/CLAUDE.md`](../scripts/migration/CLAUDE.md).
- **Google OAuth sign-in** (#44) and **invitation magic links via the Resend
  HTTP API** (#45) — two deliberate deviations from the spec were ratified:
  redirect-to-`/register` instead of a 404 for unknown emails (#63), and
  direct Resend HTTP over Supabase SMTP (#64). [`lib/auth/CLAUDE.md`](../lib/auth/CLAUDE.md)
  carries the full deviation record.
- **Bulk magic-link ops script** (W1-008) for cycle onboarding.

## Era 3 — The Poderator dashboard and the onboarding reckoning (late May – early June 2026)

Two parallel arcs:

**Poderator dashboard.** A full moderator surface — all-pods overview, per-pod
pulse review, at-risk nudges, aggregate trends — shipped on migrations
`00023`–`00027` ([PRD](archive/PRD-moderator-dashboard.md) and
[design spec](archive/2026-05-22-poderator-dashboard-design.md) archived;
the living build doc is [`docs/poderator-dashboard/CLAUDE.md`](poderator-dashboard/CLAUDE.md)).
Notable deltas from the PRD: follow-up is email (not Slack DM), insights are
computed in server components (no insights API routes), and access gates on
`pods:read`.

**The onboarding reckoning (#110).** An [architecture review](archive/architecture-review-onboarding-state-machine.md)
found the enrollment lifecycle fragmented across ~8 mutation sites with real
broken edges (invitation activation, placeholder names, cron miscounts). The
fix landed in phases: a **central enrollment reconciler**
(`lib/enrollment/reconciler.ts`) as the single activation path,
placeholder-name remediation end to end, RLS hardening (`00021`/`00022`), and
a rewritten **two-stage revocation cron** (`00030`, warning → revocation).
Also in this era: the entity explorer (feature-flagged) and the in-app
feedback widget.

## Era 4 — The reskin and real registration (early July 2026)

The onboarding-proto port replaced the dark theme with the light
**"warm-paper" design system** (now the token layer in `app/globals.css`) and
brought self-serve onboarding: the **funnel registration** (capturing ZIP →
metro via `lib/metros.ts`, role intents, agreement acceptance) and the **Open
Cycle Agreement** ceremony (`00031`/`00032`). Days later, **registration
windows** shipped (`00033`; `00034` in the same PR repaired an unrelated
column drift): cycles gained a 6-state status vocabulary
(`draft → upcoming → active → closing → closed`, plus `archived`),
`lib/cycles/registration.ts` became the "which cycle is open for registration"
authority, and cycle info pages went live. The
[user-stories doc](archive/user-stories-cycle-registration.md) that scoped this
shipped in the same PR that implemented it (#190).

## Era 5 — Lifecycle hardening and the labs model (July 10, 2026)

The most recent wave, in three moves:

1. **Pod & project creation hardened end to end** (`00035`–`00037`): editable/
   withdrawable votes on both layers (unified ballot model), capacity-aware
   finalization, reactivation-aware re-registration, a failed-formation
   resolver, and a day-separated stage flow — then a UX pass (neutral framing:
   no pod/project "belongs" to its seeder).
2. **Admin lifecycle management** — the full cycle → pod → project lifecycle
   became drivable from the cycle admin page (finalize, tallies, rename,
   status override, membership management), with in-app confirm dialogs.
3. **The HQ / Local-Lab model** (`00038`–`00039`) — the big domain correction.
   HQ centrally coordinates **open cycles**; each **Local Lab** (metro) runs
   its own pods and projects *within* them; labs can also run their own
   internal cycles; and the same cycle→pod→project primitive doubles as HQ's
   org structure (flagged `is_hq_internal`, hidden from labs leads). Concretely:
   - A metro-scoped **`labs_lead`** role (`pods:write`, deliberately not
     `cycles:write`).
   - The **lab boundary lives on the pod/project** (`pods.metro_slug`,
     `projects.metro_slug`), not the cycle; enforcement is centralized in
     `lib/auth/cycle-access.ts`.
   - **Per-lab formation**: in an HQ-open cycle each lab's participants
     submit, vote, and form pods within their own lab's pool.
   - Labs leads see HQ-open + their own lab's cycles, manage only their own
     lab's pods/projects, and create/configure their own lab's cycles.

   Verified by `scripts/seed-cycle.mjs` (data-level assertions) and
   `scripts/verify-labs-lead-access.mjs` (authenticated HTTP end-to-end).

---

## Known open items (as of 2026-07-11)

- **Registration routing is metro-blind** — `getRegistrationCycle()` returns
  the soonest open cycle regardless of lab; the labs model hasn't reached the
  registration front door yet.
- **The revocation cron is unscheduled** — rewritten and working, but nothing
  invokes `app/api/cron/revocation-check` on a schedule.
- **Participant metros are sparsely populated** on dev (most participants have
  no lab assigned), which per-lab formation depends on. Backfill via the
  Region control on the admin participant permissions page.
- **Legal drafts lag the product** — the privacy policy doesn't yet mention
  pulse-check wellbeing surveys or third-party nominee PII (`nominations`),
  and the terms list unbuilt features (mentor matching, event listings).
  Needs an owner/counsel pass, not an engineering edit.
- Proto-translation C-stages and their owner decisions remain tracked in
  [`PROTO_TRANSLATION_PLAN.md`](PROTO_TRANSLATION_PLAN.md).

## The archive

Everything in [`docs/archive/`](archive/) is a historical record with a banner
explaining its status: the founding spec, the original architecture brief, the
dark-theme design system, the moderator PRD + design spec, the onboarding
review trio, the registration user stories, three dated 2026-05 snapshots, and
the feedback-widget PR record. They are kept for the reasoning they preserve —
consult them for *why*, never for *what is*.
