# OLOS Pages Reorg — Requirements

Working requirements for the pages/information-architecture reorg. Draft for
teammate implementation. Baseline is [`current-state.md`](./current-state.md).

**Status:** draft — open questions flagged inline and collected in
[§ Open questions](#open-questions). Owner: @amg.

Legend: 🐛 bug · ✳️ net-new feature dependency · ⚠️ open decision.

### Decisions log

| Date | Decision |
|---|---|
| 2026-07-05 | **Cycle routing (R3):** `/cycles` auto-resolves to the current (active) cycle and becomes the cycle page; past cycles move to `/cycles/past`. |
| 2026-07-05 | **Net-new scope:** for this reorg, **stub the links** for Directory (R4/R5), Learning Library (R8), the join reminder, and next-cycle registration (R6). Each feature is a separate downstream workstream; the reorg wires the affordances to placeholders so it stays shippable. |
| 2026-07-05 | **Joining windows (R6):** a would-be participant has **three sequential joining slots** — cycle join/agreement → pod registration → project registration. Open/closed/past logic evaluates against these in order. |
| 2026-07-05 | **Main nav (R9):** becomes **Home · Cycle · Library · Events · Directory**. Library, Events, Directory are net-new (**stubbed** targets this reorg). |
| 2026-07-05 | **New-joiner home (R10):** composed of welcome + CTAs → checklist → one preview section per nav destination (Build/Events/Learn/Directory) → quick links. Past cycles never shown on Home. |

---

## Target information architecture (summary)

The reorg moves toward a clean three-surface split:

1. **Home (`/dashboard`)** — orientation hub: welcome + CTAs, fresh-joiner
   checklist, then a preview section per nav destination (Build / Events /
   Learn / Directory), then quick links. No full current-cycle detail, no past
   cycles. See R10.
2. **Cycle page (`/cycles`)** — `/cycles` auto-resolves to the current (active)
   cycle and holds everything about it: the Build Cycle graphic, phase/window
   state, a participant directory preview, and pod / project rosters (as
   directory links).
3. **Past cycles (`/cycles/past`)** — a separate click-through page, no longer
   inline on Home.

**Main nav (R9):** Home · Cycle · Library · Events · Directory. Three surfaces
are net-new and **stubbed** in this reorg (built as separate workstreams):
**Directory**, **Learning Library**, and **Events**.

---

## R1 🐛 — Test-account reset must land a fresh joiner on the checklist view

**Problem.** Resetting the test account sends the user back through
registration but does **not** drop them on the fresh-joiner checklist/dashboard
view. They end up somewhere else (observed: pushed to profile).

**Likely root cause.** Two interacting mechanisms:
- `scripts/ops/reset-energy-participants.sql` hard-**deletes** enrollment rows
  (flagged as out-of-band in the state-machine review) rather than restoring a
  clean fresh-joiner state, so leftover/placeholder state can persist.
- The dashboard layout's **placeholder-name gate** force-redirects any
  participant whose `first_name`/`last_name` is still `Unknown` to
  `/profile/edit` before they can reach the dashboard. A reset that leaves a
  placeholder name reproduces exactly this symptom.

**Requirement.** After a test-account reset + re-registration, the account
lands on the intended **fresh-joiner checklist view** of `/dashboard`
(state `no_enrollment`, see R2), with a real name, no stale enrollment, and no
forced bounce to profile.

**Acceptance criteria.**
- Running the documented reset then completing registration ends on
  `/dashboard` in the fresh-joiner state — not on `/profile/edit`.
- No orphaned `cycle_enrollments` / `pod_memberships` rows remain for the reset
  account.
- The reset produces a real (non-`Unknown`) name, or registration collects one
  before any dashboard redirect fires.

**Notes / affected.** `scripts/ops/reset-energy-participants.sql`;
`app/(dashboard)/layout.tsx` (placeholder gate);
`app/(dashboard)/dashboard/page.tsx`. See
[`architecture-review-onboarding-state-machine.md`](../architecture-review-onboarding-state-machine.md)
§1.6 and broken edge #3.

⚠️ **Open:** define exactly what "fresh joiner checklist view" contains — is it
today's minimal `no_enrollment` welcome + hero, or a new multi-step checklist?
(See R2.)

---

## R2 — Welcome CTA points to Join Build Cycle (when open), not Profile

**Current.** The `no_enrollment` dashboard is a welcome heading + a single hero
card linking to `/cycles/{id}/join`. In practice a fresh joiner is often
diverted to profile first (R1).

**Requirement.** The fresh-joiner welcome's primary CTA is **Join the Build
Cycle** whenever a cycle's joining window is open. It should not default to
"go to my profile."

**Acceptance criteria.**
- When a joining window is open, the welcome's primary action is "Join
  {cycle}" → the join flow.
- Profile completion is only interposed when genuinely required (placeholder
  name), and after completing it the user returns to the join CTA — not stranded
  on profile.
- When no joining window is open, the CTA follows the R6 precedence rules.

**Depends on:** R6 (CTA precedence), R1 (profile-gate interaction).
**Affected:** `app/(dashboard)/dashboard/page.tsx`.

---

## R3 ⚠️ — Current-cycle content moves to the Cycle page; past cycles get their own page

**Current.** `/dashboard` (active state) renders the Build Cycle graphic
(`CyclePhaseIndicator`), pulse CTA, My Pods, and an inline collapsible
"Past cycles" list. `/cycles` is a separate index that *also* shows the
timeline + past cycles. Content is duplicated across Home and the cycle
surfaces.

**Requirement (decided).**
- `/cycles` **auto-resolves to the current (active) cycle** and becomes the
  cycle page. All current-cycle content lives here: Build Cycle graphic,
  phase/window state, stats, directory preview (R4), pods/projects (R5), pod
  resources (R7).
- **Past cycles** move to a dedicated **`/cycles/past`** click-through page,
  not an inline section on Home or the cycle page.
- **Home** keeps only welcome + fresh-joiner checklist + CTAs (R2/R6).
- The existing `/cycles/:id` detail route can remain for deep-linking (past
  cycles link into it); `/cycles` (no id) is the current-cycle entry point.

**Acceptance criteria.**
- Visiting `/cycles` shows the current cycle (Build Cycle graphic + detail); no
  active cycle → an appropriate empty/next-cycle state.
- Past cycles are reachable only via `/cycles/past`, not inline on Home.
- No current-cycle detail duplicated between Home and the cycle page.

**Affected:** `app/(dashboard)/dashboard/page.tsx`,
`app/(dashboard)/cycles/page.tsx`, `app/(dashboard)/cycles/[cycle_id]/page.tsx`,
`app/(dashboard)/cycles/cycle-phase-indicator.tsx`.

---

## R4 ✳️ — Directory preview of current-cycle participants on the Cycle page

**Requirement.** The Cycle page shows a **preview of the current cycle's
participants** (a directory teaser). Clicking it opens the **Directory**
filtered to that cycle's participants.

**Acceptance criteria.**
- Cycle page renders a bounded preview (e.g. avatars + count) of current-cycle
  participants.
- The preview links to a Directory view pre-filtered to the current cycle.

**Depends on:** ✳️ the **Directory** feature, which does not exist yet
(the nav references it as a ghost destination). **Decision: stubbed for this
reorg** — build the cycle-page preview affordance and point it at a placeholder
Directory route; the full Directory is a separate workstream. That workstream
must define: list/grid of participants, profile visibility tiers (the four-tier
model exists in the Poderator PRD), filters (by cycle, pod, project, role), and
the filtered-view URL contract that R5 also consumes.

---

## R5 ✳️ — Pod & project "members" become Directory links within the Cycle page

**Current.** `/pods/:id` and `/projects/:id` render their own members tables.

**Requirement.** Within the cycle page's pods/projects, the **members view
becomes a link into the Directory** filtered to that pod's / project's members,
rather than a standalone table.

**Acceptance criteria.**
- Pod and project member lists on the cycle surface link to a Directory view
  filtered to that pod / project.
- The Directory filtered view honors the same participant-visibility rules.

**Depends on:** R4 (Directory + its filter/URL contract). Directory is
**stubbed** for this reorg, so these member links point at the same placeholder
until the Directory workstream lands.
**Affected:** `app/(dashboard)/pods/[pod_id]/page.tsx`,
`app/(dashboard)/projects/[project_id]/page.tsx`, cycle page.

---

## R6 — CTA logic for unregistered participants

For a participant **not registered for the current cycle**, the call(s) to
action follow this logic.

**Joining slots (decided).** A would-be participant has **three sequential
joining slots** in a cycle, evaluated in order:
1. **Cycle join / agreement** (the `/cycles/:id/join` ceremony)
2. **Pod registration** (`cycle_config.pod_registration_open/close`)
3. **Project registration** (`cycle_config.project_registration_open/close`)

"Open" = the current/next relevant slot is open now. "Closed (more to come)" =
between slots, with a later slot still ahead. "Past all joining windows" = the
last joining slot has closed.

| State | Primary CTA | Secondary CTA |
|---|---|---|
| A joining slot is **open now** | **Join current cycle** (routes to the open slot) | Register for next cycle |
| Between slots — **closed, but a later slot is ahead** | **Get a reminder for the next open window** | Register for next cycle |
| **Past all three joining slots** | **Register for next cycle** | — (sole action) |

**Rules (from owner).**
- "Join current cycle" and "Get a reminder" **never co-exist** (open vs.
  between-slots states of the same slot sequence).
- "Register for next cycle" is **always the secondary** action when a primary
  exists.
- "Register for next cycle" is the **only** action once the current cycle is
  past all joining slots.

**Acceptance criteria.**
- Exactly one primary CTA renders per state; the three states are mutually
  exclusive.
- The open/between/past evaluation walks the three slots in order.
- "Register for next cycle" never appears as primary while a slot is open or a
  reminder is offered.

**Depends on (both stubbed for this reorg — decision 2026-07-05):**
- ✳️ **"Get a reminder"** has no mechanism today. Wire the button to a
  placeholder; the reminder itself (email/notif opt-in tied to the next slot
  opening — model on the pulse-check reminder cron) is a separate workstream.
- ✳️ **"Register for next cycle"** requires a "next cycle" concept — a
  future/draft cycle with its own registration window. Stub the link; defining
  how the next cycle + its reg window are modeled and surfaced (today only one
  `active` cycle is surfaced) is a separate workstream.

**Affected:** `app/(dashboard)/dashboard/page.tsx` (and/or the cycle page CTA
block), `cycle_config` window fields.

---

## R7 — Pods surface their Google Drive, Slack, and Google Group links

**Requirement.** Pod pages show the pod's **Google Drive link**, **Slack
channel link**, and **Google Group alias**.

**Good news — data already exists.** The `pods` table (and `projects`) carry
`slack_channel_id`, `drive_folder_id`, `google_group_email`, and
`github_repo_url` (`supabase/migrations/00001_initial_schema.sql`). No migration
needed. But they are stored as **IDs/emails**, so the UI must construct URLs:
- `drive_folder_id` → `https://drive.google.com/drive/folders/{id}`
- `slack_channel_id` → Slack deep link (needs workspace/team ID — confirm the
  link format and where the team ID comes from)
- `google_group_email` → group alias (display + `mailto:` or Google Groups URL)

**Acceptance criteria.**
- When a pod has these values, the pod surface renders working links/alias.
- Missing values degrade gracefully (hidden or a clear "not set yet" affordance
  — the Poderator PRD already contemplates a missing-resource affordance).

⚠️ **Open:** Slack deep-link format + source of the team/workspace ID. Confirm
whether GitHub repo should also be shown (owner listed only Drive/Slack/Group).

**Affected:** `app/(dashboard)/pods/[pod_id]/page.tsx` (member-facing); the same
fields are surfaced Poderator-side per the Poderator PRD §7.6.

---

## R8 ✳️ — Build Cycle graphic links to a Learning Library explainer

**Requirement.** The Build Cycle graphic links out to a **Learning Library**
resource that explains the Build Cycle in depth.

**Acceptance criteria.**
- The graphic is an affordance to a Learning Library page/resource on the Build
  Cycle.

**Depends on:** ✳️ the **Learning Library** feature, which does not exist yet
(another ghost nav destination). **Decision: stubbed for this reorg** — make the
graphic a link to a placeholder target. The Learning Library workstream decides
whether it's in-app content, an external link (docs/Notion), or a `/learning`
route, and authors the Build Cycle explainer.

**Affected:** `app/(dashboard)/cycles/cycle-phase-indicator.tsx`.

---

## R9 ✳️ — Main navigation restructure

**Current.** Member nav is Home · My Cycle · Pulse Check (the latter two
enrollment-gated).

**Requirement.** Main nav becomes five destinations:

| Nav item | Target | Status |
|---|---|---|
| **Home** | `/dashboard` | exists |
| **Cycle** | `/cycles` (current cycle, R3) | exists (rework) |
| **Library** | `/library` (Learning Library) | ✳️ **stub** |
| **Events** | `/events` | ✳️ **stub** |
| **Directory** | `/directory` | ✳️ **stub** |

**Acceptance criteria.**
- Nav renders exactly these five items in this order.
- Library / Events / Directory link to placeholder routes until their
  workstreams land.

**Depends on:** ✳️ Directory (R4/R5), ✳️ Learning Library (R8), and ✳️ **Events**
— a third net-new surface introduced here (event list + detail). All stubbed.

⚠️ **Open — Pulse Check placement.** The new nav omits Pulse Check. Pulse Check
is a hard enforcement gate today (overdue → locked). Decide where it lives:
surfaced on the Cycle page, a persistent banner/badge, the avatar menu, or a
gated nav item that only appears when a check is due. It cannot simply disappear
while enforcement is active.

**Affected:** `app/components/chrome/app-nav.tsx`,
`app/components/chrome/tab-bar.tsx` (mobile), `app/(dashboard)/layout.tsx`.

---

## R10 — New-joiner Home composition

**Scope.** The Home layout for a user **not registered for anything and a new
joiner**. (Home composition for already-registered/active members is not yet
specified — see Open questions.)

**Requirement.** Top to bottom:

1. **"Welcome to the Labs"** hero with the CTAs from R6 (join current / remind /
   register next, per the precedence rules).
2. **Welcome checklist** — the fresh-joiner onboarding checklist (R1/R2). Exact
   steps TBD (see Open questions).
3. **One preview section per main-nav destination:**
   - **Build (Cycle)** — shows where the current cycle is at (a compact
     Build Cycle status) and **repeats the cycle-join CTAs** (R6).
   - **Events** — the **next 3 events** as a preview; links to the Events page.
   - **Learn (Library)** — **3 resources** from the Library; links to the
     Library.
   - **Directory** — a preview of **who is in the current cycle** (framing like
     "join these upskillers"); links to the Directory. Its **secondary CTA is
     join cycle** (R6).
4. **Quick links** — a quick-links block.

**Explicitly:** **Past cycles do not appear on Home** (they live at
`/cycles/past`, R3).

**Acceptance criteria.**
- New-joiner Home renders the four blocks in order: welcome+CTAs → checklist →
  preview sections → quick links.
- Each preview section links to its full destination; Build and Directory
  previews carry the R6 join CTAs (join as primary/secondary respectively).
- Events preview shows ≤3 upcoming events; Library preview shows 3 resources.
- No past-cycles content on Home.

**Depends on:** R6 (CTAs), and the preview data for the stubbed surfaces —
Events, Library, and Directory previews render placeholder/empty states until
those workstreams provide data.

**Affected:** `app/(dashboard)/dashboard/page.tsx` (+ new preview components).

---

## Dependency map

| Requirement | Depends on | In-reorg scope |
|---|---|---|
| R1 | reset script + placeholder gate | fix |
| R2 | R6, R1 | build |
| R3 | routing (decided: `/cycles` + `/cycles/past`) | build |
| R4 | ✳️ Directory feature | **stub link** |
| R5 | R4 | **stub link** |
| R6 | ✳️ reminder mechanism, ✳️ next-cycle concept | CTA logic build; reminder + next-cycle **stubbed** |
| R7 | Slack link format (data exists) | build |
| R8 | ✳️ Learning Library | **stub link** |
| R9 | ✳️ Library, Events, Directory routes | nav build; targets **stubbed** |
| R10 | R6, + Events/Library/Directory preview data | layout build; previews **stubbed** |

Net-new features referenced but **stubbed** in this reorg (each a separate
downstream workstream): **Directory** (R4/R5/R9/R10), **Learning Library**
(R8/R9/R10), **Events** (R9/R10), **join reminder** + **next-cycle
registration** (R6). The reorg wires the affordances to placeholders so it
ships without blocking on them.

---

## Open questions

**Resolved 2026-07-05** (see Decisions log): cycle-page routing (`/cycles`
current + `/cycles/past`); Directory & Learning Library → stub links;
joining-window definition → three sequential slots.

**Still open:**

1. **Fresh-joiner checklist (R1/R2/R10):** what are the checklist steps? Defines
   the "checklist view" and Home's second block.
2. **Slack link format (R7):** deep-link format + source of the team/workspace
   ID. And: show the GitHub repo link too, or Drive/Slack/Group only?
3. **Pulse Check placement (R9):** the new nav drops Pulse Check — where does it
   live given it's an active enforcement gate? (Cycle page / banner / avatar
   menu / conditional nav item.)
4. **Registered-member Home (R10):** R10 specifies only the new-joiner Home.
   What does Home look like for an already-registered/active member?

**Deferred to their own workstreams (stubbed here):**

5. **"Get a reminder" mechanism (R6):** email/notification opt-in vs. UI-only.
6. **"Next cycle" (R6):** how a future cycle + its registration window are
   modeled and surfaced.
7. **Directory (R4/R5/R9/R10):** full feature scope, visibility tiers,
   filter/URL contract, current-cycle preview data.
8. **Learning Library (R8/R9/R10):** in-app route vs. external link vs. existing
   doc; Build Cycle explainer source; resource-preview data.
9. **Events (R9/R10):** event list + detail feature; source of the "next 3
   events" preview data.
