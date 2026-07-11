# Local Labs — the organizational tier

> Phase 1 (schema + invariants) shipped in migration `00062_local_labs.sql`.
> Later phases (HQ admin surfaces, the lab-lead workspace, member routing,
> cycle close-out) build on the model described here.

## The model in one paragraph

The org is **HQ plus local labs**. HQ runs **one quarterly participant
cycle**, and every local lab is **automatically enrolled in it as a
sub-cohort** (migration `00067`) — there is nothing per-lab to activate.
Each lab still has its own leadership, workstream teams, pods, and projects
(plus participants), all living *inside* the shared HQ cycle, tagged to the
lab. Individual members still opt in via the join + agreement ceremony
(registration keeps its gravity). Labs are **orthogonal to sectors** — this
is a hard constraint, not a style choice: a **sector** is the durable,
global, thematic home (`docs/SECTOR_MODEL.md`) that projects graduate to as
open source when their cycle ends; a **local lab** is the local delivery
tier that *facilitates the creation* of those projects through per-cohort
pods. Pods dissolve/are archived at the end of the cycle so local
poderators can focus on the next cohort. Theme vs. place; permanent vs.
per-cohort.

## The lab entity is `metros`

The `metros` table has been the product's "Local Labs" since 00033 (the
public `/local-labs` surface; `participants.metro_id`/`metro_slug` assigned
silently by zip in `lib/metros.ts`). 00062 promotes it from content-only to
the organizational anchor. No new tenant table, no sync burden — a city's
marketing page and its organizational identity are the same row.

- `metros.status`: `active` = an operating lab; `waitlist` = a future one.
  HQ may pre-stage cycles for a waitlist metro before launch.
- `metros.is_default` (00062): the deterministic zip fallback — with several
  active labs, "the active one" no longer names a single row.

## `lab_id` — the tenancy column (NULL = HQ/global)

- `cycles.lab_id → metros(id)`: which lab's stream a cycle belongs to.
  NULL means HQ/global — every pre-00062 row, unchanged, zero backfill.
- `workstreams.lab_id → metros(id)`: a lab's internal workstream ("Baltimore
  ops"). Workstreams live in **exactly one home**
  (`workstreams_one_home_check`): HQ's keep `sector_id` (the seeded HQ
  sector, 00060); a lab's carry `lab_id`. Per-lab sector rows would smuggle
  places into the theme axis — deliberately forbidden.
- Pods carry their own **`pods.lab_id`** (00067) — under the single shared HQ
  participant cycle a pod's lab can no longer be derived via `cycle_id`. As of
  **00068 it is a membership fence**, not just a host tag: only that lab's
  members belong to the pod, enforced by app guards AND a `pod_memberships`
  trigger (`enforce_local_pod_membership`). Projects derive their lab from
  their pod; a project's destiny is still global (graduation flips
  `projects.governance` to `'sector'`).

## The HQ cycle and lab sub-cohorts (00067)

**The `mode='open'` participant track is ONE HQ stream.** ≤1 active + ≤1
upcoming globally (`one_active_open_cycle` / `one_upcoming_open_cycle`), and
the `cycles_open_is_hq_when_live` CHECK forbids a live open cycle carrying a
`lab_id`. Both `POST /api/cycles` and the status route reject per-lab open
cycles with clear copy. (00062's per-(mode, lab) open invariant was the
earlier per-lab-cycle model; 00067 supersedes it.)

**"Automatically enrolled" means there is nothing to activate.** The moment
HQ activates the quarterly cycle, every active lab's members can join it, and
the lab's slice is carried by two existing tags — `participants.metro_id` (who
belongs to the lab) and `pods.lab_id` (which pods are the lab's). **Pods are
local (00068):** each lab's members submit and vote on their *own* lab's
problem statements, form their own pods (the pod cap `max_pods` applies **per
lab**), and join only their own lab's pods. A pod inherits its lab from the
`problem_statements.metro_id` snapshot of the member who seeded it (stable if
they later change labs); an org run inherits its workstream's lab. Member
enrollment stays opt-in (join + agreement); nothing bulk-creates active
enrollments.

**Labs keep their own `mode='org'` internal cycles** (mirroring HQ's org
track, `docs/ORG_CYCLES.md`) for their leadership/workstream teams — the
per-lab invariant survives for org only (`one_active_org_cycle_per_lab` +
upcoming twin). `mode='closed'` (B2B) stays exempt.

Reads: `lib/cycle/active.ts` resolves the open track to HQ for everyone
(`getMemberOperatingCycle` / `getMemberRecruitingCycle` — the metro selects
the pod, never the cycle); `getOrgCycle(labId)` stays lab-scoped. The
lab-lead workspace (`/lab/[slug]`) shows the shared HQ open cycle plus the
lab's org cycles, with pods filtered by `pods.lab_id`.

## Registration is where lab membership is set (00068)

The Local Lab is the membership **spine**. At registration an Upskiller
**joins an active lab, joins an existing lab's waitlist, or starts a waitlist**
for a new city (the funnel's lab-choice step; zip *suggests* the nearest lab
via `metroFromZip` — it no longer assigns one silently). `participants.metro_id`
references **only `active` labs**: the waitlist branches leave it NULL and
write a `metro_waitlist_signups` row (the same store the public `/local-labs`
CTAs use). "Start a waitlist" find-or-creates a `status='waitlist'` metros row
(`findOrCreateWaitlistLab`, deduped on lowercased name + state).

**Active-lab membership is required to register for a cycle at all.**
`requireActiveLabMembership` (`lib/labs/membership.ts`) gates the
cycle-registration routes (`cycles/[id]/join` page, `agreement`, `interest`) —
a waitlisted or lab-less member is sent to `/local-labs`, and the dashboard
shows a non-blocking "Join a Local Lab" banner (admins exempt; no redirect).

HQ promotes a waitlist lab from `/admin/labs/[slug]` (`POST
/api/labs/[lab_id]/promote`): the lab flips to `active` and every waitlist
signup becomes an active-lab member who can now join a cycle.

**Grandfathering.** Pre-00068 members with no metro are not kicked: the pod
fence bites only non-NULL-lab pods, so the live HQ cycle (NULL-lab pods,
NULL-metro members) keeps working. The active-lab gate applies to *new* cycle
registrations; the per-lab ballot maps a NULL-metro viewer to the NULL bucket.
(`metro_id` demotion — an active lab going back to waitlist — is out of scope;
handle as a manual op: null out affected `metro_id`s + re-add signups.)

## Leadership

`lab_leads` (00062) is the `moderator_assignments` pattern one tier up:
HQ admins appoint leads (service-role writes; removal stamps `removed_at`).
`resolveUserRoles` surfaces the scope as `UserRoles.labLeadLabIds`
(predicates `isLabLead` / `isAnyLabLead` in `lib/auth/roles.ts`).

Powers split ("centrally coordinated by HQ"):
- **HQ admins**: cycle lifecycle (create/activate/close, advance-phase),
  lab-lead appointment, everything global.
- **Lab leads** (later phase): manage *inside* their lab — pods, rosters,
  poderator assignment, invitations (never permission-minting), workstreams,
  projects pre-graduation — via a dedicated `/lab/[slug]` workspace with a
  fail-closed admin-or-lead guard (`/labs` is unavailable: it's a
  cached-permanent redirect to the public `/local-labs` cities pages).
  `/admin` stays admin-only.

## Cycle close-out (later phase)

Archiving a cycle (HQ or lab) dissolves its pods, closes memberships and
moderator assignments, and flips its projects to sector governance — the
"pods are ephemeral, projects go global" mechanic. See the plan's Phase 5;
SECTOR_MODEL.md §6 is the underlying design.

## Related docs

- `docs/SECTOR_MODEL.md` — sectors, cycles, graduation (the theme axis)
- `docs/ORG_CYCLES.md` — the HQ-internal track labs mirror
- `SCHEMA.md` — table inventory
