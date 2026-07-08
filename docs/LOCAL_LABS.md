# Local Labs — the organizational tier

> Phase 1 (schema + invariants) shipped in migration `00062_local_labs.sql`.
> Later phases (HQ admin surfaces, the lab-lead workspace, member routing,
> cycle close-out) build on the model described here.

## The model in one paragraph

The org is **HQ plus local labs**. Cycles are centrally coordinated by HQ,
but each local lab has its own leadership, workstream teams, pods, and
projects (plus participants). Labs are **orthogonal to sectors** — this is a
hard constraint, not a style choice: a **sector** is the durable, global,
thematic home (`docs/SECTOR_MODEL.md`) that projects graduate to as open
source when their cycle ends; a **local lab** is the local delivery tier
that *facilitates the creation* of those projects through per-cohort pods.
Pods dissolve/are archived at the end of the cycle so local poderators can
focus on the next cohort. Theme vs. place; permanent vs. per-cohort.

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
- Pods and projects need **no lab column**: they inherit their lab via
  `cycle_id`. A project's lab is where it was born; its destiny is global
  (graduation flips `projects.governance` to `'sector'`).

## Cycle streams and invariants

Each lab runs its own cycle stream on HQ's shared quarterly calendar — one
`mode='open'` cohort for participants and (mirroring HQ's org track,
`docs/ORG_CYCLES.md`) optionally one `mode='org'` cycle for the lab's own
team/workstreams. 00062 rescopes 00060's per-mode invariant to
**≤1 active + ≤1 upcoming per (mode, lab)** — partial unique indexes on
`(mode, COALESCE(lab_id, 0))`, so HQ's NULL-lab bucket keeps its invariant
verbatim. `mode='closed'` (B2B) stays exempt. The app-level twin lives in
`app/api/cycles/[cycle_id]/status/route.ts`.

Every "the active cycle" read is stream-scoped through `lib/cycle/active.ts`:
`getOperatingCycle` / `getRecruitingCycle` / `getOrgCycle` take a
`labId` (`null` = HQ/global, the default). Member-facing code uses
`getMemberOperatingCycle` / `getMemberRecruitingCycle`, which prefer the
member's lab (`participants.metro_id`) and fall back to HQ — until a lab
activates its own cycle, every member resolves to the global cohort, which
is what makes the rollout incremental.

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
