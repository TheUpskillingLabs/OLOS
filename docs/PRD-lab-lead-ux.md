# PRD: Local Lab Lead UX — "Lab-first, not admin-lite"

*Status: plan of record for the lab tier. Companion to `docs/PRD-admin-org-separation.md` — the same separation method, one axis over (lab-vs-HQ instead of org-vs-participant). Home for the #117/#123 re-scoping.*

---

## 1. Context & problem

Meet **Dana, the DC Lab Lead**. She is not a database administrator; she is a community organizer with a weekly rhythm and a quarterly one:

- **Weekly:** files her Friday Leadership Log (composed over her workstream leads' Thursday logs), posts announcements and lab-page updates, answers "who's new, who's stuck" about her pods, invites people she met at events.
- **Quarterly:** recruits her operating team onto workstream runs when DC's internal cycle opens, shepherds her lab's pods through the shared HQ cycle, and watches the projects those pods produce toward finalization.
- **Rarely:** asks HQ for things only HQ can do — open/close a cycle, promote a city, appoint a co-lead lab lead.

Today Dana's entire world is one buried radio button ("View as → Lab lead") pointing at a single six-section scroll page assembled from HQ admin components: voting-centric copy, buttons that 403 (`Finalize projects`), promises the page can't keep ("Runs charter into the lab's internal cycle each quarter" with no charter control), and an invite dropdown offering combinations its own API rejects. Meanwhile the API layer *already trusts her* with almost everything she needs. **The design task is not new authority; it is giving an existing, well-scoped authority a coherent home** — and simultaneously getting her lab's data *out* of HQ's screens (today `/admin/org`'s roster pick can silently absorb a lab's internal cycle).

The owner's framing: lab lead and HQ admin "aren't mutually exclusive roles — but they are not implicitly overlapping." The design principle that follows: **roles overlap by assignment, never implicitly.** A person may hold both hats; no *surface* may serve both hats at once.

The organizing frame, stated once and applied everywhere:

> **A lab is a lens over shared machinery.** `/lab/[slug]` means `lab_id = this lab`. `/admin/org` means `lab_id IS NULL`. `/admin/labs/[slug]` is the *only* place HQ crosses over. HQ things appear in the lab workspace read-only and labeled; lab things never appear in HQ's org home. **The URL is the hat**: chrome, nouns, and affordances are determined by the route family, never by the viewer's maximal role.

The org-separation PRD proved this method on this exact codebase: personas → a home per world → mode-aware nouns → sectioned shared surfaces → hide inapplicable machinery → **never let a 4xx be the scoping mechanism**. The lab tier re-created every failure that PRD fixed, one axis over. Because the data model is already cleanly "NULL = HQ" everywhere, nearly the whole design is *filters and framing*, not new capability.

### The HQ ↔ Lab mirror (onboarding mental model)

This table is both PRD orientation and the new-lead welcome copy:

| | HQ | A Local Lab (e.g. DC) |
|---|---|---|
| Console home | `/admin` | `/lab/dc` |
| Internal quarterly cycle | HQ org cycle (`mode='org'`, sector `the-upskilling-labs-hq`) | Lab org cycle (`mode='org'`, `lab_id=dc`) |
| Standing teams | HQ workstreams (`lab_id NULL`) | Local Workstreams (`lab_id=dc`) |
| Quarterly teams | HQ Core Contributors (org-run rosters) | DC Core Contributors (lab-run rosters) |
| Community tier | All metros, all pods | DC's metro roster; DC's slice of the shared community cycle |
| Portfolio | All projects | Lab Projects (projects born from DC pods) |
| Crossover surface | `/admin/labs/[slug]` (HQ reaching in) | Crossover chip → `/admin/labs/dc` (admins only) |

---

## 2. The role model

### 2.1 Who sees what

| Persona | Home | What they see | What they never see |
|---|---|---|---|
| **Plain member** | `/dashboard` | Their pods, cycle, lab public page | Any `/lab/*` or `/admin/*` management surface |
| **Core Contributor (lab)** | `/dashboard` (+ `/moderator` if co-lead) | Their workstream run, roster, logs | Lab-wide management; other runs' internals |
| **Lab Lead** | `/lab/[slug]` | Everything with their `lab_id`: workstreams, pods, people, projects, announcements, their lab's own org cycle (incl. its lifecycle, Decision 3) | Anything `lab_id NULL` (HQ resources); the HQ open cycle's lifecycle controls; role minting beyond pod-tier |
| **HQ Admin** | `/admin` | Everything `lab_id IS NULL` on `/admin/org`; per-lab drill-in at `/admin/labs/[slug]`; the lead's exact view on `/lab/*` | Lab data mixed into `/admin/org` (by design, post-Phase 0) |
| **Dual-hat (admin + lead)** | Both | Determined **by URL, not by role**: on `/lab/dc/*` they see what Dana sees; on `/admin/*` they see HQ | Mixed chrome; viewer-role-conditional buttons on `/lab/*` |

### 2.2 The authority contract (matches shipped guards; no permission changes needed)

| Capability | HQ admin | Lab lead (own lab) | Guard (existing) |
|---|---|---|---|
| HQ open-cycle lifecycle | ✅ | ❌ | `withAdminAuth` on `/api/cycles` |
| Create the lab's own org cycle | ✅ | ✅ (Decision 3; guard: `withAuth` + `requireLabAccess(lab_id)` on `POST /api/cycles`) | `withAuth` + `requireLabAccess(lab_id)` |
| Activate/close the lab's own org cycle | ✅ | ✅ (Decision 3; additive `requireLabAccessForCycle` on PATCH status, org mode only) | `requireLabAccessForCycle` (additive) |
| Appoint/remove lab leads; promote waitlist labs | ✅ | ❌ | `/api/labs/[id]/leads*`, `canGrant` (`grants.ts:93-96`) |
| Create/edit lab workstreams; toggle dormant | ✅ | ✅ | `requireLabAccess` via `labForWorkstream` |
| Charter a run of a lab workstream into the lab's org cycle | ✅ | ✅ *(API yes, UI missing — the gap)* | `runs/route.ts:46-49` |
| Pod rosters, poderator/co_lead assignment, pod status | ✅ | ✅ | `requireLabAccessForPod` (`lib/auth/lab.ts:72-78`) |
| Cycle-addressed management inside the lab's cycles | ✅ | ✅ | `requireLabAccessForCycle` (`lib/auth/lab.ts:81-87`, **already shipped**) |
| Finalize projects on the lab's pods | ✅ | ✅ (pod-moderator ✅ also) (Decision 6) | additive guard: admin OR pod-moderator OR lab lead |
| Invitations into lab pods/runs (no role presets) | ✅ | ✅ (see §6.3 for the honest contract) | `/api/invitations` + `labForPod`/`labForCycle` |
| Lab announcements + lab public-page posts | ✅ | ✅ | `requireLabAccess` + `is_lab_lead()` RLS |
| Anything with `lab_id NULL` (HQ resources) | ✅ | ❌ | `requireLabAccess` fail-closed |
| Global roles, role presets, permissions, `is_staff` | ✅ | ❌ | `canGrant` |

This is already the right shape: **HQ coordinates the calendar; leads run everything inside the lab including their own internal cycle; leads manage but never mint** — with the deliberate attenuation that they *may* grant pod-tier roles (poderator/co_lead/member) inside their lab (`grants.ts:97-103`). The UX below makes the table legible; it does not amend it.

### 2.3 The dual-hat person

- On `/lab/dc/*`, an admin sees **exactly what Dana sees** — same pages, same disabled states, same empty states, same hidden controls (see §3.4 on Finalize). Fidelity is the feature: it's how HQ debugs and supports leads. The only addition is the crossover chip.
- **Crossover chip pair** (the explicit two-way hat-switch): on `/lab/[slug]`, admins-only chip *"HQ view of this lab → /admin/labs/[slug]"*; on `/admin/labs/[slug]`, chip *"Open lab workspace → /lab/[slug]"*. These two chips are the *entire* crossover surface.
- The persona pill on `/lab/*` reads **"Lab lead — DC"** (named, because multi-lab leads are legal in the model), with the existing "Exit to member view."
- **Name-the-scope destructive confirmations**: every destructive or high-blast-radius confirm names its world — *"Force-close pod Cedar in **DC Lab**?"* vs. *"…in **HQ org cycle Q3**?"*. Extends the org-separation PRD's P-8/B-4 pattern to the lab axis; ships in Phase 0. This is the cheap insurance against dual-hat mis-clicks.

### 2.4 Appointment plumbing (HQ-side)

- Appointment stays on `/admin/labs/[slug]` (LabLeadsPanel) — the one HQ crossing point. Do **not** add `lab_lead` to the Access console's GrantRoleForm.
- The Access console's read-only "Lab leads" section gets a per-row "Manage → /admin/labs/[slug]" link so the grant is *findable* from the page named for the job.
- **Engineering freeze:** two write paths exist (`lab_leads` table + trigger vs. `grants.ts`, which nothing calls for `lab_lead`). Rule: *all* `lab_lead` writes go through `/api/labs/[id]/leads` → `lab_leads` → trigger, until the flags→roles unification retires the legacy table. Correct the stale claim in ORG_CYCLES §6 ("participant_roles is write-only") while in there.
- **Appointment notification is a real backend delta, not a link change.** No email fires anywhere on the leads POST path today (Resend infrastructure serves only the invitations flow). §8 specifies the template + send hook. **Until it ships, the Dashboard "Your lab" card (§3.2) is the actual onboarding surface a newly appointed lead encounters.**

---

## 3. The Lab Lead's home & navigation

### 3.1 Entry points (two, not five)

1. **Top-level nav item** for any lab lead: a labeled destination **"DC Lab"** (the lab's *name*, not the words "lab lead"), alongside Dashboard/Cycles — the same promotion the Poderator persona earned with `/moderator`. If `labLeadLabIds.length > 1`, the item becomes a switcher (lab names → `/lab/[slug]`), alphabetical. Fix `layout.tsx`'s `labLeadHref` by dropping `.limit(1)` and fetching all led labs. Do **not** enforce one-lead-one-lab (the model is many-to-many; DC-only today makes the switcher nearly free now, painful to retrofit). MRU defaulting is deferred until a second active lab exists.
2. **Dashboard "Your lab" card** on `/dashboard`: lab name, pod count, Leadership Log due state, link to `/lab/[slug]`. This is the first thing a newly appointed lead sees.

**Cut** the "View as → Lab lead" avatar-menu radio once the nav item ships — redundancy dressed as onboarding. The appointment email (§8) deep-links to `/lab/[slug]` when built.

### 3.2 The workspace tree

Today: one page, six stacked sections, admin components verbatim. Design: a small tabbed tree under the existing `/lab/[slug]/layout.tsx`, organized by **Dana's tasks**, guarded tree-wide by the existing `requireLabLead(slug)` (admin OR lead, fail-closed).

MVP tab set (honest about DC-today, where most quarterly surfaces open empty — see §7):

```
/lab/[slug]                        Home — "This week"
/lab/[slug]/pods                   Community pods (DC's slice of the shared cycle)
/lab/[slug]/people                 Core Contributors + Community + Invitations
/lab/[slug]/cycles/[cycle_id]      Lab-side cycle workspace (Phase 2, see §4.2)
```

Workstreams and Announcements start as **sections on Home** (Announcements already works; Workstreams is empty until DC's first org cycle). Workstreams is promoted to a tab in Phase 2 with the chartering UI; a **Projects** tab appears when the first project row exists.

### 3.3 Home — "This week"

Not a data dump; a rhythm page.

**a) The Friday ritual card.** The lead's Leadership Log: due date from the lab org cycle's `leadership_log_due_at` cascade, compose CTA, read-only stack of workstream leads' Thursday logs (the 00069 cross-tier read exists). *Empty state (DC today, no org cycle):* "No internal cycle yet — this is where your core contributor team runs quarterly workstreams. Create your first cycle." (the create form lives on the card) — never a silent blank. UI copy says **"Workstream Lead"** (unifying `workstream_lead`/`co_lead` naming). The lab public-page link sits here as part of the weekly public-voice rhythm.

**b) Two cycle-context cards — the single most important disambiguation in this design.** The current flat cycle list merges two fundamentally different objects; split them permanently:

- **"Community cycle (shared with all labs)"** — the HQ open cycle: phase, DC pod count vs. `max_pods`, DC enrollee count. Actions link into `/pods`. Copy: *"HQ runs this cycle for every lab; you manage DC's pods inside it."* Read-only lifecycle, by design.
- **"DC internal cycle"** — the lab's `mode='org'` cycle: status, run count, roster size, log dates. Links into the lab-side cycle workspace (§4.2) and `/people`. *Empty state:* "No internal cycle yet — this is where your core contributor team runs quarterly workstreams. Create your first cycle." (the create form lives on the card).

**c) Two inline banners** (not a generalized inbox — see §7): a pod without a poderator; an unfiled Leadership Log. Each links to the fixing page.

### 3.4 Community pods (`/lab/[slug]/pods`)

The lab's sub-cohort of the shared HQ cycle. Reuse `PodsTable` with four fixes:

1. **Finalize renders on `/lab/*` for anyone the page guard admits, backed by the widened API** (Decision 6): admin, pod-moderator, and lab lead all see and can use the button on their lab's pods. (Superseded the v1 delegation-cue design.)
2. **Member picker pre-filtered to lab members** (`participants.metro_id = lab.id`) for open-cycle lab pods, so the 00068 DB fence is never the first line of defense a user sees.
3. **Poderator cross-link:** when the viewer `isModeratorForPod`, the pod row links to its `/moderator` pod page — the lead-who-is-also-poderator dual-hat is far more common than admin+lead, and this one line closes the loop those people walk daily.
4. Section header names the context: "Pods in the shared community cycle — DC's slice."

Poderator/co-lead assignment and pod status stay (API-backed). Cycle lifecycle absent, per contract.

### 3.5 The symmetric fix: get the lab out of HQ's screens

The owner's complaint runs both directions, and the HQ half is cheaper and more urgent (production is live and `/admin/org` will silently absorb DC's first internal cycle):

1. **`/admin/org` filters to `lab_id IS NULL`** — cycles query, workstreams directory, and above all the `rosterCycle` pick (today "first active org cycle" can land on a *lab's* cycle and swap HQ's entire Core Contributor roster for DC's team on start-date ordering). Pin it to the HQ stream.
2. **Admin cycle workspace Formation tab scopes to the cycle's stream:** workstream list filtered to the cycle's lab (or NULL); "Copy roster from…" limited to same-stream prior cycles. Wrong-stream options currently fail with 400/404 — errors standing in for scoping, the exact anti-pattern the org-separation PRD fixed.
3. **`/admin/labs/[slug]` becomes HQ's complete per-lab console:** it already has lead appointment and lab-cycle creation; add read-only summaries (workstreams, pods, projects counts) and the "Open lab workspace →" crossover chip.
4. **Noun hygiene ships in Phase 1, not "pending decision":** three live "Core Contributor" collisions get qualified labels — the `/admin/people` permissions-editor `is_staff` toggle becomes "HQ Core Contributor (visibility flag)"; `/admin`'s org section headers (`admin/page.tsx:160`) and the cycle workspace's "Core contributors" tab label (`cycles/[cycle_id]/page.tsx:534`) get lab-name qualification on lab org cycles, via the existing mode-aware noun mechanism in `lib/cycle/labels.ts` (extend with a lab qualifier).

---

## 4. Managing Local Workstreams

The owner's first named surface, and the biggest UI↔API gap: **leads are authorized to charter runs (`POST /api/admin/workstreams/[id]/runs`, guard at `runs/route.ts:46-49`) but the only chartering UI lives behind `requireAdmin`.**

### 4.1 The directory (`/lab/[slug]/workstreams`, Home section → tab in Phase 2)

- Lab-homed workstreams only (reuse `WorkstreamsDirectory` with `labId` — already wired), lab-flavored copy replacing HQ org language.
- Per-row **"Charter run this cycle"** when the lab has an active org cycle — the button links into the lab-side cycle workspace (§4.2), where the run is created and its roster managed. **One door per object per hat.**
- Run row (when chartered): roster summary, "Manage team →" into the cycle workspace, link to the run pod.
- Create/edit/dormant: existing lead capabilities, kept.
- *Empty states:* no org cycle → "Runs charter into your internal cycle each quarter. No internal cycle is open — create one." (replacing today's dead "No run this cycle"); no workstreams → "Standing teams that persist across quarters. Create your first —" with the create form.

### 4.2 The lab-side cycle workspace (`/lab/[slug]/cycles/[cycle_id]`)

The lead's quarterly run/roster work needs the full cycle-workspace capability (Formation tab, chartering, roster pickers). The path there:

- **Extract the cycle workspace into a shared component** and **mount it under `/lab/[slug]/cycles/[cycle_id]`** with lab chrome, lab-scoped data assembly, and the existing `requireLabLead` page guard. Data-assembly scoping: workstream list = the lab's workstreams; "Copy roster from…" = this lab's prior org cycles only (the admin version's unfiltered dropdown 404s cross-stream; the lab version never offers wrong-stream options).
- **`/admin/cycles/[cycle_id]` stays admin-only and untouched.** We explicitly do *not* guard-swap the admin route to `requireLabAccessForCycle`: routing leads through an `/admin/*` URL would break "the URL is the hat" (HQ chrome, a second crossover), require restructuring the admin layout's tree-wide `requireAdmin`, and demand per-control `isAdmin` surgery on lifecycle/phase/Dev-tab machinery. Mounting the shared component lab-side gets identical capability without touching the admin tree.
- Lifecycle controls for the lab's own org cycle are lead-accessible (Decision 3), with phase/config widening arriving with the lab-side mount.
- Note: `requireLabAccessForCycle` **already exists** (`lib/auth/lab.ts:81-87`) and guards the cycle-addressed API routes this workspace calls; no new guard helper is needed.

---

## 5. Managing Lab Projects

### 5.1 What "Lab Project" means

Currently a join with no noun in the product: `pods.lab_id = lab.id → projects.pod_id`. Give it the noun with a portfolio page (`/lab/[slug]/projects`, tab appears when the first row exists):

- Sectioned by source: **Community projects** (open-cycle pods) and **Workstream projects** (org-run pods). Columns: project, pod, cycle, status/governance, DRI. Rows link to the existing global project pages — no lab fork of project detail.
- **The portfolio is historical, not just current.** The `pods.lab_id` join survives pod dissolution and governance flips at close-out; the page sections "This cycle" vs. "Past cycles," and projects persist under their durable workstreams across cycles (Decision 5). A lab's portfolio is its track record.

### 5.2 The pre-graduation management contract (ratified here)

LOCAL_LABS.md grants leads "projects pre-graduation"; this PRD states what that *is* in v1:

> **Leads operate: they finalize (Decision 6) and hold the roster levers; poderators run the day-to-day inside the pod.** Leads still do not mint `dri`/`contributor` (excluded by `canGrant`, `grants.ts:104-107`).

Candidate v2 write affordances, deliberately not built now: *flag a stalled project*, *propose a DRI to admin*.

### 5.3 The upstream pipeline: problems & ballot

Projects are born from ballot-winning pods, and `problem_statements.metro_id` drives per-lab ballots (00068) — so "how leads manage Lab Projects" starts one step earlier than the portfolio. v1 ships a **read view**: a "Problems & ballot" section (on `/projects`, or Home during ballot phase) showing DC's problem statements, ballot participation counts, and which problems won (i.e., seeded pods). Whether leads *curate* — create/edit/seed DC problem statements before the ballot — is a real authority question, not a filter: **Decision 10** has landed — leads curate their lab's problems; the UI is a Phase-2 build item. Until it ships, curation stays operationally admin-side and the lab view is observational.

---

## 6. Managing Core Contributors per-lab

`/lab/[slug]/people` — today's "Members" table conflates Dana's operating team with her whole metro community. Three sections:

### 6.1 Core Contributors (DC)

**Definition:** members and co-leads of the lab's org-cycle workstream runs (`pod_memberships` + `moderator_assignments` on runs of lab-homed workstreams) — the per-lab twin of what `/admin/org` computes for HQ. **Extract `/admin/org`'s roster derivation into a shared `getCoreContributors(cycleId)` helper called at both scopes**, so HQ's and each lab's rosters are definitionally the same code path.

- Grouped by workstream; co-leads badged as **Workstream Leads**. "Add core contributors →" links into the run's roster management in the lab-side cycle workspace (§4.2).
- **Between-cycles fallback:** the definition is cycle-ephemeral, and HQ has the persistent `is_staff` flag while labs have nothing. So: when the lab has no *active* org cycle, the section shows **the most recent org cycle's roster**, headed "Your team from \<cycle name\>" — Dana's operating team always has representation. (Before DC's *first* org cycle, the section carries the create-a-cycle empty state, Decision 3.) A persistent per-lab team primitive is deferred to the flags→roles unification (§8).
- **The global `is_staff` flag never appears at lab scope** — it's an HQ concept; surfacing it would drift the lead's mental model into HQ's.
- Relationship to the HQ concept (per Decision 1): "Core Contributor" is one noun, always scope-qualified — "DC Core Contributors" = the lab's org-run roster; unqualified = HQ.
- Out-of-lab members on DC runs are **badged** ("based in \<metro\>") so cross-lab staffing is a visible choice, not an accident (Decision 2).

### 6.2 Community members

The metro roster (current table, kept), explicitly labeled: *"Everyone registered in DC — your community, not your staff."*

### 6.3 Invitations — offer only what `fulfillInvitation` actually does

The shipped invite form's cycle-only community invite 403s; the naive fix (cycle+pod) passes auth but is **semantically wrong**: on an open-cycle pod, an invite without `pod_role` fulfills as `moderator_assignments` only (legacy branch; the route's own comment at `route.ts:62-69` says direct participant membership must go through registration paths that enforce windows/`pod_limit`). "Invite a community member into a DC pod" would silently mint a **poderator**. The underlying truth: *a lab lead has no authorized path to invite a plain community member into the shared HQ cycle at all.* The UI must say what's true. Three affordances:

1. **"Invite a poderator for a DC pod"** — cycle + pod, no `pod_role`. The only open-cycle invite a lead can send, labeled honestly.
2. **"Invite to DC internal team"** — an org **run** + `co_lead`/`member` (fulfills via `ensureActivePodMembership`). The bare org-cycle option is **suppressed**: `labForCycle` resolves so auth passes, but a cycle-only org invite creates a phantom enrollee with no pod (the route's `pod_role` checks only fire when `pod_id` is set, `route.ts:83-95`). Never offer what the API will regret.
3. **"Share DC registration link"** — the community on-ramp, and the ratified terminal state (Decision 11): copy-link for `/local-labs/[slug]`. Registration sets `participants.metro_id`, and `requireActiveLabMembership` gates cycle joining; registration *is* the lead-shaped community invite.

### 6.4 Announcements

Works today; kept as a Home section (promoted to a tab if volume warrants). Keep the existing distinction: dashboard org-news (`AnnouncementsAdmin fixedLab`) vs. public voice (lab-page updates), cross-linked.

---

## 7. MVP vs. later — phased, honest about one active lab

DC is the only active lab; several quarterly surfaces open empty until HQ opens DC's first org cycle. The MVP is sized to that reality — fewer tabs, banners instead of inbox machinery, no request-queue infrastructure.

**Phase 0+ — this change series (shipped 2026-07-11).**
- `/admin/org` + Formation stream scoping.
- Self-serve org-cycle creation + activation (Decision 3).
- Finalize widening (Decision 6).
- Two cycle-context cards + lab-scoped member picker + out-of-lab badge.
- Honest three-affordance invite form + join link (Decision 11).
- `/moderator` lab sectioning (Decision 8).

**Phase 1 — Give the persona a home (~1 week).**
- Nav: top-level lab item + alphabetical multi-lab switcher (drop `.limit(1)`); named persona pill; crossover chip pair; Dashboard "Your lab" card. Cut the View-as radio.
- Split the page into the MVP tree: **Home / Pods / People** as tabs; Workstreams + Announcements as Home sections.
- People page: Core Contributors (via `getCoreContributors` extraction, with the most-recent-cycle fallback) / Community members / Invitations.
- Noun-collision fixes at all three sites via `labels.ts` (§3.5.4), once Decision 1 lands.
- Poderator cross-links on pod rows; mirror table (§1) as new-lead welcome copy.

**Phase 2 — Close the authority↔UI gaps (1–2 weeks).**
- Extract the cycle workspace to a shared component; mount at `/lab/[slug]/cycles/[cycle_id]` (§4.2). Promote Workstreams to a tab with per-row chartering into that workspace.
- `/projects` portfolio (read-mostly, historical sections) + problems/ballot read view; tab appears with the first project row.
- Home: Friday ritual card + the two inline banners; unify "Workstream Lead" copy.
- Appointment email (template + send hook, §8).
- `/admin/labs/[slug]` per-lab console completion (summaries + chip).
- **Re-scope issues #117/#123** against `requireLabAccessForPod`/`requireLabAccessForCycle` (they predate the role; semantics per Decision 9, specified here — not patched ad hoc).
- Problem-statement curation UI (Decision 10).
- Phase-window/config widening for lab org cycles inside the lab-side cycle workspace.

**Phase 3 — flags→roles riders (no blocking decisions remain).**
- `lab_lead` write-path consolidation and persistent lab-team primitive ride the flags→roles unification.

---

## 8. Schema/auth changes required

**No schema migrations for Phases 0–2.** Everything is filters, route-persona gating, component extraction, and derived pages. The real deltas, itemized:

| Delta | Kind | Phase |
|---|---|---|
| `/admin/org` + Formation-tab stream scoping | Query filters | 0 |
| Invite form rebuild (§6.3) | UI only; API untouched | 0 |
| `labLeadHref` drop `.limit(1)`, fetch all led labs | One query | 1 |
| `getCoreContributors(cycleId)` extraction, called at both scopes | Refactor | 1 |
| `lib/cycle/labels.ts` lab-qualifier extension; three label sites | Refactor | 1 |
| Cycle-workspace extraction + lab-side mount under `/lab/[slug]/cycles/[cycle_id]` (existing `requireLabLead` guard; admin tree untouched) | Component extraction + route | 2 |
| **Lab-lead appointment email**: new template (sibling of `lib/email/invitation-template.ts`), send hook or send button on `POST /api/labs/[lab_id]/leads`, Resend HTTP client reuse, `email_sent_at`-style tracking column on `lab_leads` | Small but real backend delta | 2 |
| `POST /api/cycles` guard widening — `withAuth` + `requireLabAccess`; writes move to the service client (`cycles_insert` RLS is admin-only; the app guard becomes the protection line — deliberate, no policy migration) | Route change | 0+ |
| `PATCH /api/cycles/[id]/status` additive lab-lead widening (org cycles) + 23505→409 mapping | Route change | 0+ |
| Finalize additive guard | Route change | 0+ |
| `/moderator` pods-list lab identity + grouping | Refactor | 0+ |

**Corrections & freezes recorded here:**
- `requireLabAccessForCycle` is **not** new — it exists at `lib/auth/lab.ts:81-87`. No new guard helpers are needed anywhere in this PRD.
- `lab_lead` write-path freeze: all writes via `/api/labs/[id]/leads` → `lab_leads` → trigger (nothing calls `grants.ts` for `lab_lead`); consolidation belongs to the flags→roles milestone in the AUTH runbook.
- Deferred, tracked not built: flags→roles for `is_staff` and a persistent per-lab team primitive; the `delete_participant()` erasure gap (omits `lab_leads` — erasing a lead FK-fails); ORG_CYCLES §6 stale "participant_roles is write-only" claim.

---

## 9. Decisions — RATIFIED 2026-07-11

1. **"Core Contributor" naming/scope.** **RATIFIED (as recommended).** One noun, scope-qualified ("DC Core Contributors" = the lab's org-run roster; unqualified = HQ); `is_staff` never surfaces at lab scope.
2. **Cross-lab membership on a lab's internal runs.** **RATIFIED (as recommended).** Cross-lab members on lab org runs allowed; out-of-lab members badged.
3. **Chartering line.** **RATIFIED — OVERRIDE.** Labs are self-service: leads create and run their own internal org cycles (create + activate/close). Owner's rationale, quoted: "OLOS is meant to be an open source project that all Labs are contributing to… we want this to be as self-service as possible. HQ is meant to be a lean AI-native startup." All "request from HQ" CTAs are dead; the pre-specified `lab_cycle_requests` queue (§8) is dead. Implementation: `POST /api/cycles` relaxed to admin-or-lead-of-`lab_id` for `mode='org'`; PATCH status likewise widened (org cycles, own lab). Phase windows/config widening rides the lab-side cycle workspace phase.
4. **Multi-lab leads.** **RATIFIED (as recommended).** Multi-lab alphabetical switcher; no MRU until lab #2; never one-lab-per-lead.
5. **Lab org project graduation destination.** **RESOLVED.** Lab org projects persist under their (durable) workstreams and typically contribute to OLOS itself. No theme-sector graduation flow exists or is needed. Kills the Phase-3 close-out/graduation UI.
6. **Finalize on `/lab/*`.** **RATIFIED — OVERRIDE.** Leads CAN finalize projects for their lab's pods (the recorded counter-position — "the wall is theater" — adopted). §3.4 item 1's delegation-cue design is superseded; guard widening is additive (admin OR pod-moderator OR lab lead).
7. **Dual-hat chrome.** **RATIFIED (as recommended).** Strict route-persona fidelity; crossover chips are the only hat-switch.
8. **`/moderator` for leads.** **RATIFIED — OVERRIDE.** `/moderator` gets lab sectioning too (mode sections stay primary; lab subsections appear only when >1 lab identity is present).
9. **#117/#123 intended semantics.** **RATIFIED.** #117/#123 closed on GitHub as superseded by this PRD (ops action, no code).
10. **Problem-ballot curation.** **RATIFIED.** Leads curate their lab's problem statements. Authority granted now; UI is a Phase-2 build item.
11. **Lead-sent community invites.** **RATIFIED (as recommended).** Community members join via the lab's public join link (`/local-labs/[slug]` — the join CTA sets `metro_id`; windows/`pod_limit` enforced by registration paths). No new invite API; the §8 contingency row is dead.

---

## 10. Appendix: considered and rejected

- **Relocating the lab console into `/admin/labs/[slug]` with a 301 of `/lab/[slug]` and a tree-wide `requireConsole()` layout guard** — reverses the documented "/admin stays admin-only" decision (LOCAL_LABS.md:129), puts the community-organizer persona inside HQ's namespace (the opposite of the complaint), throws away the shipped `/lab/[slug]` guard+layout, and demotes the admin layout gate from structural guarantee to per-page convention (fail-open by omission).
- **Guard-swapping `/admin/cycles/[cycle_id]` to `requireLabAccessForCycle` for leads** — initially grafted, then rejected on this PRD's own "URL is the hat" rule: leads inside `/admin/*` get HQ chrome, a second crossover point, and the swap requires restructuring the admin tree's `requireAdmin` plus per-control `isAdmin` surgery — comparable in cost to the extraction it claimed to avoid, while leaving two doors to the same object. Superseded by the lab-side mount (§4.2).
- **An "HQ controls" card (CreateCycleForm + LabLeadsPanel) embedded in the lab Overview for admins** — re-mixes HQ levers into the lab surface, breaking view-as fidelity. HQ levers live only at `/admin/labs/[slug]`, reached via the crossover chip.
- **Dual-hosting the full org-cycle workspace at `/admin/cycles/[cycle_id]` and `/lab/[slug]/cycle` as originally scoped (full extraction as the largest engineering item)** — the adopted version (§4.2) extracts once and mounts lab-side only, leaving the admin route untouched; the admin tree needs no changes.
- **Extending `canGrant` now so leads mint `dri`/`contributor` on lab projects** — don't build write affordances on the unresolved graduation model (Decision 5). Owner decision, not a Phase 1–3 build item.
- **Coining a new noun for lab teams ("Lab Team")** — fragments the staff→Core Contributor rename hours after it shipped. One noun, scope-qualified.
- **Enforcing one-lead-one-lab** — the model is many-to-many; the switcher is nearly free now, painful to retrofit. **MRU switcher defaulting** also rejected for now: multi-lab leads number zero; ship alphabetical, revisit at lab #2.
- **Adding `lab_lead` to the Access console's GrantRoleForm** — appointment needs lab context and stays on `/admin/labs/[slug]`; the Access console gets findability links only.
- **Near-term reroute of lab-lead appointment through the grants service** — the write-path freeze (§8) is the safer posture while two stores exist; consolidation belongs to the flags→roles milestone.
- **Committed in-app `lab_cycle_requests` queue at one active lab** — the lead can message the owner directly; the mailto/notification CTA is generous. Table shape pre-specified in §8 for when lab count grows; not a committed phase item.
- **Six-tab tree in Phase 1** — `/projects`, `/workstreams`, and the Core Contributors centerpiece open empty for the only extant lab. Honest MVP: three tabs + sections, tabs added when data exists.
- **Five-plus entry points for one persona** (nav item + pill switcher + View-as radio + email + dashboard card + welcome copy) — nav item and dashboard card cover discovery; the radio is cut; the email is a real Phase 2 delta, not a Phase 1 assumption.
- **Generalized Home "action inbox"** — two inline banners deliver the value for one lab with a handful of pods; a nudge framework can wait.
- **Keeping the current single-scroll `/lab/[slug]` page** — six sections outgrew one scroll, and the flat merged cycle list is itself one of the live confusion bugs.
- **Note (2026-07-11):** the in-app `lab_cycle_requests` queue and the Phase-3 project-graduation UI, both listed above and in §7/§8 as deferred-but-pre-specified, are now **dead**, not deferred — Decision 3 (self-serve lab org cycles) and Decision 5 (no graduation flow) remove the premise each was pre-specified for.
