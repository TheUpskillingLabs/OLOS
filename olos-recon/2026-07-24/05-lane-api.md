# 05 — Lane E: API and Integration Surface

Run date: 2026-07-24 · Cutoff (LAST_ACTIVE_DATE): 2026-06-18 · Working tree = origin/main tip `d260022` (≡ origin/dev)
**BASELINE** = `git rev-list -1 --before=2026-06-18 origin/dev` → **`1d3615f224fa55cefdcfd5c4d49ae7d60caf5768`** ("docs(requirements): add redesign specs + sequenced implementation plan", 2026-06-17) [FACT: 1d3615f]

Headline: the API surface roughly tripled since the cutoff (74 routes added, 6 deleted, 31 modified on a base of ~50) [FACT: `git diff --name-status 1d3615f..HEAD -- app/api`]; the phase-window invariant is centrally enforced and held by every formation write; integrations are Luma (real, cron-synced), Resend (real), Anthropic (one narrow use: pod/project naming); Slack/Google-Drive/GitHub provisioning is explicitly ABSENT — read-only DB columns only.

---

## 1. Route inventory (HEAD): 118 route files

118 files: 117 `route.ts` + 1 `route.tsx` (OG image) [FACT: `find app/api -name "route.ts*" | wc -l`]. Auth is uniform: `withAuth` / `withAdminAuth` / `withOwnerAuth` wrappers (`lib/auth/middleware.ts:16-49`) resolve a `UserRoles` object per request; finer checks run inside handlers. `proxy.ts` deliberately exempts `/api/` from the login redirect — every route enforces its own auth [FACT: proxy.ts:45-53].

### PUBLIC routes (no session required) — 7, all deliberate

| Route | Methods | Guard in lieu of auth |
|---|---|---|
| `/api/auth/callback` | GET | OAuth code exchange itself [FACT: app/api/auth/callback/route.ts] |
| `/api/events/[event_id]/rsvp` | POST | **PUBLIC WRITE.** Anonymous path rate-limited 5/IP/hr (`hashIp`), member path binds session email; upsert dedupes [FACT: app/api/events/[event_id]/rsvp/route.ts:13-101] |
| `/api/stories` | POST | **PUBLIC WRITE.** 3/IP/hr; lands `spotlights.status='submitted'`, concierge review before publish [FACT: app/api/stories/route.ts:14-46] |
| `/api/surveys/[slug]/responses` | POST | **PUBLIC WRITE.** Only if survey `status='open'` + `allow_anonymous`; 10/IP/hr; member identity from session, never body [FACT: app/api/surveys/[slug]/responses/route.ts:24-50] |
| `/api/labs/suggest` | GET | Public metro data by design [FACT: app/api/labs/suggest/route.ts:1-8] |
| `/api/og/survey/[slug]` | GET | OG image render [FACT: route.tsx] |
| `/api/registrations/funnel` | POST | Not truly public: requires Supabase session (401 without), body `auth_user_id` must match session [FACT: app/api/registrations/funnel/route.ts:26-46] |

### CRON routes — 6, all `Bearer ${CRON_SECRET}` header check

`/api/cron/{learning-log-window, learning-log-reminder, leadership-log-window, leadership-log-reminder, sync-luma-events, revocation-check}` — all GET, all compare `authorization` against `Bearer ${process.env.CRON_SECRET}` [FACT: grep across app/api/cron/*/route.ts, e.g. sync-luma-events/route.ts:11].
⚠ Hardening note: if `CRON_SECRET` is unset in an environment, the expected header degrades to the guessable literal `Bearer undefined` — none of the six fail closed on a missing env var [INFER: high — string interpolation of undefined; verified pattern in all six files].

### Admin/Owner-tier routes

- `withOwnerAuth`: `/api/owner/[entity]/[id]` (POST, DELETE) — also flag-gated by `OWNER_CONSOLE_ENABLED` on the UI side [FACT: lib/owner/flag.ts:14].
- `withAdminAuth` (24 routes): `access/roles`, `admin/access/contacts/export`, `admin/events/sync`, `admin/feedback/[id]`, `admin/participants/[id]/reconcile`, `admin/people/contacts/export`, `admin/staff-flag`, `admin/stories/[id]`, `admin/testers`, `admin/weekly-messages`, `cycles/[id]/advance-phase`, `cycles/[id]/config`, `cycles/[id]/contacts/export`, `invitations` (GET), `labs/[id]/leads` (+`[participant_id]`), `labs/[id]/promote`, `options`, `permissions/preset`, `permissions` (POST), `pods/[id]/moderators/remove`, `revocations/[cycle_id]`, `revocations/check/[cycle_id]`, `revocations/reactivate/[id]`, `surveys` + `surveys/[slug]` (+questions CRUD), `voting/finalize/[cycle_id]`, `admin/pods/[pod_id]/memberships` (POST) [FACT: wrapper grep across all route files].
- **Lab-lead union** (withAuth + `requireLabAccess`/`requireLabAccessForPod`): `admin/announcements` (+`[id]`), `admin/pods/[pod_id]` PATCH, `admin/pods/[pod_id]/memberships/[participant_id]` DELETE, `admin/workstreams` (+`[id]`, `[id]/runs`). Admin short-circuits first; `lab_id=null` (HQ/global) stays admin-only [FACT: lib/auth/lab.ts:25-32; app/api/admin/announcements/route.ts:20-21].

### Member-tier routes (withAuth + internal checks) — verified highlights

| Route (methods) | Internal authorization |
|---|---|
| `participants/[id]` GET/PATCH, `…/avatar` POST/DELETE | self-or-admin [FACT: participants/[participant_id]/route.ts:18,85-86; avatar/route.ts:37,101] |
| `invitations/[id]` PATCH, `…/send` POST | admin OR the inviter (`invited_by === participantId`) [FACT: send/route.ts:39-40; [invitation_id]/route.ts:19-26] |
| `pods/[id]/name` PATCH, `pods/[id]/members/[pid]` PATCH | admin OR `isModeratorForPod` [FACT: name/route.ts:15; members/[participant_id]/route.ts:30] |
| `pods/[id]/moderators` POST | admin-only inside withAuth [FACT: moderators/route.ts:20] |
| `pods/[id]/projects` POST (org chartering) | org-mode check + co-lead-or-admin [FACT: projects/route.ts:40-52] |
| `moderator/pods` GET / `ui-state` / `nudges/dismiss` | `isModerator`-or-admin; dismiss re-checks `isModeratorForPod(pod_id)` [FACT: nudges/dismiss/route.ts:38] |
| `moderator/pods/[pod_id]/*` (4 GET routes) | `requireModeratorForPod` (admin OR assigned pod) [FACT: lib/auth/moderator.ts:34-41; used in all 4] |
| `surveys/[slug]/export` GET | admin OR `isModeratorForCycle` [FACT: export/route.ts:24-28] |
| `updates/*`, `posts`, `follows`, `saved`, `feedback`, `learning-logs`, `leadership-logs`, `pulse-checks`, `labs/waitlist`, `metros/[id]/waitlist`, `labs/[id]/join` | self-scoped: `participant_id` always from session, 403 on no participant record [FACT: spot-read updates/[id]/comments/[commentId]/route.ts:23-27, leadership-logs/route.ts:18-20, posts/route.ts:23-65; pattern-verified across the rest] |
| `pages/[type]/[id]/admins` POST/DELETE | page-admin check ("Not a page admin" 403) [FACT: admins/route.ts:30-36] |
| `testing/reset` POST | self-service, `participants.is_test` only — the one sanctioned bulk-delete path [FACT: testing/reset/route.ts:20-38] |
| `cycles` POST, `cycles/[id]/status` PATCH | `isAdmin` inside withAuth [FACT: cycles/route.ts:46; status/route.ts:48] |

Remaining GET routes (`cycles/*`, `dashboard/*`, `pods/[id]`, `projects/[id]`, `problem-statements/[cycle_id]`, `votes/[cycle_id]`, `pulse-checks/{me,enforcement,[cycle_id]}`, `nominations`, `directory/suggest`, `updates/feed`) are withAuth reads [FACT: wrapper grep]; internals not individually audited [INFER: med — consistent codebase pattern].

### Diff since BASELINE: 74 added / 6 deleted / 31 modified [FACT: git diff --name-status 1d3615f..HEAD -- app/api]

**Deleted:** `cron/pulse-check-reminder`, `registrations`, `registrations/short` (superseded by `registrations/funnel` — no stale frontend callers remain), `roles/{admin,developer,observer}` (superseded by `access/roles` + `lib/auth/grants.ts` single write path). [FACT: diff + fetch-scan §5]

**Added (74)** — entire feature families are post-cutoff: admin workspace (announcements, workstreams, testers, staff-flag, stories, feedback, weekly-messages, contacts exports), moderator/poderator dashboard (7 routes), labs/metros (8), surveys (7), updates/posts/follows/saved social layer (9), learning-logs + leadership-logs + 5 of 6 crons, events RSVP + Luma sync, org-cycle chartering, owner console, testing reset. [FACT: diff list]

**Behavioral changes in modified auth-relevant routes:**
- `auth/callback`: commit `a2c4fcd` "Auth unification C1" — `OWNER_EMAILS` auto-promotion at sign-in **removed**; ownership now a rooted tree in `participant_roles` (primary owner via migration 00066, DB trigger `guard_owner_grant` 00064 backstop) [FACT: a2c4fcd; callback/route.ts:62 comment; lib/auth/CLAUDE.md].
- `permissions/preset`: `3f471a2` "Auth unification C2" — grants flow through `lib/auth/grants.ts` with **attenuation** (can only grant within own authority/scope; owner grants owner-only) [FACT: 3f471a2; lib/auth/grants.ts:4-24].
- `votes`: `779da15` + `d3a7586` — corrected vote budgets, allowed stacking, added removal/reallocation (PUT) [FACT: commit log; votes/route.ts exports POST,PUT].
- `cycles/[id]/config`: `0a4f62d` Stage 1 calendar — PATCH now syncs `cycle_phases` rows alongside legacy window columns [FACT: 0a4f62d; advance-phase/route.ts:144-147 comment].
- `invitations`: `c9a4e30` lab-scoped guards [FACT: commit log].
- `cron/revocation-check`: rewritten as the two-stage warn→revoke cron (+364 lines) [FACT: diff stat] — but see §6: still unscheduled.

---

## 2. Server actions + non-API mutation paths

- **Zero server actions.** No `"use server"` directive anywhere in `app/` or `lib/` [FACT: repo-wide grep].
- `.insert(/.update(/.delete(` matches in `.tsx` files are all JS `Set`/`Map` operations — false positives [FACT: read roster-table.tsx:158, pod-join-section.tsx:70, permissions-editor.tsx:102, pulse-check-form.tsx:164].
- The browser Supabase client (`lib/supabase/client.ts`) is used for `signInWithOAuth`/`signOut` only, not table writes [FACT: grep `createBrowserClient` → single definition; auth-only usage].
- Server components read tables directly (service/cookie client in page files) — reads bypass `/api`, **writes do not**. Every mutation goes through `app/api/**` [INFER: high — exhaustive grep of write verbs across app/].

---

## 3. Phase-window invariant — HOLDS

**Enforcement chokepoint:** `checkWindow(supabase, cycleId, field)` in `lib/auth/windows.ts:35-102`. Semantics verified in code:
- Missing `cycle_config` row → `{open:false, "Cycle configuration not found"}` → caller 403s [FACT: windows.ts:54-56].
- **Org-mode cycles always closed** — mode fetched alongside config so a stray stamped window column can never open a formation action for a workstream [FACT: windows.ts:48-65].
- Phases-first: `cycle_phases` rows (migration 00085) win, `[starts_at, ends_at)`; legacy fallback `windowOpen(open, close)` where **either bound NULL → false** (`!!o && !!c`) → unscheduled = 403 ✓ [FACT: windows.ts:72-101; lib/cycles/lab-time.ts:42-50].
- Timestamps parsed as explicit-UTC instants to keep Vercel and dev laptops in agreement [FACT: lab-time.ts:33-40].

**Gate matrix — every formation write is covered** [FACT: grep `checkWindow(` across app+lib]:

| Write endpoint | Window field | Gated? |
|---|---|---|
| `problem-statements` POST | problem_statement | ✓ route.ts:39 |
| `votes` POST + PUT | voting | ✓ route.ts:32,185 |
| `pods/[id]/register` POST + DELETE | pod_registration | ✓ route.ts:72,218 |
| `pods/[id]/solution-proposals` POST | solution_proposal | ✓ route.ts:67 |
| `pods/[id]/project-votes` POST | solution_voting | ✓ route.ts:96 |
| `pods/[id]/projects/finalize` POST | solution_voting | ✓ via lib/projects/finalize.ts:83 |
| `projects/[id]/register` POST + DELETE | project_registration | ✓ route.ts:49,180 |
| `voting/finalize/[cycle_id]` POST (admin) | voting | ✓ inverse gate — 409 while voting still OPEN (protects partial tallies) [FACT: route.ts:43-52] |
| `cycles/[id]/agreement` POST | pod-window-tied | ✓ signatures outside windows refused (route.ts:132-146) |

**Sanctioned exemptions (by design, verified):**
- `pulse-checks` POST — no window check; identity + dedupe only [FACT: pulse-checks/route.ts:1-30, no checkWindow import].
- `admin/pods/[pod_id]/memberships` POST/DELETE — admin remediation explicitly outside windows [FACT: memberships/route.ts:32-35 comment + code].
- `learning-logs` POST — own eligibility gate (active cycle ∩ active enrollment, `lib/learning-logs/eligible.ts` + `gate.ts`), not phase windows [FACT: learning-logs/route.ts:43-72].
- `pods/[id]/projects` POST (org chartering) & org cycles generally — `rejectOrgCycle` 403s formation mechanics on org cycles; `orgForbiddenConfigKeys` rejects window keys in org config PATCHes [FACT: lib/cycle/guards.ts:14-68].
- `cycles/[id]/interest` POST — pre-formation interest, gated on cycle `status ∈ {active, upcoming}` + non-org, writes only `status='inactive'` enrollment [FACT: interest/route.ts:41-57,130].

**No endpoint added since 2026-06-18 skips a gate it should have.** The post-cutoff write families (updates/posts/follows/saved/logs/surveys/labs) are not formation actions and correctly sit outside the window system [INFER: high — full route sweep above].

**Moderator pod-scope re-check on writes: HOLDS.** All moderator-capable writes re-check the specific pod: `pods/[id]/name` PATCH, `pods/[id]/members/[pid]` PATCH (`isModeratorForPod`), `moderator/nudges/dismiss` POST (route.ts:38), and the 4 moderator dashboard reads (`requireModeratorForPod`). [FACT: citations in §1 table]

**Role stacking / visibility union: HOLDS.** `resolveUserRoles` unions roles from `participant_roles` + `moderator_assignments` (+pod ids) + lab-lead rows (+lab ids) + participant fallback; permissions = role-derived ∪ `participant_permissions` per-person grants [FACT: lib/auth/roles.ts:33-109, union comment at :90]. Grant writes attenuate through `lib/auth/grants.ts` (owner→owner-only; scoped roles need scope authority) [FACT: grants.ts:4-24].

---

## 4. Integrations — actual status (§3 "Python SDKs" claim confirmed false)

| Integration | Status | Evidence |
|---|---|---|
| **Luma** | **Fully implemented**, feature-flagged on `LUMA_API_KEY`. Raw `fetch` against `public-api.luma.com/v1` — no SDK. Two-way: 6-hourly cron caches Luma calendar into `events` (Luma = source of truth; local editorial fields preserved; orphaned future events archived), guest lists mirrored into `event_rsvps`, site RSVPs forwarded via `add-guests` (best-effort). Admin manual trigger `POST /api/admin/events/sync`. Disabled = quiet skip. | [FACT: lib/integrations/luma.ts (392 lines); vercel.json cron `0 */6 * * *`; cron/sync-luma-events/route.ts:17-24] |
| **Resend** | **Fully implemented** — direct HTTP-API (via `resend` npm pkg), NOT Supabase SMTP (ratified #64). Sends: invitations, registration confirmation + already-registered, learning/leadership-log reminders, revocation warnings. From `noreply@enroll.theupskillinglabs.org` default. | [FACT: lib/email/index.ts; lib/email/*-template.ts (7 templates); lib/auth/CLAUDE.md] |
| **Anthropic SDK** | **Implemented, one narrow use**: `generateName()` — claude-haiku-4-5 generates ≤40-char pod/project names at voting finalize + project finalize, with offline `nameFallback` on any failure (missing key never 500s). Nothing else — no chat, no RAG, no agents. | [FACT: lib/llm/names.ts:25-44; callers voting/finalize/[cycle_id]/route.ts:147, lib/projects/finalize.ts:138] |
| **Slack** | **ABSENT as integration.** No client, no webhooks, no API calls. Exists only as: `pods.slack_channel_id` / cohort column (migration 00001, read-only pass-through in pod payloads — nothing in the codebase writes it), and `NEXT_PUBLIC_SLACK_INVITE_URL` static invite link in UI. 4 unmerged remote branches (`claude/slack-integration-setup-7nsvpw`, `claude/slack-join-todo-k3508k`, `fix/slack-*`) suggest work-in-flight off-mainline [UNVERIFIED — branch contents not audited]. | [FACT: grep; migrations 00001:174,233] |
| **Google** | OAuth **via Supabase provider only** (`[auth.external.google]` in supabase/config.toml; `signInWithOAuth({provider:"google"})`). **No** googleapis client, no Drive, no Groups code. `pods.drive_folder_id` column exists, read-only, never written by code. | [FACT: lib/auth/CLAUDE.md; grep googleapis → 0 code hits] |
| **GitHub** | **No provisioning/API integration.** `pods.github_repo_url` + `projects.github_repo_url`: the ONLY write path is org-project chartering, where a co-lead pastes a URL by hand (zod-validated) [FACT: app/api/pods/[pod_id]/projects/route.ts:25,64; lib/validations/workstreams.ts:60]. No `github_activity` table in any migration [FACT: grep supabase/migrations]. |
| **Hugging Face** | **ABSENT.** Zero hits anywhere. | [FACT: repo-wide grep] |
| **Activation-time provisioning** | **Does not exist — and the code says so**: "The current codebase has NO resource-provisioning code anywhere — the participant register route's activation block also doesn't provision. That gap is intentional out-of-scope for #110" [FACT: app/api/admin/pods/[pod_id]/route.ts:56-62 comment]. So "warnings-not-blocking" is moot — there is nothing to warn about yet. Architecture-brief invariant #4 ("resources provision at activation") is aspirational only. |

---

## 5. Contract mismatches (frontend fetch ↔ routes)

- **Calls to nonexistent routes: none.** Every distinct `fetch("/api/…")` target (≈75 normalized paths) resolves to an existing route file; no references to the 6 deleted routes survive [FACT: repo-wide fetch extraction vs inventory].
- **Routes with zero in-repo callers** (no fetch, no href) — caveat: server components import lib functions directly, so unused GETs are likely legacy client-fetch endpoints rather than bugs:
  - GETs: `dashboard/[cycle_id]` (+`/pods/[pod_id]`), `nominations`, `pulse-checks/{me, enforcement, [cycle_id]}`, `cycles/[cycle_id]` (+`/participants`, `/my-solution-proposal`), `pods/[pod_id]` (+`/members`), `projects/[project_id]`, `moderator/pods` + `moderator/pods/[pod_id]` (detail page reads `lib/moderator/pod-detail.ts` directly; only the recent-logs/pulses/pulse-responses subroutes are fetched) [FACT: grep sweeps §5].
  - **Writes with zero callers** (more notable — dormant or future-UI): `pods/[pod_id]/name` PATCH, `projects/[project_id]/name` PATCH, `pods/[pod_id]/members/[participant_id]` PATCH, `cycles/[cycle_id]/interest` POST, `options` POST [FACT: same sweeps]. `cron/revocation-check` also has zero invokers (§6).
- Contacts-export routes are consumed as `<a href>` downloads, not fetch — counted as called [FACT: e.g. survey results page href, admin export links].
- Stale doc, not code: `lib/auth/CLAUDE.md` still points the register page at deleted `/api/registrations`; actual funnel posts to `/api/registrations/funnel` [FACT: register page grep; funnel route header comment].

---

## 6. Env vars, crons, and the #213 gap

**vercel.json crons (5):** learning-log-window (Fri 21:00), learning-log-reminder (daily 09:00), leadership-log-window (Wed 13:00), leadership-log-reminder (daily 09:00), sync-luma-events (6-hourly) [FACT: vercel.json].

**CONFIRMED — issue #213 still open and still true:** `app/api/cron/revocation-check/route.ts` exists (rewritten two-stage warn→revoke since baseline) but is **not in vercel.json and has no other invoker** — the enforcement teeth of the revocation system never fire on a schedule [FACT: vercel.json; #213 open, created 2026-07-11, labels ops/p1]. Note #213's text is itself stale: it says vercel.json registers only `pulse-check-reminder`, but that route was deleted since baseline and 5 other crons now exist [FACT: diff D cron/pulse-check-reminder; vercel.json].

**Env inventory** (`process.env.X` across app/ lib/ scripts/ proxy.ts next.config.ts):

| Var | Used | In `.env.local.example`? |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL / ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | core | ✓ |
| NEXT_PUBLIC_APP_URL, RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_SLACK_INVITE_URL | yes | ✓ |
| ANTHROPIC_API_KEY | implicitly (`new Anthropic()` reads env; graceful fallback) | ✓ |
| OWNER_EMAILS | only `scripts/ops/send-bulk-invites.ts` default-inviter hint (auth use removed) | ✓ (comment now stale) |
| **CRON_SECRET** | 6 cron routes | **✗ MISSING** — deploy-risk: unset ⇒ crons never authorized (and `Bearer undefined` guessable, §1) |
| **LUMA_API_KEY** (+LUMA_API_BASE) | Luma feature flag | **✗ MISSING** — unset silently disables the whole events pipeline |
| **OWNER_CONSOLE_ENABLED**, **ENTITY_EXPLORER_ENABLED** | feature flags, default off | ✗ missing (benign but undocumented) |
| SUPABASE_URL | scripts only (falls back to NEXT_PUBLIC_) | ✗ (scripts-only, benign) |
| VERCEL_ENV | env banner fallback | ✗ (platform-provided) |

[FACT: env grep + .env.local.example]. Example-but-unused cruft: none.

**Adjacent finding:** migration `00057` created `email_log` ("the welcome-summary email's audit trail") but **no code anywhere writes or reads `email_log`** — funnel/reminder/invitation sends are unlogged except `invitations.email_sent_at` [FACT: 00057_email_log_and_consent.sql:6; zero grep hits in app/lib/scripts].

---

## Gaps

- Internals of ~15 low-risk withAuth GET routes not line-by-line audited (pattern-inferred, §1). Same for a handful of self-scoped writes (`saved`, `feedback`, `metros/[id]/waitlist`, `labs/waitlist`) — verified only by wrapper + spot-checked siblings.
- Contents of the 4 unmerged Slack branches not examined (lane scope was HEAD + baseline diff); actual Slack plans [UNVERIFIED].
- Whether Vercel production actually has CRON_SECRET / LUMA_API_KEY set is unknowable from the repo [UNVERIFIED — no dashboard access].
- RLS policies as a second enforcement layer behind the API were not audited here (Lane D's DDL territory); this lane verified application-layer auth only.
- Caller analysis covers in-repo references; external consumers (scripts hitting prod API, ops tooling) could use the "zero-caller" routes [UNVERIFIED].
- `docs/EVOLUTION.md` / `docs/archive/*` referenced by #213 don't exist on HEAD (known docs ghost, per orientation) — could not cross-check the architecture-review remnant list.
