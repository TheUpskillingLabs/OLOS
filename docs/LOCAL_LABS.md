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
- Pods carry their own **`pods.lab_id`** sub-cohort tag (00067) — under the
  single shared HQ participant cycle a pod's lab can no longer be derived
  via `cycle_id`. It is a host tag, not a membership fence. Projects derive
  their lab from their pod; a project's destiny is still global
  (graduation flips `projects.governance` to `'sector'`).

## The HQ cycle and lab sub-cohorts (00067)

**The `mode='open'` participant track is ONE HQ stream.** ≤1 active + ≤1
upcoming globally (`one_active_open_cycle` / `one_upcoming_open_cycle`), and
the `cycles_open_is_hq_when_live` CHECK forbids a live open cycle carrying a
`lab_id`. Both `POST /api/cycles` and the status route reject per-lab open
cycles with clear copy. (00062's per-(mode, lab) open invariant was the
earlier per-lab-cycle model; 00067 supersedes it.)

**"Automatically enrolled" means there is nothing to activate.** The moment
HQ activates the quarterly cycle, every lab's members can join it, and the
lab's slice is carried by two existing tags — `participants.metro_id` (who
belongs to the lab) and `pods.lab_id` (which pods are the lab's). A pod
formed at voting-finalize inherits the lab of the member who seeded its
problem statement; an org run inherits its workstream's lab. `pods.lab_id`
is a **host sub-cohort tag, not a membership fence** — voting is global and
cross-metro joins are allowed. Member enrollment stays opt-in (join +
agreement); nothing bulk-creates active enrollments.

**Labs keep their own `mode='org'` internal cycles** (mirroring HQ's org
track, `docs/ORG_CYCLES.md`) for their leadership/workstream teams — the
per-lab invariant survives for org only (`one_active_org_cycle_per_lab` +
upcoming twin). `mode='closed'` (B2B) stays exempt.

Reads: `lib/cycle/active.ts` resolves the open track to HQ for everyone
(`getMemberOperatingCycle` / `getMemberRecruitingCycle` — the metro selects
the pod, never the cycle); `getOrgCycle(labId)` stays lab-scoped. The
lab-lead workspace (`/lab/[slug]`) shows the shared HQ open cycle plus the
lab's org cycles, with pods filtered by `pods.lab_id`.

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
