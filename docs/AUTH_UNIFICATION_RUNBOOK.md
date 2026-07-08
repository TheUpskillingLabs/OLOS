# Authorization unification — production promotion runbook

**Status:** the unification is built and proven on **OLOS-dev**
(`cethihabtddiujzayaxe`). This runbook promotes it to **OLOS-prod**. Do NOT
run any of this against prod until the prerequisites below are met and the
owner-set decision is made.

Prod project ref: **confirm before running** (the dev work referenced
`cdbgkgkjnomjnpicaxqe` for prod — verify in Supabase before applying).

---

## What shipped (dev)

The app and the database now resolve the admin/owner determination from **one
table, `participant_roles`** — closing a live split-brain where post-00054
grants that landed only in `user_roles`/`participant_permissions` were
invisible to DB RLS (`is_admin()`/`is_owner()`) and the owner-only
`delete_participant()`/`change_participant_email()` functions.

| Migration | What it does |
|---|---|
| `00064_participant_roles_unify` | `participant_roles` gains `lab_id`/`project_id` scopes + the roles that postdate it; rebuilt active-unique index; `guard_owner_grant` trigger (an authenticated non-owner can't mint an owner even via RLS); `is_admin()` includes `developer`. |
| `00065_participant_roles_backfill` | Backfills `participant_roles` from `user_roles`, `cycles:write`-holders→`admin`, `moderator_assignments`→`poderator`, `lab_leads`→`lab_lead`; installs forward-sync triggers so legacy writers keep mirroring during transition. |
| `00066_reroot_owners` | Single rooted owner: the primary owner (`granted_by IS NULL`); every other owner a co-owner granted by an existing owner; demotes the test fixture. Skips safely if the primary owner isn't present. |

Application changes (already on `dev` branch): `resolveUserRoles` reads
`participant_roles`; `isAdmin`/`isOwner` are role-based (match RLS);
`lib/auth/grants.ts` is the single attenuating write path; capabilities derive
from roles (unioned with legacy `participant_permissions` for zero
regression); `/admin/access` is the owner-rooted console (view + grant/revoke);
the `OWNER_EMAILS` auto-owner bootstrap is removed.

---

## Prerequisites

1. All the app changes are deployed to prod (they are backward-compatible: the
   forward-sync triggers keep legacy writers correct, and the capabilities
   union means no one loses access).
2. Dev invariants are green (see **Verification**).
3. **The prod owner-set decision is made** (next section).
4. A snapshot of the current prod authority graph is captured (Step 1 below) so
   a rollback can restore prior `granted_by`/`revoked_at`.

---

## Decision point — the prod primary owner

`00066` roots ownership at a single primary owner (`granted_by IS NULL`). On
dev that is `hello@brendanwhitaker.com`. **Prod owners are different data and
must be chosen deliberately.** Decide, before running `00066`:

- **Who is the prod primary (rooted) owner?** Candidates typically
  `hq@theupskillinglabs.org` or `hello@brendanwhitaker.com`. Note that on dev,
  `hello@brendanwhitaker.com` and `brendan@withlevy.com` are two accounts for
  the same person — confirm which email is the canonical prod identity.
- **Which existing prod owners stay owners (as co-owners) vs. demote to admin?**

Edit `00066`'s primary-owner email (and any demotion list) to match the prod
decision **before applying**. If prod's primary owner is not
`hello@brendanwhitaker.com`, change the `WHERE email = '…'` in `00066`
accordingly, and re-verify the file locally.

---

## Apply (ordered)

### Step 0 — confirm current prod authority state

```sql
-- The prod split: app-admins (cycles:write) not yet recognised by RLS (roles).
WITH app AS (SELECT DISTINCT participant_id FROM participant_permissions WHERE permission='cycles:write' AND revoked_at IS NULL),
     rls AS (SELECT DISTINCT participant_id FROM participant_roles WHERE role IN ('admin','owner') AND revoked_at IS NULL)
SELECT p.id, p.email FROM app JOIN participants p ON p.id=app.participant_id
WHERE app.participant_id NOT IN (SELECT participant_id FROM rls);

-- Current owners and their provenance.
SELECT p.id, p.email, pr.granted_by FROM participant_roles pr JOIN participants p ON p.id=pr.participant_id
WHERE pr.role='owner' AND pr.revoked_at IS NULL ORDER BY p.id;
```

### Step 1 — snapshot (rollback insurance)

```sql
CREATE TABLE IF NOT EXISTS _auth_unify_snapshot AS
SELECT id, participant_id, role, cycle_id, pod_id, granted_by, granted_at, revoked_at, revoked_by
FROM participant_roles;
-- also snapshot user_roles for the 00066 mirror:
CREATE TABLE IF NOT EXISTS _auth_unify_snapshot_user_roles AS
SELECT id, participant_id, role, granted_by, granted_at, revoked_at FROM user_roles;
```

### Step 2 — apply migrations in order

Apply, in this exact order, via the same mechanism used for the rest of the
chain (Supabase migration apply):

1. `00064_participant_roles_unify.sql`
2. `00065_participant_roles_backfill.sql`
3. `00066_reroot_owners.sql`  *(after editing its primary-owner email per the decision above)*

Then repair the migration ledger versions to `00064/00065/00066` if the apply
mechanism assigned timestamp versions (house precedent — see prior migrations).

---

## Verification (all must pass)

```sql
-- 1. exactly one rooted primary owner
SELECT count(*) AS should_be_1 FROM participant_roles
WHERE role='owner' AND granted_by IS NULL AND revoked_at IS NULL;

-- 2. no admin lost access (every cycles:write holder has an admin/owner/developer role)
SELECT count(*) AS should_be_0 FROM (
  SELECT DISTINCT participant_id FROM participant_permissions WHERE permission='cycles:write' AND revoked_at IS NULL
) pp WHERE NOT EXISTS (
  SELECT 1 FROM participant_roles pr WHERE pr.participant_id=pp.participant_id
    AND pr.role IN ('admin','owner','developer') AND pr.revoked_at IS NULL);

-- 3. no orphan owner-grants (every co-owner chains to an active owner)
SELECT count(*) AS should_be_0 FROM participant_roles pr
WHERE pr.role='owner' AND pr.revoked_at IS NULL AND pr.granted_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM participant_roles o WHERE o.participant_id=pr.granted_by AND o.role='owner' AND o.revoked_at IS NULL);

-- 4. mirror sanity: poderators and lab leads represented in roles
SELECT (SELECT count(*) FROM moderator_assignments WHERE removed_at IS NULL)
     - (SELECT count(*) FROM participant_roles WHERE role='poderator' AND revoked_at IS NULL) AS poderator_delta_should_be_0,
       (SELECT count(*) FROM lab_leads WHERE removed_at IS NULL)
     - (SELECT count(*) FROM participant_roles WHERE role='lab_lead' AND revoked_at IS NULL) AS lablead_delta_should_be_0;
```

Then spot-check the app: sign in as an admin and an owner; confirm `/admin`
loads and `/admin/access` shows the expected rooted tree.

---

## Rollback

Migrations are forward-only. If verification fails, restore the authority graph
from the snapshot (Step 1) rather than reversing the DDL:

```sql
-- Restore participant_roles provenance/revocation from the snapshot.
UPDATE participant_roles pr SET granted_by = s.granted_by, revoked_at = s.revoked_at, revoked_by = s.revoked_by
FROM _auth_unify_snapshot s WHERE s.id = pr.id;
-- Remove rows the backfill/re-root added (not present in the snapshot).
DELETE FROM participant_roles pr WHERE NOT EXISTS (SELECT 1 FROM _auth_unify_snapshot s WHERE s.id = pr.id);
-- Restore user_roles owner mirror if 00066 changed it.
UPDATE user_roles ur SET granted_by = s.granted_by, revoked_at = s.revoked_at
FROM _auth_unify_snapshot_user_roles s WHERE s.id = ur.id;
```

The schema additions (`00064`'s columns/trigger, `is_admin()` change) are
backward-compatible and can stay even under a data rollback. Drop the snapshot
tables once the promotion is confirmed stable.

---

## Known follow-ups (not required for promotion)

These are deferred by design — the union safety net makes them non-urgent:

- **Legacy-table retirement.** `user_roles`, `participant_permissions`, and the
  `00065` forward-sync triggers are transitional. Retiring them requires (a)
  draining any `participant_permissions` capability not covered by a role
  (e.g. orphan `testing:use` / `moderate:assigned_pods` — decide keep-as-role
  vs. drop), and (b) moving `moderator_assignments`' remaining readers onto
  `participant_roles` (or a compat view). Do this as a separate, separately
  verified pass.
- **`delete_participant()` erasure gap.** The `00058` function omits
  `lab_leads` and `project_roles` (no `ON DELETE CASCADE` on those FKs), so
  erasing a participant who is a lab lead or project contributor will fail on
  the FK. Fix with a small migration adding those deletes (or cascade FKs)
  before relying on erasure in prod.
- **Flags → roles.** `participants.is_staff` / `is_test` are still flags; the
  `staff` / `tester` roles exist in the vocabulary but aren't populated from
  the flags. Backfill + a sync trigger would let the console's Staff/Testers
  section populate and those capabilities derive from roles.
