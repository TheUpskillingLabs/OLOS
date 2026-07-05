# OLOS Pages Reorg — Requirements

Working requirements for the pages/information-architecture reorg. Draft for
teammate implementation. Baseline is [`current-state.md`](./current-state.md).

**Status:** draft — open questions flagged inline and collected in
[§ Open questions](#open-questions). Owner: @amg.

Legend: 🐛 bug · ✳️ net-new feature dependency · ⚠️ open decision.

---

## Target information architecture (summary)

The reorg moves toward a clean three-surface split:

1. **Home (`/dashboard`)** — identity + orientation only: welcome, the
   fresh-joiner checklist, and the join/register call(s) to action.
   No current-cycle detail.
2. **Cycle page** — everything about the *current* cycle: the Build Cycle
   graphic, phase/window state, a participant directory preview, and pod /
   project rosters (as directory links).
3. **Past cycles** — a separate click-through page, no longer inline on Home.

Plus two net-new surfaces this reorg introduces or depends on: a **Directory**
and a **Learning Library**.

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

**Requirement (preferred).**
- All **current-cycle** content lives on the **Cycle page**: Build Cycle
  graphic, phase/window state, stats, directory preview (R4), pods/projects
  (R5), pod resources (R7).
- **Past cycles** become a **separate click-through page** (e.g.
  `/cycles/past`), not an inline section on Home or the cycle page.
- **Home** keeps only welcome + fresh-joiner checklist + CTAs (R2/R6).

**Fallback (if the full move is descoped).** At minimum, the Build Cycle
graphic must also render on the current cycle page (it currently anchors Home).

**Acceptance criteria.**
- The Build Cycle graphic appears on the current cycle page.
- Past cycles are reachable via a dedicated page, not inline.
- No current-cycle detail duplicated between Home and the cycle page.

⚠️ **Open decisions:**
1. Which route is "the Cycle page"? Options: (a) `/cycles` auto-resolves to the
   active cycle and becomes the current-cycle page, past cycles at
   `/cycles/past`; or (b) keep `/cycles/:id` as the cycle page and repurpose
   `/cycles` as the past-cycles list. Recommend (a).
2. Confirm preferred vs. fallback scope for this release.

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
(the nav references it as a ghost destination). Directory scope must be defined:
list/grid of participants, profile visibility tiers (the four-tier model exists
in the Poderator PRD), filters (by cycle, pod, project, role), and the
filtered-view URL contract.

⚠️ **Open:** is the Directory built as part of this reorg, or are these links
stubbed pending a separate Directory workstream? (See Open questions.)

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

**Depends on:** R4 (Directory + its filter/URL contract).
**Affected:** `app/(dashboard)/pods/[pod_id]/page.tsx`,
`app/(dashboard)/projects/[project_id]/page.tsx`, cycle page.

---

## R6 — CTA logic for unregistered participants

For a participant **not registered for the current cycle**, the call(s) to
action follow this logic:

| Current-cycle joining state | Primary CTA | Secondary CTA |
|---|---|---|
| Joining window **open** | **Join current cycle** | Register for next cycle |
| Joining window **closed** (more windows to come) | **Get a reminder for the next open window** | Register for next cycle |
| **Past all joining windows** | **Register for next cycle** | — (sole action) |

**Rules (from owner).**
- "Join current cycle" and "Get a reminder" **never co-exist** (they are the
  open vs. closed states of the same slot).
- "Register for next cycle" is **always the secondary** action when a primary
  exists.
- "Register for next cycle" is the **only** action once the current cycle is
  past any joining window.

**Acceptance criteria.**
- Exactly one primary CTA renders per state; the three states are mutually
  exclusive.
- "Register for next cycle" never appears as primary while a joining window is
  open or a reminder is offered.

**Depends on / open:**
- ✳️ **"Get a reminder"** has no mechanism today. Define it: an email/notif
  opt-in tied to the next window opening, vs. UI-only copy. (There is a
  pulse-check reminder cron to model on.)
- ✳️ **"Register for next cycle"** requires a "next cycle" concept — a
  future/draft cycle with its own registration window. Define how the next
  cycle and its reg window are represented (today only one `active` cycle is
  surfaced).
- ⚠️ Define what counts as **"the joining window"** for a would-be participant:
  the cycle join/agreement (gated by cycle `active` status) and/or the
  `pod_registration` window (time-boxed in `cycle_config`). This determines the
  open/closed/past logic. See Open questions.

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
(another ghost nav destination). Define: is it in-app content, an external link
(e.g. docs/Notion), or a new `/learning` route? At minimum this reorg needs the
Build Cycle explainer resource + a link target.

**Affected:** `app/(dashboard)/cycles/cycle-phase-indicator.tsx`.

---

## Dependency map

| Requirement | Depends on |
|---|---|
| R1 | reset script + placeholder gate |
| R2 | R6, R1 |
| R3 | routing decision (⚠️) |
| R4 | ✳️ Directory feature |
| R5 | R4 |
| R6 | ✳️ reminder mechanism, ✳️ next-cycle concept |
| R7 | Slack link format (data exists) |
| R8 | ✳️ Learning Library |

Net-new features this reorg surfaces: **Directory** (R4/R5), **Learning
Library** (R8), **join reminder** + **next-cycle registration** (R6). Each is a
sizable workstream; the reorg can either build them or stub their links pending
separate tracks.

---

## Open questions

1. **Cycle-page routing (R3):** `/cycles` becomes the current-cycle page with
   `/cycles/past` (recommended), or keep `/cycles/:id` + repurpose `/cycles`?
2. **R3 scope:** full move (current-cycle content off Home) vs. fallback (just
   put the graphic on the cycle page) for this release?
3. **Directory (R4/R5):** build now as part of the reorg, or stub the links
   pending a dedicated Directory workstream?
4. **Learning Library (R8):** in-app route, external link, or existing doc?
   What's the Build Cycle explainer's source?
5. **"Joining window" definition (R6):** cycle join/agreement, pod-registration
   window, or both? This defines open/closed/past.
6. **"Get a reminder" mechanism (R6):** email/notification opt-in vs. UI-only?
7. **"Next cycle" (R6):** how is a future cycle + its registration window
   modeled and surfaced?
8. **Fresh-joiner checklist (R1/R2):** keep today's minimal welcome+hero, or
   design an actual multi-step checklist?
9. **Slack link format (R7):** deep-link format + team-ID source; include
   GitHub repo link or not?
