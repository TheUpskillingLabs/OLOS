---
title: Slack channels are provisioned from admin, one workspace per lab, private by default
date: 2026-09-12
status: proposed
kind: decision
tags: [integrations, admin, labs, pods, projects, schema]
related: ["[[slack-provisioning-trigger]]"]
---

# Slack channels are provisioned from admin, one workspace per lab, private by default

**Implementation status: not started.** This records the design agreed on 2026-09-12,
before any code. It moves to `accepted` when the first channel is provisioned against a
production workspace and the open questions below are closed.

## Context

Slack already appears in OLOS in five places with no API integration behind it:
`NEXT_PUBLIC_SLACK_INVITE_URL` in the welcome email and the dashboard checklist, a
commented-out `SLACK_BOT_TOKEN` in `.env.local.example`, unused `slack_username` on
`participants`, unused `slack_channel_id` on `pods` and `projects`, and deep links in the
Poderator dashboard. Roadmap items §4.4, §4.5 and §4.7 all assume a bot exists.

The pain that opened this was not notifications. It was that creating a channel for every
new pod and adding the right people to it is manual work repeating every cycle.

Two constraints reshaped the design once they surfaced:

- **`conversations.invite` takes Slack user IDs and only works for people already in the
  workspace.** No API on a standard plan pulls a stranger into a channel. So "create a
  channel and add people" cannot be built without first knowing who has joined, which OLOS
  currently does not know at all: the `setup:slack` checklist row is dismissal-based
  (issue #189).
- **Each local lab gets its own Slack workspace**, matching the intent in
  `docs/requirements/per-lab-configuration.md`. Slack identity, channel namespaces, app
  installs and plan tiers are all per workspace, so nearly every piece of this is per lab
  rather than global.

## Options considered

| Decision point | Options | Chosen |
|---|---|---|
| Workspace topology | One workspace for the Labs; one per lab | **One per lab** |
| Bot credentials | Env var per lab; token pasted into admin; Slack OAuth install flow | **Pasted into admin**, OAuth deferred |
| Trigger | Auto on pod status reaching `active`; admin button; cron | **Admin button**, idempotent |
| Channel names | Slug from the entity name; hand-set abbreviation; template with tokens | **Template with tokens**, abbreviation hand-set |
| Cycle identifier in the name | `cycles.id`; an integer with a padding format; a short text code | **Short text code** |
| Slack identity storage | Columns on `participants`; a child table per workspace | **Child table** |
| Visibility | Public; private; per-cycle setting | **Private default**, per-cycle setting |
| Membership source | `cycle_enrollments` plus exceptions; union of several sources | **Union** |
| Keeping Slack in sync | Call Slack from each membership endpoint; a converging reconciler | **Reconciler** |
| Channel ID storage | Columns on the entity tables; a `slack_channels` registry | **Existing columns**, registry deferred |

## Decision

1. **One Slack workspace per lab.** A cycle's channels live in the workspace of
   `cycles.lab_id`. The existing `theupskillinglabs` workspace is the default lab's
   (`metros.is_default`).
2. **Credentials live in data, not in the environment.** A `lab_slack_settings` row per lab
   holds the bot token, `team_id`, bot user ID, the three name templates, the default
   visibility and the invite link. The token is encrypted at rest, reachable only through
   the service-role client in route handlers, with RLS denying `anon` and `authenticated`
   outright. A lab is connected by an admin pasting a bot token, not by a deploy.
   **No `SLACK_BOT_TOKEN` env var**, since one env var cannot serve many workspaces and
   adding a lab must not require a redeploy.
3. **Three tiers of channel:** cycle, pod, project.
4. **Names come from per-tier templates**, editable per lab. Defaults are the existing hand
   convention: cycle `{cycle_code}` (`#c03`), pod and project `{cycle_code}-{abbrev}`
   (`#c03-effortvsimpact`, `#c03-blah`).
5. **Cycles are numbered per lab.** `cycles.lab_cycle_number SMALLINT`, unique with
   `lab_id`: "cycle 3" means the third cycle of that lab. `cycles.slack_code VARCHAR(12)`
   holds the channel-name token, hand-editable, suggested as `c` plus the zero-padded
   ordinal, and unique **per lab** rather than globally, because each workspace has its own
   flat namespace. Never derived from `cycles.id`, a surrogate key that skips values and
   does not mean what a person means by "cycle 3". Text also expresses sub-cohorts
   (`c03a`), which a padded integer cannot, and those already exist in the schema
   (`00067_hq_open_cycle_sub_cohorts.sql`).
6. **The lab appears nowhere in a channel name.** With a workspace per lab there is nothing
   to disambiguate: every lab's third cycle is `#c03` in its own workspace. No `{lab}`
   token, no per-lab prefix.
7. **`slack_abbrev` on `pods` and `projects`**, auto-suggested by a squashing normalizer
   (lowercase, drop everything outside `[a-z0-9]`, insert no separators, strip no
   stopwords, truncate at 20 with a warning rather than a hard cut), then hand-editable.
   `Effort vs Impact` suggests `effortvsimpact`, not `effort-vs-impact`. Frozen once a
   channel exists; renaming is an explicit per-row action calling `conversations.rename`.
8. **Private by default**, with a per-cycle visibility setting. Visibility is read back from
   `conversations.info` on every reconcile and stored, because flipping an existing channel
   is a manual admin action in Slack: `admin.conversations.convertToPublic` is Enterprise
   Grid only. **The setting governs new channels, never existing ones.**
9. **Channel membership is a union**, not a query on enrollment: active `cycle_enrollments`,
   active `pod_memberships`, `project_memberships`, `moderator_assignments` for the pod,
   `user_roles` owner and admin, and the existing staff flag. Poderators, admins and staff
   therefore need **no cycle enrollment** to be added. Admins and staff joining every pod
   and project channel is opt-in per person, because at ten pods it is noise.
10. **Slack identity is per workspace, so it is a child table**, not columns on
    `participants`: `participant_slack_identities (participant_id, lab_id, slack_user_id,
    state, linked_at)`, unique on `(participant_id, lab_id)`. A person active in two labs
    has two Slack user IDs and neither is "the" one. Resolved by `users.lookupByEmail`
    against each lab's workspace in the reconcile cron. `participants.slack_username` stays
    and is display only, since the API will not accept it. Unresolvable people reach an
    `unmatched` state and are listed in admin for a hand-entered ID.
11. **The invite link is per lab**, stored on the settings row, replacing
    `NEXT_PUBLIC_SLACK_INVITE_URL`. The welcome email and the `setup:slack` checklist row
    resolve the link for the participant's own lab, with the default lab's link as the
    fallback for anyone unaffiliated.
12. **Convergence, not eventing.** The reconcile cron diffs the desired member set against
    `conversations.members` and invites the difference, per workspace. Membership endpoints
    never call Slack. Pending membership is derived at reconcile time and never stored, so
    there is no mirror table to drift.
13. **Everything is in admin.** A workspace-level `admin/slack` page listing labs
    (connection state, plan, templates, visibility, invite link, reconcile controls,
    unmatched list) and a Slack panel on `admin/cycles/[cycle_id]` (cycle code, per-row
    abbreviation, resolved name, state, pending count, provision and archive actions).
14. **Channel IDs stay on `cycles`, `pods` and `projects`.** A `slack_channels` registry is
    the tidier shape but two of the three columns already exist and the Poderator PRD reads
    them. The registry earns its place when a channel belongs to no cycle, pod or project,
    such as a standing per-lab channel.

## Why

Five constraints did the deciding, and each is worth knowing because each is the thing that
would reopen the question:

- **You cannot add someone to a channel who is not in the workspace, and invites take IDs,
  not emails.** Identity mapping is a prerequisite, not a later phase, and the feature is
  capped by workspace join rate, which OLOS cannot force. Staff are affected too: an admin
  who never joined cannot be added either.
- **Everything about Slack is per workspace.** Identity, namespaces, app installs, plan
  tier. Once labs get their own workspaces, a single token in the environment and a single
  `slack_user_id` column both become wrong, and both are much cheaper to get right now than
  to retrofit across every call site later. That is the whole reason credentials moved into
  data (decision 2) and identity became a child table (decision 10).
- **Channel names are permanent.** Archived channels keep their names reserved, so a name
  chosen badly is wrong forever. That is what makes a hand-set abbreviation and a hand-set
  cycle code worth the extra field over anything computed.
- **Dev, preview and prod run the same code against different databases**, which is why
  `lib/env/project.ts` exists. Auto-provisioning on pod activation would have seeded test
  and simulated cycles into a real workspace. Hence the admin button, the enabled check,
  the `isProdProject()` gate, and a dry-run that logs the channel name and invite list
  without calling Slack. Recorded separately as [[slack-provisioning-trigger]].
- **Visibility is not automatable off Enterprise Grid.** A design that treated
  public-versus-private as an OLOS-owned toggle would be lying about what it controls, so
  OLOS reads it back instead.

## Consequences

- A migration adds `lab_slack_settings`, `participant_slack_identities`,
  `cycles.lab_cycle_number` (unique with `lab_id`), `cycles.slack_code` (unique with
  `lab_id`), `cycles.slack_channel_id`, `pods.slack_abbrev` and `projects.slack_abbrev`.
  Visibility config goes on `cycle_config`.
- **A cross-lab cycle cannot have one channel.** An HQ cycle whose sub-cohorts span labs
  (`00067_hq_open_cycle_sub_cohorts.sql`) puts its channels in one workspace, and a DC
  member can only be in them if they have joined that workspace too. So some members will
  be asked to join two workspaces, with two invite links, two joins and two identity rows.
  This is the sharpest cost of the per-lab decision and it is not solved here: Slack Connect
  shared channels need paid plans and behave differently enough to be its own decision.
- **Plan tier is per workspace.** Each lab's workspace has its own 90-day history limit on
  Free, its own ten-app cap, its own billing. Any nonprofit discount has to be claimed per
  workspace, and one lab on Free while another is on Pro is a normal state to expect.
- Each lab needs its own Slack app created in its own workspace, with the same scopes:
  `groups:write` for private channels, `channels:manage` for public and for rename,
  `users:read.email` for the lookup, `chat:write` once anything posts.
- Tokens can be revoked or the app uninstalled by a lab's own admins, so every call site
  has to handle `token_revoked` and `account_inactive` by marking that lab disconnected in
  admin rather than failing silently.
- Private channels cannot be discovered or rejoined by members, so anyone who leaves needs a
  re-invite. The reconciler covers this only for as long as it keeps running.
- A pod and a project can want the same abbreviation, since both tiers use the same
  template. The admin preview flags it and a person picks another; no code resolves it.
- Rate limits are not a constraint at this scale, roughly ten to fifteen channels per cycle
  per lab. Serverless function duration is, so provisioning must be resumable and must store
  each channel ID the moment it is created rather than looking channels up by name
  afterwards. `already_in_channel` on invite is success, not an error.
- Scope names, plan boundaries and rate tiers in this note come from knowledge current to
  mid-2026 and must be re-checked against Slack's documentation before implementation.

## What is not decided

- **How cross-lab cycles get channels.** The consequence above names the problem without
  solving it. Options are asking affected members to join two workspaces, giving each
  sub-cohort its own channel inside its own lab's workspace, or Slack Connect. Settled when
  the first genuinely cross-lab cycle is scheduled, and it should be settled before then.
- **When OAuth replaces pasted tokens.** Pasting a bot token per lab is right for a handful
  of labs and wrong for twenty, where a proper install flow (`oauth.v2.access`, state
  validation, uninstall events) pays for itself. Settled by lab count.
- **Is `team_join` worth an inbound route?** A cron reconcile means someone who joins Slack
  at 10am may not land in their channels until the next run. Hourly is probably fine.
  Inbound would need a public route per workspace, request signature verification and a
  3-second ack. Settled by whether the delay is actually felt.
- **Do projects need their own channels at all?** Decision 3 says yes because the schema and
  roadmap §4.5 assume it, but a pod and its single project sharing three people across two
  rooms fragments the conversation. Settled by watching a cycle run.

## Links

- Divergence from the Poderator PRD's provisioning invariant: [[slack-provisioning-trigger]]
- Aligns with, rather than departs from, [`docs/requirements/per-lab-configuration.md`](../../requirements/per-lab-configuration.md)
- Roadmap items this implements: `docs/OLOS-roadmap.md` §4.4, §4.5, §4.7
- Integration pattern being copied: `lib/integrations/luma.ts` and `app/api/cron/sync-luma-events/route.ts`
- Issue #189, the dismissal-based Slack checklist row that decision 10 closes
