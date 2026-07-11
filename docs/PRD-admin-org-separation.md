# PRD — Admin/Org Separation

| | |
|---|---|
| Status | 2026-07, owner-approved — shipping in **4 phases** on the `org-cycles` branch |
| Related personas | Priya, Marcus, Brendan (below) — persona walkthroughs against the Organizer archetype in [`personas.md`](personas.md) |
| Companion — data model | [`ORG_CYCLES.md`](ORG_CYCLES.md) — the org cycle / workstream schema and lifecycle this PRD's UI sits on top of. Read that doc first; this one only covers admin/moderator UI. |
| Companion — personas | [`personas.md`](personas.md) |
| Related code | `app/(dashboard)/admin/**`, `app/(dashboard)/moderator/**`, `lib/cycle/labels.ts` |

## 1. Personas

Three short recaps — see [`personas.md`](personas.md) for the general Organizer/Moderator archetypes these extend. All three are grounded in a code-level walkthrough of the shipped admin and `/moderator` surfaces as of this PRD's writing; findings are in §2.

- **Priya** — an admin who runs only the participant experience: recruiting, the formation phases, pods, Poderators, learning-log health, revocations. She never touches the org's own quarterly cycle. Everywhere the participant admin surfaces leak org concepts into her view is friction she has to mentally filter out.
- **Marcus** — an admin (exec/board) who runs only the org's internal quarterly cycle: workstreams, co-leads, staff, chartered projects. He has no participant-cohort responsibilities. Everywhere the admin surfaces assume a participant cohort — a ballot, a pod-voting step, a "Participants" label — is a surface that doesn't describe his job.
- **Brendan** — the owner, doing both at once, and also dual-enrolled as a member in both an org workstream and a participant pod. He is the persona most exposed to the two worlds colliding: the same nav, the same `/moderator` list, the same People & Access table, the same reminder email, serving both cycles without telling him which one he's looking at.

## 2. Findings index

Three tables, one per persona. Findings are numbered by persona (`P#`, `M#`, `B#`) and carry file:line evidence against shipped code. The Marcus and Brendan tables are condensed to the meaningful set of root findings — several user stories in §5 share one underlying finding.

### Priya — org intrusions on her surfaces (P1–P8)

| ID | Finding | Evidence |
|---|---|---|
| P1 | Type select on create-cycle form. Kept — benign, doesn't leak org state into her flow. | — |
| P2 | `/admin`'s cycle list has no mode signal, and org staff get counted under the "Participants" column header. | `admin/page.tsx:26,55-107` |
| P3 | The invite form's Cycle dropdown mixes org cycles in unmarked. | `people/page.tsx:82`, `invitations-table.tsx:200-207` |
| P4 | The invite form's Pod dropdown mixes workstream runs in unmarked. | `people/page.tsx:83-94`, `invitations-table.tsx:214-221` |
| P5 | The `pod_role` select silently mutates her invite flow the moment she mispicks an org pod. | `invitations-table.tsx:62-81,229-237` |
| P6 | People & Access flattens org enrollments and moderating assignments into the same chips as cohort data; `is_staff` isn't surfaced at all. | `people-table.tsx:128-168`, `people/page.tsx:19-22` |
| P7 | `/moderator` mixes workstream runs into her pulse-triage cards. | `lib/moderator/pods-list.ts:51-56`, `moderator/page.tsx:226-247` |
| P8 | The terminal-status button reads "Archive to sector" even on a participant cycle. | `cycle-status-form.tsx:20` |
| — | Pre-existing (not org-specific): the status-badge maps on the admin cycle pages miss `upcoming`/`closing`/`archived`, so a recruiting cohort reads as dead grey. | `admin/page.tsx:16-20` |

### Marcus — buried, mislabeled, or missing (M1–M8, condensed)

| ID | Finding | Evidence |
|---|---|---|
| M1 | No Organization nav item. Workstream CRUD is trapped inside a single cycle's Formation tab. There's no standing workstreams directory, and finding the panel at all requires knowing the magic path. | `admin-nav.tsx:34-63`, `[cycle_id]/page.tsx:203-238` |
| M2 | The tab is literally named "Formation" on an org cycle, which never has a formation window. | `cycle-workspace-tabs.tsx:51` |
| M3 | Overview stats are cohort-phrased: "Enrolled / Active / Pods." | `page.tsx:246-251` |
| M4 | The People tab is titled "Participants," and ships the pulse-check-derived revocation machinery pointed at staff who don't take pulse checks. | `page.tsx:326-347`, `revocations-section.tsx:16-20` |
| M5 | Configuration exposes phase-window and voting-threshold fields that mean nothing on an org cycle, and the PATCH endpoint writes any field the client sends with no mode guard. There is also no admin UI anywhere for `log_gate_paused`, despite the column existing and mattering to both modes. | `config/route.ts:28-49` |
| M6 | The pods table's copy is voting-centric even on org cycles: "Finalize pod voting," "Assign moderator," and a force-active confirm that references the `pod_min` check. | `pods-table.tsx:53-58,90` |
| M7 | No staff roster view exists anywhere — answering "who's on what workstream" means opening each run's pod page one at a time. | — |
| M8 | `/moderator` and the nav persona pill hardcode "Pod" / "Poderator" / "pulse" copy; `lib/cycle/labels.ts`'s mode-aware nouns are never imported into either surface. | `moderator/page.tsx:127-135,226-247`; `moderator/pods/[pod_id]/page.tsx:190,194`; `app-nav.tsx:50-54,71-73,323-326` |

### Brendan — wrong-world mis-action risk, ranked (B1–B6)

| ID | Finding | Evidence |
|---|---|---|
| B1 | `/moderator` blends both worlds into one flat "Pod" list — the worst of the six, since it's the one page where a co-lead card and a Poderator card sit in the same grid with no visual distinction. | see P7, M8 |
| B2 | People & Access flattens staff and cohort into the same table with no differentiation (same root cause as P6). | see P6 |
| B3 | The invite form's Pod picker differentiates workstreams from pods only after the fact, downstream in the `pod_role` select — not at the point of picking. | see P4, P5 |
| B4 | `/admin` has no mode column, **and** the finalize-voting / advance-phase actions carry no cycle-name confirmation — an irreversible mis-click across the two concurrently `OPEN` cycles (one participant, one org) is possible with no name check in the confirm dialog. | see P2 |
| B5 | The Learning Log cycle picker disambiguates by cycle name only, and the reminder email never names the due cycle — both matter specifically to a dual-enrolled member with two concurrent gate windows (`ORG_CYCLES.md` §4). | `learning-log-card.tsx:316-331`, `learning-log-reminder/route.ts:114-117` |
| B6 | The nav persona pill says "Poderator" even when every pod Brendan moderates is an org workstream run. | see M8 |

## 3. Route map (after-state)

The routes this PRD touches, who owns each one, and how it behaves once the phases below ship. Owner: **Participant** (Priya's surfaces), **Org** (Marcus's surfaces), or **Shared** (both, mode-aware).

| Route | Owner | Mode behavior after this work |
|---|---|---|
| `/admin` | Shared | Splits into two headed sections, "Participant cycles" and "Organization cycles" (P-1). |
| `/admin/org` | Org (**NEW**) | Org home: standing workstreams directory, org cycle cards, staff roster (M-1..M-4). |
| `/admin/cycles/[id]` | Shared | Mode-aware tabs, copy, and Configuration fields (M-2, M-5..M-11, P-8, P-9). |
| `/admin/people` | Shared | Staff + mode chips on the participants table; grouped invite dropdowns (P-3..P-6). |
| `/moderator` + `/moderator/pods/[id]` | Shared | Sectioned by Pods/Workstreams, noun-aware copy (P-7, B-1..B-5). |
| `/admin/content`, `/admin/explore` | Shared | Untouched by this PRD. |
| Member surfaces — `/dashboard`, `/cycles`, `/pods/[id]`, `/projects/[id]` | Shared | Already mode-aware (see §4). Untouched by this PRD. |

## 4. What already works — keep and build on

These are shipped, working pieces this PRD's stories extend rather than replace:

- **`lib/cycle/labels.ts`'s `podNoun`/`moderatorNoun`.** The mode-aware noun functions already exist and already power the pod page, the project page's breadcrumb, and the two surfaces below — they're just not imported into the surfaces this PRD's stories touch.
- **The `"organization"` StatusBadge on cycle detail.** `[cycle_id]/page.tsx` already renders a distinct badge next to the lifecycle badge when `cycle.mode === "org"`.
- **The member `cycles` page partition.** `app/(dashboard)/cycles/page.tsx` already filters `otherCycles` by `mode === "org"` to build a separate org-cycles list.
- **The dashboard's "Your workstreams" section.** Already shipped on the member dashboard.
- **Invite `pod_role` scaffolding and server-side validation.** `POST /api/invitations` already validates that `pod_role` is required on org-mode pods and forbidden on participant-mode pods. `api/invitations/route.ts:48-74`
- **`rejectOrgCycle` and `checkWindow` backstops.** Both already 403 or no-op the voting/formation mechanics an org cycle doesn't have — explicit guard plus an implicit backstop (`ORG_CYCLES.md` §5).
- **The workstreams panel and its APIs, including roster copy-forward.** `POST /api/admin/workstreams/[id]/runs` with `copy_from_cycle_id` already exists and is wired to the "Copy roster from…" control.
- **The `is_staff` hide-toggle pattern.** Already established in `roster-table.tsx`; §5's stories reuse the pattern rather than inventing a new one.
- **The revocation cron scoped to `mode='open'`.** `app/api/cron/revocation-check/route.ts` already filters to participant cycles only — org cycles were never swept into revocation logic that was never built for staff.

## 5. User stories

Grouped by persona. Each story: role, want, why; 2–4 acceptance criteria; a footer line citing the findings it closes, its phase, and how to verify it shipped.

### Priya

**P-1 — `/admin` split sections + per-mode count headers**

As Priya, I want `/admin` to separate participant cycles from organization cycles into their own headed sections, so that I don't have to open a cycle to find out which world it belongs to.

- `/admin` renders two headed sections, "Participant cycles" and "Organization cycles," each listing only cycles of that mode.
- The organization section's headcount column reads "Staff" instead of "Participants."
- Each section header shows its own cycle count (e.g. "3 cycles").
- Within each section, sort order is unchanged (start date, descending).

*Findings: P2, B4 · Phase: 4 · Verify: /admin shows "Participant cycles" and "Organization cycles" headings; org row count column reads "Staff"*

**P-2 — lifecycle badge colors complete**

As Priya, I want every cycle lifecycle state to render its own status color everywhere, so that a recruiting cohort doesn't look dead just because a page kept its own stale copy of the status-badge map.

- `/admin`'s cycle list and `/admin/cycles/[id]`'s header both source their `StatusBadge` variant from `lib/cycle/labels.ts`'s `cycleStatusVariant`, replacing each page's local, incomplete map.
- `upcoming` and `closing` render distinctly from the terminal `closed`/`archived` grey.
- No lifecycle state silently falls through to the "inactive" look for a state that isn't actually terminal.

*Findings: pre-existing · Phase: 4 · Verify: Civics & Elections (upcoming) renders teal "upcoming" badge on /admin*

**P-3 — invite Cycle dropdown optgroups**

As Priya, I want the invite form's Cycle dropdown to group participant cycles apart from organization cycles, so that I can't accidentally attach a participant invite to the org's internal quarterly cycle.

- The Cycle `<select>` on `/admin/people` renders two `<optgroup>` groups — "Participant cycles" and "Organization cycles" — driven by each cycle's `mode`.
- Cycle names inside each optgroup are unchanged; this is a grouping change only, not a rename.
- The default "None" option stays ungrouped at the top.

*Findings: P3 · Phase: 4*

**P-4 — invite Pod dropdown optgroups w/ workstream naming**

As Priya, I want the invite form's Pod dropdown to separate workstream runs from participant pods and label workstream options by their run name, so that I don't mis-invite someone as a pod member when I meant a workstream co-lead, or vice versa, before I even reach the `pod_role` select.

- The Pod `<select>` on `/admin/people` renders "Pods" and "Workstreams" optgroups, driven by each pod's cycle mode.
- Options inside "Workstreams" show the workstream/run name rather than falling back to a generic "Pod N."
- The existing `pod_role` sub-select (co-lead/member) continues to appear only when a workstream option is selected — unchanged from current behavior, just reachable through a clearer picker.

*Findings: P4, P5, B3 · Phase: 4*

**P-5 — staff chip + distinct org enrollment chips in People & Access**

As Priya, I want People & Access to visually distinguish org staff and org-cycle enrollments from participant cohort members, so the master people list stops reading as one undifferentiated bucket.

- Rows in the People & Access participants table show a "Staff" chip when the person carries org staff status.
- The Cycles column renders org-cycle chips in a visually distinct style from participant-cycle chips (not just status color).
- `is_staff` is added to the `participants` select on `/admin/people` so it's available to render.

*Findings: P6, B2 · Phase: 4 · Verify: /admin/people participants table shows a "Staff" chip on org-staff rows, and org-cycle chips render visually distinct from participant-cycle chips*

**P-6 — Moderating column distinguishes co-lead vs. Poderator**

As Priya, I want the Moderating column to say "Co-lead" for org workstream assignments and "Poderator" for participant pod assignments, so I'm not misreading a co-lead assignment as a volunteer Poderator one.

- The Moderating column's chips render `moderatorNoun(cycle.mode)` per assignment instead of just the pod name.
- Org-run assignments are visually distinguishable from participant-pod assignments, consistent with the Cycles column treatment in P-5.

*Findings: P6 · Phase: 4*

**P-7 — `/moderator` sections: Pods vs. Workstreams**

As Priya, I want `/moderator` to section workstream runs apart from participant pods, so a co-lead's workstream card doesn't sit inside my pulse-triage view next to my actual pods.

- The All pods view groups `PodSummaryCard` results into headed "Pods" and "Workstreams" sections whenever the signed-in admin/Poderator has cards in both.
- A single-mode Poderator sees no empty second section.
- Sort order within each section is unchanged (non-zero missing first, then alphabetical).

*Findings: P7, B1 · Phase: 4*

**P-8 — finalize-voting confirm names the cycle**

As Priya, I want the finalize-voting and advance-phase confirmation dialogs to name the specific cycle being acted on, so a mis-click between the two concurrently `OPEN` cycles can't silently finalize the wrong one.

- The `confirm()` copy for finalize-voting and advance-phase interpolates the target cycle's name (e.g. `Finalize pod voting for "Fall 2026 Upskillers"?`).
- Applies to every admin action currently gated as irreversible on a cycle-scoped route.

*Findings: B4 · Phase: 3*

**P-9 — archive button copy "Archive cycle"**

As Priya, I want the terminal lifecycle button to read "Archive cycle" instead of "Archive to sector" on a participant cycle, so the copy doesn't imply a sector-level action she never takes.

- `BUTTON_LABELS.archived` in `cycle-status-form.tsx` reads "Archive cycle" for `mode='open'` cycles.
- Org-mode cycles keep "Archive to sector" — the phrase is accurate there, since an org cycle really does archive into the org sector.

*Findings: P8 · Phase: 3*

### Marcus

**M-1 — Organization nav item → `/admin/org`**

As Marcus, I want an "Organization" item in the admin section nav that takes me to a home for the org's own cycle work, so I'm not hunting for workstream CRUD buried inside whichever quarter's cycle happens to be open.

- `AdminNav`'s item set gains an "Organization" entry linking to `/admin/org`, positioned after "Cycles."
- The item's active-match highlights for any `/admin/org*` path.
- `/admin/org` exists and renders, even as M-2 through M-4's content lands incrementally within the same phase.

*Findings: M1 · Phase: 2*

**M-2 — standing workstreams directory: create/rename/describe/status-toggle**

As Marcus, I want a durable workstreams directory independent of any single quarter's cycle, so a workstream's identity survives quarterly rollover instead of living inside whichever cycle I found the panel in.

- `/admin/org` lists every workstream regardless of cycle, showing name, description, and status (`active`/`dormant`).
- Marcus can create a workstream and edit its name, description, and status from this view without opening a specific cycle.
- Chartering a run for a given cycle (create/copy-roster) stays reachable from that cycle's Workstreams tab (M-5); this story only moves identity-level CRUD to the standing directory.

*Findings: M1 · Phase: 2*

**M-3 — org cycle cards on `/admin/org` with manage links + counts + org-pinned create form**

As Marcus, I want `/admin/org` to show the org's cycles as cards with manage links, counts, and a pinned create-cycle form, so the org's quarterly cadence has a home the way participant cycles have `/admin`.

- `/admin/org` renders a card per org-mode cycle (current and past), each linking to `/admin/cycles/[id]`.
- Each card shows a staff/active count and its lifecycle badge (via the completed `cycleStatusVariant` map from P-2).
- The create-cycle form pinned to `/admin/org` defaults `mode` to `'org'`.

*Findings: M1 · Phase: 2*

**M-4 — staff roster on `/admin/org`: co-lead/member chips + workstream names**

As Marcus, I want a staff roster on `/admin/org` showing co-lead vs. member chips and which workstream(s) each person touches, so I can answer "who's on what" without opening every run's pod page one at a time.

- `/admin/org` renders a roster of everyone with an active `moderator_assignments` or `pod_memberships` row on any current-cycle workstream run.
- Each row shows a co-lead or member chip per workstream, plus the workstream name(s).
- Defaults to the current org cycle; historical rosters stay reachable via that cycle's own Staff tab (M-5).

*Findings: M7 · Phase: 2*

**M-5 — org workspace tab reads "Workstreams" not "Formation"; People tab reads "Staff"**

As Marcus, I want the cycle workspace's tab labels to speak org language on an org cycle, so "Formation" and "Participants" stop describing a ballot and a cohort that don't exist on my cycle.

- `CycleWorkspaceTabs` renders the tab labeled "Workstreams" (not "Formation") when `cycle.mode === 'org'`.
- The People tab is labeled "Staff" on org cycles; participant cycles keep their current label.
- Deep-linked `?tab=` values resolve to the same panels regardless of label — no URL-scheme change.

*Findings: M2 · Phase: 3*

**M-6 — org Overview stats Staff/Active/Workstreams**

As Marcus, I want the Overview tab's stat cards to read "Staff / Active / Workstreams" instead of "Enrolled / Active / Pods" on an org cycle, so the headline numbers describe what's actually being counted.

- The three `StatCard`s on an org cycle's Overview tab relabel to Staff, Active, Workstreams; participant cycles keep Enrolled/Active/Pods.
- Underlying counts are unchanged — this is a copy fix, not a new query.

*Findings: M3 · Phase: 3*

**M-7 — revocations section absent on org cycles**

As Marcus, I want the Access revocations section to not appear on an org cycle's Staff tab, so a co-lead isn't shown pulse-check-derived revocation machinery that was never built for staff.

- `RevocationsSection` isn't rendered in the People/Staff panel when `cycle.mode === 'org'`.
- Historical revocation rows, if any exist, remain visible in the Data explorer (`/admin/explore`) for audit purposes — this removes only the live UI section on org cycles, not the underlying table.

*Findings: M4 · Phase: 3; historical rows remain in Data explorer*

**M-8 — org Configuration shows only workstream limits + milestone weeks + log gate; PATCH rejects forbidden fields by name**

As Marcus, I want the Configuration tab on an org cycle to show only fields that mean something for org cycles, and the PATCH endpoint to reject anything else by name, so I can't be shown — or accidentally submit — phase-window and voting-threshold fields with no effect on a cycle that never opens a ballot.

- On org cycles, the Configuration tab renders only workstream/run limits, milestone-week settings, and the Learning Log gate controls (M-9); the phase-window (`CycleScheduleForm`) and voting-threshold (`CycleParamsForm`) fields are hidden.
- `PATCH /api/cycles/[cycle_id]/config` validates the request body against a mode-scoped allowlist and returns 400 naming any field that isn't valid for that cycle's mode, instead of writing whatever the client sends.
- The guard lives in the route handler, not just the client form, so it holds for service-role or scripted calls too.

*Findings: M5 · Phase: 3*

**M-9 — log-gate pause toggle + armed-at readout, both modes**

As Marcus (and Priya — this applies to both modes), I want an admin control on the Configuration tab to pause the Learning Log gate and see when it was armed, so `log_gate_paused` isn't a column reachable only via direct SQL.

- The Configuration tab, on both participant and org cycles, shows the current `log_due_at` ("armed at") timestamp when stamped, and whether the gate is currently paused.
- An admin can toggle `log_gate_paused` via a form control that PATCHes `cycle_config`.
- The control ships on both modes, since the Friday gate applies to both (`ORG_CYCLES.md` §4).

*Findings: M5 · Phase: 3*

**M-10 — runs table speaks workstream language incl. "Assign co-lead" + org empty state**

As Marcus, I want the Formation-tab pods table to say "Assign co-lead," and use workstream-appropriate empty-state and confirm copy, so the table doesn't read like a pod-voting UI I never used.

- On org cycles, `PodsTable`'s empty state reads workstream-appropriate copy (e.g. "No runs yet. Charter a workstream to create one.") instead of "No pods yet. Finalize pod voting to create them."
- The Moderators column's assign control reads "Assign co-lead" via `moderatorNoun(cycle.mode)` instead of "Assign moderator."
- The force-active confirm copy drops the `pod_min`-check phrase on org cycles, since `pod_min` doesn't apply to a chartered (not voted) run.

*Findings: M6 · Phase: 3*

**M-11 — Dev · Testing tab hidden on org cycles**

As Marcus, I want the Dev · Testing tab hidden on an org cycle, so I don't see phase-fast-forward controls for a state machine with no scheduled phases to fast-forward through.

- `CycleWorkspaceTabs`'s `showDev` is further gated by `cycle.mode !== 'org'` — even a tester/admin with `testing:use` doesn't see the tab on an org cycle.
- Additive to the existing `canTesting` permission check, not a replacement for it.

*Findings: M5-adjacent · Phase: 3*

### Brendan

**B-1 — `/moderator` cards + per-pod header use Workstream/Co-lead nouns**

As Brendan, I want the `/moderator` card grid and the per-pod status header to say "Workstream" and "Co-lead" on an org run, so the one page where both my worlds collide doesn't flatten them into a single undifferentiated "Pod" list.

- `PodSummaryCard`'s hardcoded "Pod" label renders `podNoun(cycle.mode)` instead.
- `StatusHeader`'s label and name fallback (`moderator/pods/[pod_id]/page.tsx:190,194`) render `podNoun(cycle.mode)` instead of the hardcoded "Pod"/`Pod ${id}`.
- Pairs with the P-7 sectioning so a workstream run is both grouped and labeled correctly.

*Findings: M8, B1 · Phase: 4*

**B-2 — persona pill reads "Co-lead" when all moderated pods are org runs**

As Brendan, I want the nav persona pill to read "Co-lead" instead of "Poderator" when every pod I moderate is an org workstream run, so the global chrome doesn't misname the hat I'm wearing.

- `AppNav`'s persona label and the avatar menu's "View as" radio option compute the label from the signed-in user's `moderator_assignments` cycle modes: "Co-lead" when all are org-mode, "Poderator" when all are participant-mode, "Poderator" when mixed.
- Touches only display copy — the underlying persona/pathname resolution (`admin` vs. `moderator`) is unchanged.

*Findings: B6 · Phase: 4*

**B-3 — log picker tags org cycles "(org)"**

As Brendan, I want the Learning Log "Log for" cycle picker to visibly tag org cycles, so when I'm dual-enrolled I can tell at a glance which of the two due windows I'm filing against.

- The `<select>` options in `learning-log-card.tsx`'s "Log for" dropdown append "(org)" to the cycle name when that cycle's mode is `'org'`.
- No change to the underlying selection/submission logic — label-only.

*Findings: B5 · Phase: 4*

**B-4 — reminder email names the due cycle(s)**

As Brendan, I want the Learning Log reminder email to name the specific cycle(s) whose window is still open, so a dual-enrolled reminder doesn't read as a generic nag when it's actually telling me I owe one specific cycle a log.

- `logReminderEmailHtml`/`logReminderEmailText` accept the due cycle's name(s) and interpolate them into the copy.
- When a participant has two due cycles at send time, the email names both — per the per-cycle gate semantics in `ORG_CYCLES.md` §4 ("one log per cycle").
- The existing one-email-per-run dedupe behavior is unchanged; this only changes what the single email says.

*Findings: B5 · Phase: 4*

**B-5 — "Recent pulses" tab hidden on org runs**

As Brendan, I want pulse-review surfaces hidden (or clearly relabeled) on a workstream run's per-pod page, since org runs don't file pulse checks the way participant pods do, so co-leads aren't shown an empty or nonsensical pulse affordance.

- On a workstream run (a pod with `workstream_id` set / `cycle.mode === 'org'`), the pulse-related roster columns and the pulse-review side panel entry point are hidden.
- The per-pod page substitutes whatever signal is meaningful for a run (e.g. Learning Log gate status, consistent with M-9), or a plain "not applicable" state, rather than an empty pulse table.

*Findings: M8 · Phase: 4*

## 6. Phase map

| Phase | Stories | CI gate | Live-verification note |
|---|---|---|---|
| 1 | This PRD — persona walkthroughs, findings index, and story spec. Already complete. | — | — |
| 2 | Organization area: M-1, M-2, M-3, M-4 | `npm run lint && npm run test && npm run build` must pass before merge | Playwright screenshots of `/admin/org` as Marcus, captured against local dev and the OLOS-dev Vercel preview |
| 3 | Org cycle workspace: P-8, P-9, M-5, M-6, M-7, M-8, M-9, M-10, M-11 | `npm run lint && npm run test && npm run build` must pass before merge | Playwright screenshots of an org cycle's workspace tabs as Marcus, plus the archive-copy and finalize-voting confirms as Priya, against local dev and OLOS-dev |
| 4 | Shared surfaces: P-1, P-2, P-3, P-4, P-5, P-6, P-7, B-1, B-2, B-3, B-4, B-5 | `npm run lint && npm run test && npm run build` must pass before merge | Playwright screenshots of `/admin`, `/admin/people`, and `/moderator` as Priya, Marcus, and Brendan (dual-enrolled), against local dev and OLOS-dev |

## 7. Open product questions

- **Workstream rename does not rename the current quarter's run pod.** Option on the table: cascade the rename to the active run's pod when the names match verbatim. Deferred — not blocking any story above.
- **Moderator Switcher labels are unchanged.** Cheap-scope item; the Switcher control itself isn't touched by this PRD, only the cards and headers around it.
- **The nav "Cycles" item still routes to `/admin`.** Extracting a dedicated cycle-list page is deferred; `/admin` doing double duty as both landing page and participant-cycle list is acceptable for now given P-1's section split.
- **The org People tab's reconciler/stuck-participant affordances are kept for now.** They're generic enrollment tools, not participant-cohort-specific, so there's no forcing function to remove them from org cycles yet.
