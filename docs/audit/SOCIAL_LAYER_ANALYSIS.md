# Social Layer Analysis — directory, profiles, roles, and the road to a real feed

**What this is:** a full audit of OLOS's social layer — the new-member journey into it, what
profiles show, the role systems, every social/interaction primitive, and the stated social
purpose — followed by a phased improvement roadmap. Prompted by the LinkedIn-style directory
redesign (PR #205) and the decision to move toward a **Venmo-like feature-set**: a feed of
real actions between named members, peer-to-peer recognition, and reactions.

Method: five parallel read-only code/doc audits over the `dev` line (post-PR #205) plus an
aggregate-only snapshot of the dev Supabase project (`cethihabtddiujzayaxe`, 2026-07-07 —
Appendix A). Every claim cites `path:line`; line numbers are as of `dev@69c4a9a`.

Companion docs: `docs/audit/DESIGN_INTENT.md` (what the product is supposed to be),
`docs/audit/GAP_AUDIT.md` (general standing), `docs/audit/IMPROVEMENT_ROADMAP.md` (the
build sequence this plugs into — the workstreams below are candidates for its Phase 3–5
slots, not a renumbering).

---

## 1. The headline finding

**The design is ahead of the data.** The chrome of a social product is built — a LinkedIn-style
directory with tabs/filters/typeahead, member profiles at `/u/[handle]`, a community-updates
feed reader, global nav search. But:

- Profiles are empty: **3 of 64** real members have a headline, **2** have a bio, **19** have
  a photo, **9** have a metro (Appendix A).
- **58 of 64** members have zero `role_intents` — the directory's Builders/Mentors/Volunteers
  filters, and the role chips on every profile and directory row, have almost nothing to grab.
  (Most current members predate the funnel; only funnel signups are forced to pick ≥1 intent —
  `app/(auth)/register/funnel.tsx` role screen.)
- The community feed has **zero rows** (`profile_updates` = 0). Its only write path is the
  Learning-Log share toggle (`app/api/learning-logs/route.ts:115-127`), and no learning logs
  exist yet in dev.
- Every other member action is invisible to peers: saves are private (`00050:37`), RSVPs go
  member→org→Luma, nominations are staff-only (`00017:36`), pulse/log health data is
  firewalled by design (`00040:9-17`).
- The new-member journey never asks anyone to build their directory card (§3).

So the Venmo-like ambition is not blocked on more surface — it's blocked on **identity supply**
(profiles worth finding), **event supply** (actions worth seeing), and **role clarity**
(labels members recognize). That's what the roadmap in §8 sequences.

---

## 2. The social purpose, in the org's own words

- The tagline pair for the Connect layer: *"Find your people. Build your edge."*
  (`docs/audit/DESIGN_INTENT.md` §voice) — already rendered as the directory's subhead
  (`app/(dashboard)/directory/page.tsx`).
- The prototype's journey register names the stage this audit covers: **Connect** —
  *"Directory (members-only), profiles, follow, requested-only testimonials, nominations"*
  with the intent label *"Trustworthy, earned"* (`DESIGN_INTENT.md` journey table).
- The signed-in app is explicitly the LinkedIn model: destinations *Home · My Cycle ·
  Learning · Directory · Me* (`DESIGN_INTENT.md:92-93`).
- Success for the Upskiller persona is social by definition: *"finishing the cycle and
  showcasing what they've built, alongside the group of people they built it with"*
  (`docs/personas.md:41`).
- The long-term thesis makes member activity the asset: the Ortelius north star frames the
  event stream as *"the labeled corpus, for free"* — *"the product working is the labeling"*
  (`docs/ORTELIUS_NORTHSTAR.md:126-127`).

**The non-negotiables** (constitution + owner ledger, `DESIGN_INTENT.md`):

| Rule | Consequence for a feed |
|---|---|
| No public composer; Learning-Log shares are the only update source (`GAP_AUDIT.md:52`) | Feed grows by **doing**, not posting. Activity events fit; a status box does not. |
| *"Trust is earned, never default"* — locked badges, requested-only testimonials, admin-granted vouching | No self-serve clout; reactions/props must not become vanity leaderboards. |
| Poderator is *"a shepherd, not a manager — faltering is process data, never a member record"* | Only **ceremonial** events may be public. Step-backs, gate misses, and inactivity are never feed items. No activity telemetry. |
| Directory + profiles members-only at launch; `public_profile_visible` opt-in, default false | The feed is a members-only space this phase. |
| Public browse is free; no gated see-alls | Public Work pages (Phase 4) stay artifact-based, not activity-based. |

A Venmo-like feed is *compatible* with all of this — Venmo's mechanic is "real actions between
named people," and OLOS already produces exactly those actions (joins, signings, ships). What
it must not import from Venmo is the engagement machinery (counts-as-status, streaks,
notifications-as-hooks).

---

## 3. The new-member journey — where the social layer never shows up

The funnel (`app/(auth)/register/funnel.tsx`) collects: role intents (≥1 required), name, zip
(→ `metro_slug`, silently — `app/api/registrations/funnel/route.ts:84,103`), work situation,
hear-about, consent. The Google avatar is seeded as the photo (`funnel/route.ts:112-115`).
Then **everyone lands on `/dashboard`** (`funnel.tsx` submit) — a deliberate choice ("no
intent silently chains into another flow"), but it means:

1. **Never asked:** headline, bio, preferred name, expertise, handle, photo beyond Google,
   metro as a visible concept. All of it lives only in `/profile/edit` — reachable via the
   avatar menu and the profile page's Edit button, but nothing in the *onboarding* flow points
   there except one checklist row.
2. **The only nudge is generic and self-dismissing.** The dashboard Setup Checklist row
   "Complete your profile" is `done = !!(bio || headline)`
   (`app/(dashboard)/dashboard/page.tsx` checklist builder) — a one-word headline satisfies
   it, and it never mentions photo, metro, or intents.
3. **Auto-listed, never told.** The member appears in the directory immediately — the grid
   query has no completeness requirement (`lib/directory/data.ts` participants query) — with
   an empty card, and no surface says "you're live in the directory; here's how your card
   looks."
4. **`role_intents` is a one-shot question.** Asked at signup, editable only if the member
   independently finds `/profile/edit`; no surface ever revisits it. 58/64 members have none.
5. **Directory and Learning have zero onboarding on-ramp** — they're nav/tab-bar links only
   (`app/components/chrome/app-nav.tsx`, `tab-bar.tsx`); no dashboard card, checklist row, or
   hero CTA points at either.
6. **Dead handoff:** the cycle-join ceremony supports `from=signup` ("Your account is ready ✓"
   eyebrow, `cycles/[cycle_id]/join/ceremony.tsx`) but nothing routes to it — the funnel goes
   straight to `/dashboard`.
7. The placeholder-name gate (`app/(dashboard)/layout.tsx`) only ever fires for
   migration-imported stubs — funnel signups always have real names — so there is no forced
   identity moment at all beyond the funnel's name fields.

**Net:** the journey builds *membership* (agreement, enrollment, pod) but never builds
*presence*. The directory is downstream of a profile pipeline that was never installed.

---

## 4. Profiles — what's shown vs what's held

One component renders both lenses (`app/(dashboard)/profile/member-profile-view.tsx`,
"one markup source, two lenses"); security is column-level at the page, not the component.

**Visitor sees** (`/u/[handle]`, display-column allowlist at `u/[handle]/page.tsx:16-17`):
avatar, name, headline (else `current_title`), metro, "Upskiller since," role-intent chips,
bio, `primary_expertise`, cycle-enrollment badges, and their shared updates. **Owner
additionally sees:** email, location details (state/neighborhood/DCPL), professional context
(work situation, main focus, sector, LinkedIn), AI background, and the Labs-fit multiselects.

**Collected but surfaced nowhere** (the unsurfaced-data inventory):

| Column | Since | Why it matters for the social layer |
|---|---|---|
| `ai_experience_level` (new/consumer/builder/shipper) | 00025 | The best skill facet the org has; used on Poderator rosters, absent from profiles/directory. |
| `availability_snippet` | 00025 | Purpose-built member-card field, never shown to members. |
| `years_experience`, `education_level`, `sector_other` | 00056 | Professional context for "find your people," unsurfaced. |
| `slack_username`, `github_username`, `drive_email` | 00001 | The only member-to-member contact vectors that exist; rendered in **zero** UI files. |
| `public_profile_visible` | 00044 | No editor toggle, no display — the public-portfolio tier can't be opted into. |
| `volunteer_interest`, `interest_areas`, `moderator_experience` | 00001/00011 | Rich free-text identity, dormant. |

**Documented but unbuilt:** the profile cred band (render the signed Open Cycle Agreement from
the already-readable `cycle_agreements`) and locked-badge shells — both explicitly deferred
Phase-2 tails (`PROGRESS.md` Phase-2 tails; `IMPROVEMENT_ROADMAP.md` Phase 2 item 4). No
badge, cred, or testimonial code exists anywhere yet.

**Contact:** there is no in-product path for one member to reach another. Email and LinkedIn
are owner-only fields; visitor mode never receives them. Venmo-like reciprocity ends at a
dead-end profile.

---

## 5. Role systems — six concepts, one live bug

| System | What it is | Writers | Readers | Member-visible? |
|---|---|---|---|---|
| `participant_permissions` | **The real authorization spine** — 13 perms (`lib/auth/permissions.ts`) | owner bootstrap, invitations, admin preset route | `can()/isAdmin()/isOwner()` (`lib/auth/roles.ts:84-111`), RLS `has_permission`/`is_admin_or_owner` (00009) | No |
| `user_roles` | Staff audit trail (owner/admin/observer/developer only — CHECK excludes moderator/participant) | same three writers, audit-only | `resolveUserRoles`, admin People badges | No |
| `moderator_assignments` | Pod-scoped moderator truth | invitations, pod moderator routes | `resolveUserRoles` (derives `moderator`), `requireModeratorForPod` | Only as the "Poderator" persona |
| `role_intents` TEXT[] | Self-declared member identity (cycle/events/volunteer/mentor) | funnel, profile edit | profile chips, directory rows + filter | **The only member-visible one** |
| `participant_roles` (00054) | Designed unified temporal ledger — *"replaces role_intents-as-truth, user_roles, moderator_assignments"* (00054:4-8) | **Nobody since its one-time backfill** | **Only** 00058's RLS helpers | No |
| Personas (Upskiller/Poderator/Admin) | URL-derived UI dressing (`app-nav.tsx:50-54`) | — | nav pill, View-as radios | Yes (chrome only) |

**Defects, ordered by severity:**

1. **Live correctness bug — the 00058 orphan.** `is_admin()`/`is_owner()`
   (`00058_admin_roles_and_erasure.sql:8-24`) read `participant_roles`, but no application
   code writes that table (git grep outside migrations: zero). Any owner/admin provisioned
   after the 00054 backfill passes every TS check yet is **denied** the owner-only erasure RPC
   (`delete_participant`), the email-change RPC, and the 00058 admin RLS lenses. The dev DB's
   43 rows are a frozen snapshot.
2. **Two DB definitions of "admin" disagree.** Legacy RLS `is_admin_or_owner()` =
   `has_permission('cycles:write')` (00009); 00058 `is_admin()` = `participant_roles` row.
   Same word, different tables, different populations.
3. **TS `isOwner()` isn't owner.** It's `can("roles:write")` — and the **admin and developer
   presets both include `roles:write`** (`permissions.ts:36-47`), so `withOwnerAuth` admits
   admins and developers. DB `is_owner()` meanwhile requires a literal owner row. The two
   "owner" gates guard different sets.
4. **Half-wired moderator preset.** Applying the "moderator" preset grants
   `moderate:assigned_pods` + reads, but both `fulfillInvitation` and the preset route
   whitelist only owner/admin/developer/observer for the audit row, and no
   `moderator_assignments` row is created — moderator permissions with no pod and no derived
   role.
5. **Label chaos for the one member-visible system.** `role_intents='cycle'` renders as
   "Join a Cycle"/"Heart of the Labs" (funnel), "Builder" (profile chip), "Builders"
   (directory filter), and was backfilled as `'upskiller'` (participant_roles). The `events`
   intent renders as a "Community" chip but is missing from the directory's filter set
   (`directory-search.tsx` INTENT_FILTERS: cycle/mentor/volunteer only).
6. **Intents drive nothing.** Mentor/volunteer intents are collected and displayed but no
   mentor intake or volunteer flow exists (by design until Phase 5 — but two years of signups
   will accrete stale intents with no follow-through surface).
7. **Operational roles are invisible to members.** A pod's Poderator carries no marker on
   their member profile or directory row; members can't tell who shepherds what.

---

## 6. Social primitive inventory

| Primitive | State | Who acts | Who sees | Feed-ready? |
|---|---|---|---|---|
| Learning Log | live | member (self) | self + Poderator + admins; metrics firewalled | The **share** is (below); the log itself must never be |
| Share-to-community (`profile_updates`) | live, **0 rows** | member opt-in checkbox | all authed members (`/directory`, `/u/[handle]`, `/profile`) | **The entire feed today** — flat list, no reactions/comments/follow |
| Retract share | stub | — | — | DB policy exists (`00040:98`); no route, `renderRetract` prop uncalled |
| Nominations | partial | member, inside pulse form only | staff/Poderators; nominee never notified | Staff concierge by design; the promised directory "Nominate" button was never built (`IMPROVEMENT_ROADMAP.md` Phase 2 item 5) |
| Saved items / hearts | live | member | **self only** | Private by design; the toggle pattern is reusable for reactions |
| Spotlights / stories | live | anonymous public submit; staff publish | public | Editorial, not member activity (no `participant_id` linkage) |
| Events + RSVP + Luma | live, liveliest data (86 events / 137 RSVPs) | anon or member | org + Luma only | RSVPs are member→org; peers never see attendance |
| Pods / projects | live | members join | co-members see rosters | **Joins/formations emit nothing** — the highest-value latent events |
| Slack/GitHub/Drive columns | dormant | seed/import | nobody (zero UI renders) | The natural "where the work happens" links |
| Follow graph, notifications, messaging | absent | — | — | Follows + "Following" filter are Phase 5 (`updates-feed.tsx:11`) |

**Net:** one hub-and-spoke feed (member → shared log → everyone), zero reciprocity loops.
Passive presence exists (directory, profiles, rosters); nothing a member does creates a
visible moment another member can respond to.

---

## 7. Gap analysis — purpose vs design

| Stated purpose | Current design reality |
|---|---|
| "Find your people" | Directory search is built, but cards are name-only for 95% of members; filters starve on empty intents; no people-near-you or pod-mate surfacing |
| "Build your edge" (visible craft) | No public work pages yet (Phase 4); profiles can't show skills the org already holds (`ai_experience_level`, sector, years) |
| Connect = "directory, profiles, **follow**, testimonials, nominations" | Directory ✅, profiles ✅ (thin), follow ⬜ (Phase 5), testimonials ⬜, nominations half-built and staff-only |
| "Trustworthy, earned" | Nothing is earnable yet — no badges, no cred band, no testimonial machinery; trust surface = a cycle-enrollment status badge |
| Event stream as the compounding corpus (Ortelius) | Ceremonial events (signings, joins, formations, ships) happen in the DB but are recorded only as table rows — no event model, so neither members nor the future Atlas can consume them |
| Venmo-like: real actions between named people | The actions exist; the visibility layer doesn't. This is an emission problem, not a behavior problem |

---

## 8. Phased improvement roadmap

Effort tags: **S** ≤ 1 day · **M** ≈ 2–4 days · **L** ≈ 1–2 weeks. Sequencing rationale at
the end. These are candidates to slot into `IMPROVEMENT_ROADMAP.md`'s Phase 3–5 windows.

### Workstream C — Roles repair *(first: contains the live bug)*

- **C1 (S, migration).** Redefine 00058's `is_admin()`/`is_owner()` to read
  `participant_permissions` (via `has_permission('cycles:write')` / a true owner predicate —
  see C5), aligning the DB helpers with the app spine. This alone fixes the erasure/email-RPC
  denial for post-backfill admins.
- **C2 (M).** Make `participant_roles` the accurate **display/history ledger** (not the
  authorization source): wire the three existing writers — owner bootstrap
  (`lib/auth/owner-emails.ts`), `fulfillInvitation` (`lib/auth/invitations.ts`), the preset
  route (`app/api/permissions/preset/route.ts`) — plus the pod-moderator add/remove routes to
  also upsert/revoke `participant_roles` rows; one-time re-backfill migration to catch drift
  since 00054.
- **C3 (S).** Fix the half-wired moderator preset: either require a pod picker when applying
  it (creating the `moderator_assignments` row) or remove the preset chip.
- **C4 (S–M, member-facing).** One label set for intents everywhere (funnel cards, profile
  chips, directory filter — pick "Builder / Mentor / Volunteer / Community"); add the missing
  **Community** filter to the directory; render a **Poderator badge** on member profiles and
  directory rows from active `moderator_assignments` (shepherding is public, honorable
  information — distinct from health telemetry).
- **C5 (S).** A true owner gate: introduce an owner-only permission (e.g. `org:owner`) held by
  no other preset, and point TS `isOwner()` + DB `is_owner()` at it. Ratify that
  admin/developer keep `roles:write` (grant/revoke) while erasure/email-change stay owner-only.

### Workstream A — Identity supply *(before the feed: cards worth finding)*

- **A1 (M).** A "your directory card" step after the funnel: live preview of the member's
  actual directory card while they fill headline (+ optional expertise), confirm/replace the
  Google photo, and confirm the zip-derived metro. Route the funnel through the dormant
  `from=signup` handoff (ceremony eyebrow already supports it) so account → card → cycle join
  reads as one arc. Skippable — never a wall.
- **A2 (S).** Field-level Setup Checklist rows: "Add your headline," "Add a photo," "Set your
  role intents" — each deep-linking to its field, replacing the single generic row.
- **A3 (S).** Owner-view empty-state nudges on the profile itself ("Add a headline — it shows
  on your directory card →"), where today empty sections silently vanish.
- **A4 (M).** Surface what's already collected: `public_profile_visible` toggle in the editor;
  the cred band from `cycle_agreements`; locked-badge shells (the Phase-2 deferred tails);
  sector/years-experience on profiles; **opt-in contact** — a "how to reach me" block
  (LinkedIn, Slack handle) that the member explicitly turns on, ending the dead-end profile
  without building DMs.

### Workstream B — Activity layer *(the Venmo mechanics)*

- **B1 (M–L).** `activity_events` table — `actor_participant_id, verb, object_type/object_id,
  context (cycle/pod/project), created_at`, members-only RLS, service-client writes from the
  existing ceremonial write paths only: cycle agreement signed, pod joined, project
  joined/formed/shipped, learning-log shared, spotlight published, (later) props given,
  badge earned. **Constitution guardrails baked in:** ceremonial verbs only; step-backs,
  leaving, gate misses, and inactivity are never events; no read-tracking. Retroactive
  backfill is an owner decision (§9).
- **B2 (M).** Feed surfaces: the `/directory` community feed renders events + shares
  interleaved ("Maria joined Pod Solar · 2h" linking to `/u/maria` and `/pods/12`); member
  feeds on `/u/[handle]`/`/profile` show that member's events; the dashboard gets a compact
  "This week in The Labs" teaser (→ D1).
- **B3 (M).** Reactions: hearts on feed items — adapt the `saved_items` toggle pattern to an
  `update_reactions` table (unique member×item). Display per the vanity-metrics decision
  (§9): recommend showing *who* reacted (avatars) rather than a count race.
- **B4 (M).** Peer props — the literal Venmo mechanic: member → member visible recognition
  ("Maria → Sam: props for the demo pod walkthrough"), optionally pod/project-scoped, becomes
  an `activity_events` row. Distinct from nominations (which stay staff-concierge, private).
  Guardrails: modest rate limit, no leaderboards, no aggregate props counts on profiles until
  the badge system (Phase 5) can frame them as earned.
- **B5 (defer to Phase 5).** Notification dot for received props/hearts; follows + the
  "Following" feed filter per the existing Phase-5 plan.

### Workstream D — Journey on-ramps

- **D1 (S).** Dashboard community card: feed teaser + "people in your metro / your pod" row —
  the first non-nav pointer into the directory.
- **D2 (S).** The promised **Nominate** button on directory rows/profiles → standalone
  `POST /api/nominations` (write path already exists inside pulse; table + RLS live). Keeps
  "members surface talent, staff concierge."
- **D3 (S).** Welcome email always carries a next step (today the cycle link is dropped
  off-window, `app/api/registrations/funnel/route.ts:140-184`).

### Sequencing

1. **Now:** C1 (bug), then the S-tier quick wins — C3, C4, A2, A3, D2, D3.
2. **Next:** A1 + A4 (identity supply) and C2/C5 (ledger + owner gate).
3. **Then:** B1→B2 (events + feed), with B3/B4 following the §9 ratifications.
4. Phase 5 items (follows, badges-as-earned, testimonials, mentor intake) stay where
   `IMPROVEMENT_ROADMAP.md` has them; this plan makes their landing surfaces real.

---

## 9. New owner-decision queue items

1. **Reaction visibility** — reactor avatars vs counts vs both? (Rule 8's no-vanity-clout
   line; recommendation: avatars, no numeric race.)
2. **Props wording + guardrails** — the noun ("props"? "kudos"?), rate limits, whether props
   aggregate anywhere before badges exist.
3. **Contact opt-in default** — the A4 "how to reach me" block: strictly opt-in per field?
   Slack handle only vs LinkedIn too?
4. **Activity-event retroactivity** — backfill events from existing rows (pods, agreements,
   projects) or start the clock at launch?
5. **Poderator badge ratification** — confirming that pod-moderator status is public,
   honorable member-profile information (C4) and not a staff-only fact.

---

## Appendix A — dev DB snapshot (2026-07-07, aggregates only)

70 participants (6 test, 0 staff) · headline 3 · bio 2 · photo 19 · metro 9 · linkedin 23 ·
expertise 23 · `public_profile_visible` 2 · role_intents: cycle 5, mentor 3, events 1,
**empty 58** · user_roles active: owner 6, admin 6, observer 3 · participant_roles: 43 rows
across 20 participants (frozen 00054 backfill: upskiller 10, mentor 6, events 4, volunteer 3,
owner 6, admin 5, observer 3, poderator 6) · cycles 5 · active enrollments 27 · pods 7
(5 active) · active pod memberships 27 · projects 3 · active project memberships 11 · active
moderator assignments 5 · **profile_updates 0 · learning_logs 0 · saved_items 0 ·
nominations 1** · spotlights 2 · events 86 · event_rsvps 137 · resources 0 · metros 7 ·
pulse_checks 28 · invitations 13.
