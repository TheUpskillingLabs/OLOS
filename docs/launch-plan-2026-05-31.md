# Launch Plan — Energy Cycle 3

**Date authored**: 2026-05-31
**Cycle phase**: Solution proposal phase closing today; voting opens 2026-06-01
**Author**: Hot-fix session bundle (PR #108, ticket #107, related)
**Status**: Tier 0 in progress (PR #108 merged to dev, promotion to main pending)

---

## Goal

Over the next several hours, ensure:

1. All registered participants have access to OLOS.
2. They can submit proposals, vote, and complete pulse checks.
3. When account problems arise, moderators/admins can solve them without manually
   running SQL or introducing other invariant violations.
4. Code quality is preserved — soft-delete invariants, RLS, server-side
   validation, audit trails.

This plan is structured by impact, not by ticket order. The biggest obstacles
are addressed first so smaller tickets cascade into quick fixes.

---

## Current state snapshot

### Production database (Energy cycle 3, as of 2026-05-31)

| Metric | Value |
|---|---|
| Total cycle enrollments | 24 |
| Active | 16 |
| Inactive | 8 (all with zero active pod_memberships — correctly inactive) |
| Active pods | 5 (Clean Energy), 8 (Recycling) |
| Forming pods | 6 (Sustainable Travel), 7 (others) |
| Unknown-name participants | 3 |
| Beta tester status | Aaron McKeever (id=61) fully unblocked |

### Code state

| Branch | State |
|---|---|
| `main` | Production. Last merged: PR #92 (2026-05-26-ish) |
| `dev` | PR #104 + PR #108 merged. Awaiting promotion to main. |
| `fix/participants-rls-shared-pod-visibility` | PR #108 (now merged) |

### Cron state on production

- **PROD CURRENTLY HAS REVOCATION-CHECK CRON LIVE** — it will fire at 10 UTC
  unless the dev → main promotion deploys before then.
- `pulse-check-reminder` cron is unaffected; remains scheduled.

---

## Tier 0 — Stop the bleeding (critical path)

**Window**: must complete before 10 UTC on 2026-06-01.

**Why it's first**: until `vercel.json` from PR #108 reaches production, the
revocation-check cron will fire at 10 UTC and re-deactivate the 10 enrollments
we hand-activated last night. Losing the cohort mid-launch is the worst-case
outcome and it's recoverable but disruptive.

### Steps

| # | Action | Owner | Validation |
|---|---|---|---|
| 1 | Merge PR #108 to `dev` | done | `git log origin/dev --oneline` shows commit `823f200` |
| 2 | Smoke-test dev deployment (see Tier 0.5 below) | adm-2k | All checklist items pass |
| 3 | Open dev → main promotion PR | adm-2k + agent | PR opens against `main` |
| 4 | Merge promotion PR | adm-2k | PR shows merged state |
| 5 | Verify Vercel production deploy succeeded | adm-2k | `vercel deployments` shows new revision serving |
| 6 | Verify Vercel cron dashboard | adm-2k | `revocation-check` no longer listed |

### Smoke-test acceptance criteria for dev

After the dev deployment redeploys with PR #108:

- [ ] Dev preview URL loads without 500s
- [ ] As a regular participant: log in, view a pod-detail page, see other members' names (not blank)
- [ ] As a regular participant: leave a pod via the UI, then re-register — original `joined_at` preserved
- [ ] As a moderator: pod-detail page shows full member list
- [ ] Cron dashboard on dev: `revocation-check` not scheduled
- [ ] Type check passes: `npx tsc --noEmit`
- [ ] No new schema drift between dev DB and prod DB

---

## Tier 0.5 — Promotion PR construction

The promotion PR bundles **PR #104 (Ann Marie's form refactor + 00019)** and
**PR #108 (RLS + reactivation + cron disable)** into a single dev → main merge.

### Pre-promotion checks

- [ ] `git diff main..dev --stat` reviewed — no surprise files
- [ ] No unmerged migrations against prod (`mcp__supabase-prod__list_migrations` vs `supabase/migrations/`)
- [ ] No service-role keys or secrets in the diff
- [ ] PR #104 + #108 test plans both check out on dev

### Promotion PR body should reference

- PR #104 + PR #108 as the two bundled change sets
- Ticket #107 for the deferred cron redesign
- Manual prod cleanups already applied (Pod 8 activation, 10 enrollment activations, Aaron)
- Migration 00020 already applied to prod via MCP

---

## Tier 1 — The cascade-unlocking feature: profile editing

**Window**: ~2-3 hours, after Tier 0 deploys.

### The architectural insight

Multiple open tickets describe the same feature from different angles:

| Ticket | What it asks for | Closed by profile-edit? |
|---|---|---|
| #102 | Redirect placeholder-name participants to a completion form | Yes (Mode B) |
| #98 | Fabian asked "can I edit my profile?" | Yes (Mode A) |
| #94 | Root cause of Unknown names | Partially — the redirect heals existing Unknowns |
| #103 | fulfillInvitation guard against placeholder data | Reduces urgency — self-healing replaces the proactive guard |

**Building this once closes 4 tickets and removes the admin burden of fixing
names via SQL.** This is the single highest-leverage move on the board.

### Architecture

One page that serves two modes:

```
/profile
  ├── Mode A: voluntary edit
  │     - Linked from the nav
  │     - Editable: first_name, last_name, preferred_name, contact_consent,
  │       LinkedIn, neighborhood, work_situation
  │     - Submit → PATCH /api/participants/me → success state
  │
  └── Mode B: forced completion
        - Triggered by layout redirect when participant has placeholder data
          (first_name = 'Unknown' OR last_name = 'Unknown')
        - Same form, with "You need to complete your profile to continue"
        - After successful submit, returns to the originally-requested URL
        - Cannot be bypassed (layout enforces redirect)
```

### Implementation steps (dependency order)

1. **Validation schema**: `lib/validations/participants-update.ts`
   - Zod schema, subset of `registrationSchema`
   - Required: first_name, last_name (non-placeholder)
   - Optional: preferred_name, LinkedIn, neighborhood, work_situation

2. **API route**: `app/api/participants/me/route.ts`
   - PATCH endpoint
   - Body validated by the above schema
   - RLS via `participants_update_own` policy (already exists from 00002)
   - Returns updated participant row

3. **Server component page**: `app/(dashboard)/profile/page.tsx`
   - Fetches own participant row via Supabase server client
   - Renders profile-form client component

4. **Form component**: `app/(dashboard)/profile/profile-form.tsx`
   - React-hook-form + zodResolver
   - Uses the `FormField` pattern from PR #104
   - Pre-populated with current values
   - Submits PATCH, shows success state

5. **Layout redirect**: `app/(dashboard)/layout.tsx`
   - After `resolveUserRoles`, check participant name fields
   - If placeholder, redirect to `/profile?required=true&next=<originalPath>`
   - Unless already on `/profile` or `/logout`

6. **Server-side enforcement**: defense in depth in proposal-submit + vote-submit endpoints
   - Reject participants with placeholder names with 403 + redirect hint
   - Layout might be bypassable via direct API calls; the server has to enforce too

### What this does NOT cover (deferred)

- Admin "edit any participant's profile" UI (lower priority; admins have Supabase Studio)
- Email change (out of scope; email is identity)
- Profile photo upload (not a launch requirement)

---

## Tier 2 — Pulse-check polish

**Window**: ~1 hour, after Tier 1 lands.

### #86 — Already-submitted-this-week page state

After Tier 1, this is a quick win:

- Pattern is established by the profile-edit page (check current state, render conditionally)
- `/pulse-check`: check if a `pulse_checks` row exists for this week's `scheduled_date`
- If yes, render "Thanks, see you next week" instead of the form
- Use existing `FormField` and dashboard chrome

### #87 — Per-member pulse indicator (DEFERRED)

Moderator-facing polish; participants don't see it. Push to post-launch.

---

## Tier 3 — Ticket cleanup

**Window**: 15 min, after Tier 0 deploys.

The inventory has stale state after PR #104 and PR #108. Close-out sweep:

| Issue | Action | Reason |
|---|---|---|
| #93 (LinkedIn) | Close | Closed by PR #104 |
| #94 (Why Unknown) | Close with comment linking to #102 + #107 | Root cause known; remediation in #102 |
| #95 (react-hook-form) | Close | Closed by PR #104 |
| #96 (dropdowns) | Downgrade to p2 + keep open | Trigger styled; options panel still browser-default |
| #97 (multi-pulse) | Add roadmap note as a product question | Not a code bug — needs product decision |
| #98 (edit profile) | Close after Tier 1 ships | Subsumed by profile-edit |
| #99 (propose-form refactor) | Downgrade to p2 + keep open | Not addressed by #104; not blocking |
| #102 | Close after Tier 1 ships | Implementation complete |
| #103 | Downgrade to p2 | Self-heal replaces proactive guard |

Also update `docs/OLOS-roadmap.md §6 status` to reflect actual shipped state.

---

## Tier 4 — Intentional deferrals

These have value but don't move the launch goal. Document so they're not lost:

| Ticket | Why deferred |
|---|---|
| #107 (cron redesign) | Multi-day work; the disable is sufficient until post-launch |
| #105 (LinkedIn URL hardening) | Defense-in-depth; no exploit path observed |
| #106 (form a11y) | WCAG compliance; not launch-blocking |
| #76 (CI workflow) | High-value ops; doesn't unblock users |
| #77 (auto-apply migrations) | High-value ops; doesn't unblock users |
| #51 (members API) | Backlog; depends on architectural decisions in #107 |
| #62 (User Permissions) | Backlog; not launch-blocking |
| #65 (architecture brief refresh) | Documentation; do after launch lessons-learned |

---

## Architectural principles applied

| Principle | Application |
|---|---|
| Single Responsibility | Profile-edit page has one job; redirect logic in one place; validation in one schema |
| Don't Repeat Yourself | One form covers voluntary + forced modes; one API route for all profile updates |
| Least Privilege | RLS on participants enforces own-row-only updates; no service-client bypass needed |
| Defense in Depth | Layout redirect AND server-side API check; client validation + server zod |
| Soft-delete invariant | PR #108 restored for pod_memberships; profile-edit introduces no new deletes |
| Audit trail | Existing `participants.updated_at` (if present); follow-up in #107 |
| Idempotent migrations | All recent migrations use `IF NOT EXISTS` / `DROP POLICY IF EXISTS` |
| Server-authoritative state | Phase windows, role checks, RLS all server-enforced |

---

## Specific risks tracked

1. **8 remaining inactive participants** — no pod memberships. Need to verify
   pod registration window is still open per the late-joiner hot fix. If it's
   not, they're stuck.

2. **No revocation cron post-disable** — until #107 ships, genuinely-inactive
   participants accumulate. Acceptable for launch window; means more manual
   moderation post-launch.

3. **Promotion PR conflict surface** — PR #104 and PR #108 both touch the
   codebase. Verify no conflicts before merging dev → main.

4. **Aaron's missing pulse_check** — he claims to have submitted one but the DB
   shows zero. Unblocking him solved the access issue; the missing pulse-check
   data point is still unexplained and worth a separate look post-launch.

---

## Cross-reference

- Branch session work: `git log dev --since=2026-05-30`
- Hot-fix PR: #108
- Cron redesign ticket: #107
- Architecture brief: `docs/OLOS-architecture-brief.md`
- Auth subdoc: `lib/auth/CLAUDE.md`
- Environment matrix: `docs/environments.md`
