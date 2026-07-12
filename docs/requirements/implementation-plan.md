# OLOS Redesign — Sequenced Implementation Plan (post-stress-test)

## Context

Five requirements docs (`docs/requirements/`) designed four interlocking changes —
**local-labs**, **permissions-redesign**, **pod-registration**, **cycle-timeline**
(plus a deferred **per-lab-configuration**). Nothing is implemented. This plan turns
the set into a sequenced build **after stress-testing the docs against the actual code**
(three code audits run this session). The stress test found several places where the
docs are internally contradictory, undercount scope, or rely on mechanisms that don't
behave as assumed; those fixes are baked into the phases below.

### Locked decisions (this session)
- **DB strategy: hybrid.** Build/test against a reset **dev** DB; apply to **prod as
  forward-only migrations *with* backfill** (no prod reset). Backfill code is real.
  → The "ship against a reset DB" wording in all docs must be corrected to this.
- **Rollout: phased PRs**, in dependency order (below), not one big-bang PR.
- **RLS: coarse.** DB policies enforce "are you an admin at all / is this row yours";
  **scope (lab/cycle) is enforced in the app seam** (`isAdminOf`), per AC-1. No per-cycle/
  per-lab RLS predicate rewrite.
- **Observer → super admin** on backfill (author's call). Residual risk accepted; the D-4
  audit is the safeguard (see Phase 4). *Only fires if prod actually has observer rows.*
- **Test scaffolding: yes** — seed the three highest-risk seams (auth scope, window
  resolver, tz conversion). No test infra exists today.

### Corrected dependency order (the docs' stated order was wrong)
`labs` → `timeline` → `pod-registration` → `auth`.
Rationale: pod-registration's two windows **are** `cycle_phases` rows, and the rewritten
revocation cron needs the `pod_forming`/`pod_active_join` boundaries — both depend on
**timeline**, which the docs had sequenced *after* pod-registration.

---

## Phase 0 — Doc corrections + test scaffold (do first)

**Doc corrections** (the contradictions found; fix before building from them):
- Replace "ship against a reset DB" with the hybrid statement in all four active docs.
- cycle-timeline D-3: change "interpret **all** naive timestamps as Eastern" to a
  **per-column rule** — `CURRENT_TIMESTAMP`-origin audit columns are **UTC**; only
  admin-entered scheduling columns are candidates for Eastern, and that must be verified
  against real values. (A blanket Eastern reinterpretation shifts ~38 audit columns by
  +4-5h.)
- cycle-timeline FR-11: window-check list is **12 files, not 9**, and the UI pages don't
  call `checkWindow` at all — add `dashboard/page.tsx`,
  `moderator/cycles/[cycle_id]/vote-progress/page.tsx`,
  `admin/cycles/[cycle_id]/testing-controls.tsx` (latter uses `>` vs `>=` — fix the bound).
- pod-registration D-2/D-6: document the cron rewrite + activation-trigger + the
  orphan-window fix (see Phase 3) — "ties to the existing cron" understates it.
- Fix duplicate migration number `00015` going forward (new migrations start at `00020`).

**Test scaffold** (lightweight; e.g. Vitest + a seeded local Supabase):
- Auth seam: `isAdminOf({cycleId,labId})` / `isSuperAdmin` scope cases (own vs foreign).
- Window resolver: one tz-aware resolver — DST boundary, inclusive/exclusive bounds, null.
- tz conversion: assert a known Eastern scheduling instant and a known UTC audit instant
  both round-trip correctly after the column-type change.

---

## Phase 1 — Local Labs (foundation)

Per `local-labs.md`. New migration (`00020_labs`):
- `labs(id, name, slug UK, status, timezone DEFAULT 'America/New_York', created_at)`;
  insert **DC** (id 1).
- `cycles.lab_id` + `participants.lab_id`: add nullable → backfill all rows to DC →
  set `NOT NULL` (default DC). **(prod: backfill; dev: seed.)**
- App-level lab-scoping helper (single shared predicate) mirroring the authz seam —
  not RLS. Add `labId` to the resolved user shape (`participants.lab_id`).

Critical files: `supabase/migrations/`, `lib/auth/roles.ts` (surface `labId`), the new
shared lab-scope query helper.
Verify: insert throwaway "Lab 2" + cycle/participant; confirm lab-scoped queries separate it.

---

## Phase 2 — Cycle Timeline (cycle_phases + tz)

Per `cycle-timeline.md`. `cycle_phases` does **not** exist today (00006 only added two dead
columns `phase_2_start/phase_3_start` — leave or drop them). Clean create.

- New table `cycle_phases(cycle_id, phase_key, kind['spine'|'overlay'], position, anchor,
  duration, starts_at, ends_at, UNIQUE(cycle_id,phase_key))`; `cycle_events(...)` for pinned
  venue-bound dates. Add `cycles.start_at TIMESTAMPTZ`; `end_at` derived.
- **Schedule service**: computes `starts_at/ends_at` from anchor + durations (spine
  contiguous by construction; overlays anchor independently); recompute on change.
- **Single window resolver**: extend `lib/auth/windows.ts#checkWindow` to read
  `cycle_phases` (tz-aware), add keys `pod_forming`/`pod_active_join`/`project_proposal`,
  update `WINDOW_MESSAGES`. **Route all 12 UI pages + 6 API routes through it** — delete the
  inline `now >= open && now <= close` re-derivations and per-file `DAY_MS` offsets.
- **`advance-phase`** → duration-override + recompute; remove the 24h hardcode
  (`advance-phase/route.ts:98`).
- **tz conversion (per-column, verified)**: convert scheduling columns interpreting
  admin-entered values; convert audit columns as UTC. Do **not** blanket-reinterpret.
- **Display**: render in cycle tz **with label** (FR-14); crons fire **7am cycle-local**
  (FR-15) — gate the existing UTC `vercel.json` crons to cycle-local, mind DST.
- Migrate the 12 `cycle_config.*_open/close` values → phase rows (derive each duration),
  **splitting `pod_registration` → `pod_forming` + `pod_active_join`**; then drop the columns.
  Keep the thresholds in `cycle_config` (`pod_min`, `max_pods`, …).

Critical files: `lib/auth/windows.ts`, `advance-phase/route.ts`, the 12 window UI files,
`lib/validations/cycles.ts`, `vercel.json`, new schedule service.
Verify: changing `start_at` shifts all boundaries; 23:59 close in Eastern closes at local
23:59 across a DST date; spine can't be saved overlapping; overlays may overlap.

---

## Phase 3 — Pod Registration (the highest-risk behavioral change)

Per `pod-registration.md`, but with the cron/activation fixes the doc omits.

- `register/route.ts`: check the window **matching pod status** (`forming`→`pod_forming`,
  `active`→`pod_active_join`, `inactive`→refuse). **Remove the `cycle_enrollments`
  activation side effect** (`register/route.ts:99-124`). Keep the hardcoded 2-pod cap
  (already enforced at `:55-67`) — optionally move to `cycle_config`.
- **forming→active becomes a phase-boundary event** at `pod_forming` close: pods ≥ `pod_min`
  → active; the rest → `inactive` (dissolution — **net-new code**, none exists today).
- **NEW: replacement activation trigger** (the doc's gap). Since pod-join no longer flips
  enrollment, define cycle-active explicitly: **enroll into an open cycle ⇒
  `cycle_enrollments.status='active'`** (set it at `interest`/`registrations`/`short` time
  instead of `inactive`). Pre-pod active = enrolled; post-pod active = in a pod.
- **NEW: rewrite the revocation cron** (`cron/revocation-check/route.ts`) to be
  **phase-gated**. Today it runs unconditionally and only spares pre-pod users because they
  happen to be `inactive` — decoupling removes that accident. Apply the "in no pods → revoke"
  rule **only after `pod_active_join.ends_at`** (read from `cycle_phases`), *not* at
  `pod_forming` close. This single change also **closes the orphan dead-zone**: orphans freed
  at forming-close (D-6) have until active-join close to land somewhere before any revocation;
  no "freed but revoked next morning" contradiction. The pulse-check rule stays as-is.
- **Orphan handling**: on dissolution, free members (no silent limbo) + notify (D-6) —
  notification is net-new (no mechanism exists).
- Decide revoked-rejoin: a participant revoked earlier should be reactivatable if they join
  during active-join (don't leave them stranded).

Critical files: `app/api/pods/[pod_id]/register/route.ts`,
`app/api/cron/revocation-check/route.ts` (+ `revocations/check/[cycle_id]`),
`app/api/cycles/[cycle_id]/interest/route.ts`, `app/api/registrations/route.ts`,
`app/api/registrations/short/route.ts`, `app/api/voting/finalize/[cycle_id]/route.ts`
(seeds forming pods), `register-pods/page.tsx`.
Note the **project-layer asymmetry**: `projects/[id]/register` never touched enrollment and
requires active pod membership; with active-join overlapping project registration (both close
Aug 25), a last-day pod-joiner can immediately register a project — confirm that's acceptable.
Verify: join forming in forming window only; active in active window only; join/leave never
changes enrollment status directly; sub-`pod_min` pod dissolves and members are freed +
notified; pod-less enrollee not revoked until after active-join close.

---

## Phase 4 — Auth / Permissions (largest surface; lands last)

Per `permissions-redesign.md`. Reality from the audit: **dual-track today**
(`user_roles` *and* `participant_permissions`, plus synthetic moderator/participant), **61
RLS policies**, ~**66 call sites across ~27 files**, and `is_admin_or_owner()` was redefined
in 00009 to mean `has_permission('cycles:write')`.

- New `role_assignments(participant_id, role, scope_type['global'|'lab'|'cycle'], scope_id,
  granted_by, granted_at, revoked_at, UNIQUE … NULLS NOT DISTINCT)`. Admin tiers only;
  moderator/memberships stay in their own tables.
- New seam (`lib/auth/`): `isSuperAdmin` / `isAdminOf({labId}|{cycleId,labId})` /
  `isModeratorOf` / `isMemberOf` + read-only `primaryRole`. `resolveUserRoles` stops reading
  `participant_permissions`. Replace `withAdminAuth`/`withOwnerAuth` with
  `withSuperAdminAuth`/`withLabAdminAuth`/`withCycleAdminAuth`.
- **Coarse RLS**: replace `has_permission()`/`is_admin_or_owner()` with `is_super_admin()` +
  membership predicates; **do not** add per-cycle/per-lab predicates — scope lives in the app
  seam. Drop `participant_permissions` references.
- **Backfill (prod)**: D-4 audit first → `role_assignments` super-admin rows for current
  owners/developers/**observers** (observer→super accepted) + the 2 cycle-admin rows → drop
  `participant_permissions`. **Dev: seed fresh.**
- **Invitations**: carry `role` + scope, not `permissions[]`/`role_preset`; rewrite the
  acceptance path in `auth/callback`. **In-flight pending invitations** are a migration
  hazard — drain or translate them.
- **Note the standing exceptions to AC-1**: `registrations`, `registrations/short`,
  `auth/callback`, and both crons legitimately do service-role writes guarded by
  session/CRON_SECRET/invitation-state, not a route wrapper. The "wrap every service-role
  mutation" rule is really "guard it with *something*" — keep those guards.

Critical files: `lib/auth/{roles,permissions,middleware}.ts`, `lib/supabase/server.ts`,
`app/api/roles/*`, `app/api/permissions/*`, `app/api/invitations/*`, `app/api/auth/callback`,
`supabase/migrations/00002` + `00009` (RLS), all ~27 call-site files.
Verify: participant-only user unchanged; super admin unchanged across labs; lab admin 403s on
foreign lab + sees only own-lab participants; cycle admin 403s on foreign cycle; no code
references `participant_permissions`/`ROLE_PRESETS`/permission strings.

---

## End-to-end verification

1. Reset dev DB; seed DC + Cycle 3 (dates verified internally consistent — all weekdays/
   offsets check out) + super admins + 2 cycle admins.
2. Run the Phase-0 test seams (auth scope, window resolver/DST, tz round-trip).
3. Walk Cycle 3: problem statement → voting → pod forming (Jul 25→28) → dissolution at
   forming close → active-join (Aug 11→25) → project stage; assert enrollment status and
   cron behavior at each boundary (especially: nobody revoked before active-join close).
4. Lab isolation: insert Lab 2 + foreign rows; confirm app-seam scoping + 403s.
5. Dry-run the prod forward+backfill migrations against a **clone** of prod before applying.

## Residual risks (accepted / to watch)
- observer→super-admin is a privilege escalation if prod has observer rows — D-4 audit gates it.
- Coarse RLS means a forgotten app-seam scope check leaks cross-scope data; the single seam +
  the lab-scope helper are the mitigations (keep scope derivation out of components/routes).
- Per-column tz conversion is the one irreversible data step — verify against real values and
  dry-run on a prod clone.
