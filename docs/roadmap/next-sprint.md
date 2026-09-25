# Next development phase — Sprint 0, Sprint 1, Sprint 2

| | |
|---|---|
| **Status** | Proposal — the plan of record for the next phase once the owner ratifies the decisions in §7; the status table in §8 is updated at the weekly triage |
| **Owner** | Lead architect (plan); maintainers (delivery); success team (copy and curriculum) |
| **Last verified** | 2026-09-25 against `main@226445a` — **re-baselined**: nothing merged since 2026-09-10, Sprint 0 never started, dates shifted two weeks (see §1) |
| **Inputs** | [`2026-09-audit.md`](2026-09-audit.md), [`documentation-framework.md`](documentation-framework.md), [`data-strategy.md`](data-strategy.md), [`personas-and-journeys.md`](personas-and-journeys.md), [`pre-registration-persona.md`](pre-registration-persona.md) |
| **Board** | GitHub Project (to create): *OLOS — Next phase*, milestones `Sprint 0 — Hygiene`, `Sprint 1 — Pre-registration`, `Sprint 2 — Activity spine` |

---

## 1. Framing

The organization is restructuring and deciding what OLOS does next. The audit says the
platform is feature-rich and plan-poor; the persona work says the biggest unserved
moment is the gap between cycles; the data strategy says nothing can be measured yet.
The calendar says the gap opens on **October 13** (Showcase Summit) and the next
cohort's date is unset.

So the phase has one product goal and two enabling goals:

- **Product:** a pre-registrant between cycles is engaged, prepared, and measurable —
  and the two roles who keep a cycle alive (poderators, admins) can see whether their
  work is working.
- **Enabling:** a documentation and decision contract every contributor follows
  (framework), and a data layer that is reconciled, instrumented, and viewable
  (strategy).

Three sprints, sized to a small team with Claude Code as a multiplier and organized by
the file-ownership zones in `docs/agent-teams.md` so work parallelizes without
collisions.

| Sprint | Dates (re-baselined 2026-09-25) | Goal | Hard date |
|---|---|---|---|
| **0 — Hygiene & decisions** | Mon Sep 28 → Fri Oct 9 | Framework adopted; knowledge-repo bridge live; ledger reconciled; decisions recorded; backlog triaged; executive meeting held | **Oct 2**: D1 (next cycle date + theme) decided, or the Showcase slice below is off the table |
| **1 — Pre-registration & the loop** | Mon Oct 12 → Fri Nov 20 | Between-cycles experience live; poderator outreach log; admin insights v1 | **Oct 13 Showcase slice** (only if D1 lands by Oct 2): A4 public cohort page announcing the next cycle + the T-8w "what the cohort built" email. Otherwise **Nov 6**: A1/A2/A3-v1 on prod, ≥ 6 weeks before the next kickoff |
| **2 — Activity spine & scale** | Mon Nov 30 → Fri Jan 22 | Event instrumentation; one calendar; alumni/mentor pathways; Slack identity | next cycle's T-6w |

> **Why the shift.** The Sep 15 plan assumed Sprint 0 started the day it was written.
> Ten days later nothing has merged (the planning PR is not yet opened, PR #391 is still
> open, no labels or milestones exist), so the dates move two weeks and the Oct 10
> target becomes an explicit, decision-gated *Showcase slice*. The between-cycles
> window still opens Oct 13; the persona is served fully by Nov 6, which is early
> enough if the next kickoff is January or later.

---

## 2. Sprint 0 — Hygiene & decisions (Sep 15 → Sep 26)

No product features. Everything here removes a blocker or a recurring cost.

| # | Deliverable | Owner zone | Size | Closes / feeds |
|---|---|---|---|---|
| 0.1 | Merge PR #391 (vault); close #390; merge this planning PR | maintainers | xs | audit F2, F1 |
| 0.2 | Labels + milestones + Project board; label sweep on 20 issues; break #361 into sub-issues | docs owner | s | F7 |
| 0.3 | Dispose of 6 orphan docs PRs (#173, #185, #199, #243, #244, #248, #286) per the audit §5.2 table | maintainers | s | F8 |
| 0.4 | **Migration ledger reconciliation** on dev, then prod (SQL drafted in #361); `environments.md` updated; vault workflow note | migrations + owner | s | F3; unblocks #77 |
| 0.5 | Backfill ADR-0004…0008 (direct registration, registered state, Learning Log pivot, labs as sub-cohorts, no in-app LLM) and the open decision queues as `proposed` notes with owners | lead architect | m | F2 |
| 0.6 | Decide and record: revocation cron (#213) vs compliance nudge (#362) ownership of `at_risk`; schedule or retire | owner + backend | s | F6 |
| 0.7 | Cron auth fail-closed sweep (five older crons) | backend | s | #361 debt |
| 0.8 | State-machine reference doc + vocabulary test | backend + docs | s | data strategy §3 |
| 0.9 | Fix stale canonical lines (`ARCHITECTURE.md`, `environments.md`, `poderator-dashboard/CLAUDE.md`, `ORG_CYCLES.md` §6); banner `PROGRESS.md` | docs | s | F12 |
| 0.10 | Set the **next cycle's kickoff date and theme** (owner decision) — the drip is keyed to it | owner | — | §7 D1 |
| 0.11 | First docs-steward run; first weekly triage | maintainers | — | framework §7 |
| 0.12 | **Knowledge-repo bridge**: destination is `TheUpskillingLabs/Docs-repository` (first publish pushed by hand 2026-09-25); add the token, first automated `publish-artifacts` run, first sweep PR | owner + docs owner | s | [`documentation-topology.md`](documentation-topology.md) §7 |
| 0.13 | **Executive meeting** on project setup, context documents, and the auditable decision trail — held before Sprint 1; outcomes recorded as vault notes | owner | — | [#392](https://github.com/TheUpskillingLabs/OLOS/issues/392) (`priority/p1`, filed 2026-09-25) |
| 0.14 | Session reports for every substantive session from now on (`docs/sessions/`) | everyone | — | topology §5 |

**Exit criteria.** `docs-check` green on every open PR; steward issue exists; every
open issue typed, labeled, and in a milestone or `p3`; `schema_migrations` lists
`00001`–`00103` on both databases; kickoff date decided; the knowledge repo holds its
first publish and the executive meeting has happened.

---

## 3. Sprint 1 — Pre-registration & the loop (Sep 29 → Oct 24)

Four workstreams, three of them product. Workstream A is the priority and has the hard
date; B and C run in parallel in their own zones; D carries hygiene.

### Workstream A — The between-cycles experience (persona: pre-registrant)

Spec: [`pre-registration-persona.md`](pre-registration-persona.md) §4–§8.

| Epic | Scope | Zone | Size | By |
|---|---|---|---|---|
| **A1 Between-cycles dashboard mode** | the two lists; new task kinds; `CycleRegisterCard` states extended; empty-row rules; social-proof counts with floor | frontend + backend (`lib/tasks`) | l | Nov 6 |
| **A2 Readiness ladder** | verified steps (lab, pre-register, GitHub handle, directory card) + manual ticks (dates, LLM, primer, videos) persisted in `task_dismissals`; Slack step lands with ADR-0003 identity (Sprint 2) | frontend + backend | m | Nov 6 |
| **A3 Pre-cycle drip v1** | `scheduled_messages` table + admin form + daily cron; `email_log` helper shared by all senders; dry-run default; consent-gated; the T-8w "what the cohort built + next theme" message ready for Showcase day | backend + migrations | l | Showcase slice: one message by Oct 13 (if D1 by Oct 2); v1 (table, cron, first 3 messages) Nov 6; full set Nov 20 |
| **A4 Public cohort page v2** | `/c/[cycle_id]` with theme, dates, what-you-build, FAQ, lab picker, counts, share; `/build-cycles` reads the DB | frontend | m | Showcase slice: Oct 13 (if D1 by Oct 2); otherwise Nov 6 |
| **A5 Alumni & contributor pathways** | `projects.seeking_contributors` + DRI toggle; alumni interest capture (mentor / poderator / volunteer) → admin filter + export; alumni state at close-out | backend + frontend | m | Nov 20 |
| **A6 Waitlist v2** | three optional fields; lab-less dashboard copy; city count | backend + frontend | s | Nov 20 |
| **A7 Pipeline metric** | `v_preregistration_pipeline` + insights block (with C2) | migrations | s | Nov 20 |
| **A8 Copy & content** | ladder copy, drip copy, theme primer, two onboarding videos (M0, M1) | success team via the curriculum session | — | theme primer + Showcase email copy by Oct 9; M0 by Nov 6 |

**Acceptance:** [`pre-registration-persona.md`](pre-registration-persona.md) §8, items
1–6. Item 7 (the conversion metric) is measured at the next kickoff.

### Workstream B — Poderator outreach toolkit (persona: poderator)

The constitution holds: OLOS **never sends on a poderator's behalf**. The toolkit makes
outreach *visible and accountable*, not automatic.

| Epic | Scope | Zone | Size |
|---|---|---|---|
| **B1 Outreach queue** | one *Outreach* tab per pod (and per project once B4 lands) unifying today's submissions-page list and the compliance statuses: who, why (behind / at risk / blocked / no pitch / no project), last contact, suggested copy-for-Slack line | frontend (`/moderator`) + `lib/moderator` | m |
| **B2 Outreach log** | `outreach_log(participant_id, actor_participant_id, pod_id, project_id NULL, channel, note, created_at)`; "mark contacted" on the queue; visible to that pod's poderators and admins; never to members | migrations + backend | m |
| **B3 The loop** | "contacted last week → filed a log within 7 days" per poderator and per pod on the Insights page; the outreach→response metric (data strategy §5.1) | `lib/moderator/insights` | s |
| **B4 Pods→Projects scoping** | decide #378 Gap 1 (recommend Option A: cycle-level visibility for the build phase); project-scoped log view and roster; switcher groups Pods / Projects / Workstreams | backend + frontend | m |
| **B5 Weekly poderator digest** | Monday email per poderator: pod health, the outreach queue, last week's loop numbers; `email_log` kind; dashboard stays primary | backend | s |
| **B6 Copy-for-Slack digest per project** | reflection text only, never health metrics (#378 Gap 3 norms) | frontend | s |

**Acceptance:** a poderator can, from one tab, see who needs a nudge and why, log that
they nudged, and a week later see whether it worked. An admin can see outreach coverage
across pods. No member ever sees an outreach row.

### Workstream C — Admin engagement & retention metrics (persona: admin)

Spec: [`data-strategy.md`](data-strategy.md) §5.

| Epic | Scope | Zone | Size |
|---|---|---|---|
| **C1 Metrics dictionary** | `docs/reference/metrics.md` with definitions, grain, audience, SQL | docs + backend | s |
| **C2 Views migration** | `v_cycle_funnel`, `v_weekly_engagement`, `v_participant_journey`, `v_cohort_retention`, `v_preregistration_pipeline`; service-role read; `is_test`/`is_staff` excluded | migrations | m |
| **C3 `/admin/insights`** | cycle selector; five blocks; CSV export per block; div-bars per the moderator Insights precedent | frontend | l |
| **C4 Lab slice** | the same blocks filtered by `lab_id` on `/lab/[slug]` (read-only) — the lab lead's recruitment view | frontend | s |
| **C5 Admin digest (optional)** | Monday email from the views | backend | s |

**Acceptance:** an admin answers "how is this week's compliance vs last week", "how many
pre-registered for next cycle, by lab", and "what share of the Summer cohort came back"
from one page, without a CSV.

### Workstream D — Platform hygiene (carried)

| # | Item | Size |
|---|---|---|
| D1 | `email_log` written by every sender; idempotency helper | m (shared with A3) |
| D2 | `supabase db push` on merge to `dev` (#77, dev half) once 0.4 lands | s |
| D3 | Dead enrollment vocabulary pruned; `stepped_back` reserved with a comment | s |
| D4 | Danger Zone discoverability (#383); bans policy scoping (#384) — owner console | s / decision |
| D5 | Registration routing is metro-blind (#212) — verify against `00067` semantics; close or fix | s |

---

## 4. Sprint 2 — Activity spine & scale (Oct 27 → Dec 5)

| Epic | Scope | Spec |
|---|---|---|
| **S2.1 `activity_events` spine** | table + writer helper; ceremonial verbs from existing write paths; `visibility` RLS; views repointed | data strategy §4 |
| **S2.2 Feed reader v2** | events interleaved with shares on `/directory` and profiles; reactions decision | SOCIAL_LAYER B2/B3 |
| **S2.3 Slack identity + provisioning** | ADR-0003 (PR #391) first slice: identity table, reconcile cron, `#intros` verification → readiness step 4 verified; channel provisioning from admin | #189 Parts C–D, H; ADR-0003 |
| **S2.4 One calendar** | Stage 2 page sweep; drop mirror columns; retire `anchor-events.ts`; events anchors upserted from `cycle_events` | data strategy §7 |
| **S2.5 Mentor lite** | mentor-intent list, per-event/pod briefing page (the work-day #4 paper briefing, productized), outreach log reuse | personas §3.5 |
| **S2.6 Learning Log write-up export** | the "record you'll draw on" promise (#361): per-member cycle export, per-project digest | #361 |
| **S2.7 Data catalog + erasure test** | PII class / writers / erasure / retention columns; FK-walk test; #383 gap closed structurally | data strategy §9 |
| **S2.8 Curriculum in-product** | M0–M4 videos in `/library`; ladder links; `weekly_messages` for weeks 0–2 authored from the curriculum | curriculum brief |
| **S2.9 Baseline migration snapshot** | after the Summer cycle archives | `supabase/CLAUDE.md` |

---

## 5. Dependencies

```
0.4 ledger ──► D2 db push on dev
0.5 ADRs ──► (nothing blocks on them; they unblock reviewers)
0.10 kickoff date ──► A3 drip offsets, A4 dates, A1 copy
D1 email_log helper ──► A3 drip, B5 digest, C5 digest
C2 views ──► C3 page, C4 lab slice, A7 pipeline block, B3 loop numbers
B2 outreach_log ──► B3 loop, B5 digest
#378 decision ──► B4 scoping ──► B6 project digest
ADR-0003 identity (S2.3) ──► ladder step 4 verified (A2), Slack DM channel (A3 v2)
```

Nothing in Sprint 1 depends on the activity spine; the views compute from tables
until S2.1 repoints them.

---

## 6. Capacity and parallelism

Zones from `docs/agent-teams.md`, one owner each, per sprint:

| Zone | Sprint 1 load | Notes |
|---|---|---|
| `frontend` | A1, A4, B1, C3, C4 | the heaviest zone; A1 + A4 first |
| `backend` (`lib/`, `app/api`) | A2, A3, A5, B2–B5, D1 | the enrollment/moderator area stays single-owner |
| `migrations` | A3 table, B2 table, C2 views, A6 columns, D3 | claim numbers `00104`+ on the issue first |
| `docs` | C1, vault notes, `docs/README.md` upkeep, steward triage | |
| success team | A8, drip copy, ladder copy | via the curriculum session |

If capacity is one engineer plus Claude Code: A1 → A4 → A3-v1 (the Oct 10 set) → C2 →
B1/B2 → C3 → the rest. B and C are each independently shippable.

---

## 7. Owner decisions this plan needs (vault `proposed` notes, owner + date)

| ID | Decision | Recommendation | Blocks |
|---|---|---|---|
| D1 | Next cycle kickoff date and theme; announce at the Showcase? | decide in Sprint 0; announce Oct 13 | A3, A4 |
| D2 | Revocation cron vs compliance nudge: who owns `at_risk`; write `inactive` by cron, sweep, or both | nudge owns `behind`; cron owns `at_risk` warn→revoke; schedule cron after one dry-run week | 0.6 |
| D3 | Pods→Projects poderator scoping (#378) | Option A (cycle-level visibility) for the build phase | B4 |
| D4 | Social-proof floor and where counts show | ≥ 5 per lab; dashboard + `/c/[id]` | A1, A4 |
| D5 | Drip channel and cadence; lapsed nudge | email in S1, Slack DM in S2; T-8/6/4/3/2/1w/1d; one lapsed nudge at 21 days | A3 |
| D6 | Alumni state: automatic at close-out? | yes (state), communications remain consent-gated | A5 |
| D7 | Metrics: exclude staff/test by default; no open/click tracking | yes; yes | C2 |
| D8 | Outreach log visibility | pod's poderators + admins; never members; lab lead sees counts only | B2 |
| D9 | `seeking_contributors` on graduated projects — who toggles | any DRI; admins | A5 |
| D10 | Docs owner (framework §9) | the maintainer running the feedback lists | 0.2 |
| D11 | Activity-event retroactivity (S2) | backfill agreements/pods/projects; not logs | S2.1 |
| D12 | Knowledge repository — **decided 2026-09-25: `TheUpskillingLabs/Docs-repository`** (created by the owner; first publish pushed by hand). Remaining: who administers it; the publish token (fine-grained PAT vs GitHub App); archive `docs-archive` | PAT held by the owner until an App is worth it | 0.12 |
| D13 | Executive meeting date and attendees (project setup, context documents, auditable trail) | week of Oct 5, before Sprint 1; outcomes become vault notes | 0.13 |

---

## 8. Status (update at the weekly triage)

| Item | State | Note (2026-09-25) |
|---|---|---|
| Planning PR (`claude/olos-roadmap-documentation-yjebim`) | pushed, **not yet opened as a PR** | blocks everything below; open it into `dev` |
| PR #391 (vault) / #390 | still open | merge #391, close #390 (0.1) |
| Labels, milestones, board | not created | 0.2 |
| Ledger reconciliation | not started | 0.4 |
| Knowledge-repo bridge | destination decided (`Docs-repository`); first publish + `program/` + `governance/` pushed by hand; token not set, workflow inert | 0.12; D12 |
| Executive meeting | [#392](https://github.com/TheUpskillingLabs/OLOS/issues/392) filed 2026-09-25; agenda + pre-reads in the issue | 0.13; D13 — propose week of Oct 5 |
| Sprint 0 | re-baselined to Sep 28 → Oct 9 | awaiting ratification of §7 D1, D2, D10, D12, D13 |
| Sprint 1 | proposed | Showcase slice is decision-gated (D1 by Oct 2) |
| Sprint 2 | proposed | |

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| The Oct 10 date is tight for A1 + A4 + A3-v1 | A4 is mostly copy over an existing page; A3-v1 is one table, one cron, three messages; A1 reuses the task queue. Cut A2's manual ticks to Oct 17 if needed. |
| Restructuring changes who owns what mid-sprint | the framework's ownership matrix and the board make hand-offs explicit; every epic has a zone, not a name |
| Drip email lands as spam or over-sends | dry-run default (the compliance-nudge pattern), `email_log` idempotency, consent gate, one CTA per message |
| Metrics expose individuals | aggregate views; `is_test`/`is_staff` excluded; poderator sees own pods only; lab lead sees counts |
| Vault and framework become ceremony | the steward reports drift weekly; the retro at day 10 tunes the checks; no ADR quotas |
| Ledger reconciliation on prod goes wrong | metadata-only SQL, dev first, fingerprint before/after, vault workflow note |

---

## 10. Issue seeds (ready to file — one per row, `Closes` from the PR)

| Title | Type | Labels | Size | Milestone |
|---|---|---|---|---|
| Reconcile `schema_migrations` ledger on dev and prod (metadata only) | Task | area/ops priority/p0 | s | Sprint 0 |
| Cron auth fail-closed sweep for the five older crons | Bug | area/backend priority/p1 | s | Sprint 0 |
| Enrollment state-machine reference doc + CHECK/TS vocabulary test | Task | area/docs area/backend priority/p1 | s | Sprint 0 |
| Backfill ADR-0004…0008 into `docs/vault/` | Task | area/docs priority/p1 | m | Sprint 0 |
| Decide at-risk ownership: revocation cron vs compliance nudge (#213, #362) | Task | needs-decision area/ops priority/p1 | s | Sprint 0 |
| Between-cycles dashboard mode: the two lists (A1) | Feature | persona/pre-registrant area/frontend area/backend priority/p1 | l | Sprint 1 |
| Readiness ladder with verified + manual steps (A2) | Feature | persona/pre-registrant area/frontend area/backend | m | Sprint 1 |
| Pre-cycle drip: `scheduled_messages` + admin form + cron (A3) | Feature | persona/pre-registrant area/backend area/database priority/p1 | l | Sprint 1 |
| Public cohort page v2 and DB-backed `/build-cycles` (A4) | Feature | persona/pre-registrant area/frontend priority/p1 | m | Sprint 1 |
| Alumni & contributor pathways: `seeking_contributors`, interest capture (A5) | Feature | persona/pre-registrant persona/upskiller area/backend | m | Sprint 1 |
| Waitlist v2: three optional fields + lab-less dashboard copy (A6; feedback #11) | Feature | persona/pre-registrant area/backend | s | Sprint 1 |
| `email_log` written by every sender + `alreadySentWithin` helper (D1) | Task | area/backend priority/p1 | m | Sprint 1 |
| Poderator outreach tab: unified queue (B1) | Feature | persona/poderator area/frontend | m | Sprint 1 |
| `outreach_log` table + mark-contacted (B2) | Feature | persona/poderator area/database area/backend | m | Sprint 1 |
| Outreach → response loop on Insights (B3) | Feature | persona/poderator area/backend | s | Sprint 1 |
| Pods→Projects poderator scoping + project log view (B4; #378) | Feature | persona/poderator needs-decision | m | Sprint 1 |
| Weekly poderator digest email (B5) | Feature | persona/poderator area/backend | s | Sprint 1 |
| Metrics dictionary `docs/reference/metrics.md` (C1) | Task | area/docs persona/admin | s | Sprint 1 |
| Metrics views migration (C2) | Feature | persona/admin area/database priority/p1 | m | Sprint 1 |
| `/admin/insights` v1 (C3) | Feature | persona/admin area/frontend priority/p1 | l | Sprint 1 |
| Lab-scoped insights on `/lab/[slug]` (C4) | Feature | persona/lab-lead area/frontend | s | Sprint 1 |
| `activity_events` spine + writer helper (S2.1) | Feature | area/database area/backend | l | Sprint 2 |
| Slack identity table + reconcile cron + intro verification (S2.3; #189, ADR-0003) | Feature | area/backend area/ops | l | Sprint 2 |
| One calendar: Stage 2 page sweep, drop mirror columns, retire anchor constant (S2.4) | Task | area/frontend area/database | l | Sprint 2 |
| Mentor lite: intent list + briefing page (S2.5) | Feature | persona/mentor | m | Sprint 2 |
| Learning Log write-up export (S2.6; #361) | Feature | persona/upskiller | m | Sprint 2 |
| Data catalog columns + erasure FK-walk test (S2.7; #383) | Task | area/database area/docs | m | Sprint 2 |
