---
title: Slack channels are provisioned from admin, private by default, named by cycle code
date: 2026-09-12
status: proposed
kind: decision
tags: [integrations, admin, pods, projects, schema]
related: ["[[slack-provisioning-trigger]]"]
---

# Slack channels are provisioned from admin, private by default, named by cycle code

**Implementation status: not started.** This records the design agreed on 2026-09-12,
before any code. It moves to `accepted` when the first channel is provisioned against
the production workspace and the open questions below are closed.

## Context

Slack already appears in OLOS in five places without any API integration behind it:
`NEXT_PUBLIC_SLACK_INVITE_URL` in the welcome email and the dashboard checklist, a
commented-out `SLACK_BOT_TOKEN` in `.env.local.example`, unused `slack_username` on
`participants`, unused `slack_channel_id` on `pods` and `projects`, and deep links in the
Poderator dashboard. Roadmap items §4.4, §4.5 and §4.7 all assume a bot exists.

The pain that opened this was not notifications. It was that creating a channel for every
new pod and adding the right people to it is manual work that repeats every cycle.

One constraint reshaped the whole design once it surfaced: **`conversations.invite` takes
Slack user IDs and only works for people already in the workspace.** No API on a standard
plan pulls a stranger into a channel. So "create a channel and add people" cannot be built
without first knowing who has joined the workspace, which OLOS currently does not know at
all: the `setup:slack` checklist row is dismissal-based (issue #189).

## Options considered

| Decision point | Options | Chosen |
|---|---|---|
| Trigger | Auto on pod status reaching `active`; admin button; cron | **Admin button**, idempotent |
| Channel names | Slug from the entity name; hand-set abbreviation; template with tokens | **Template with tokens**, abbreviation hand-set |
| Cycle identifier in the name | `cycles.id`; new `cycles.number` integer with a padding format; a short text code | **Short text code** |
| Lab in the name | `{lab}` token; absent, with the lab kept in data | **Absent**, uniqueness enforced instead |
| Visibility | Public; private; per-cycle setting | **Private default**, per-cycle setting |
| Membership source | `cycle_enrollments` plus exceptions; union of several sources | **Union** |
| Keeping Slack in sync | Call Slack from each membership endpoint; a converging reconciler | **Reconciler** |
| Channel ID storage | Columns on the entity tables; a `slack_channels` registry | **Existing columns**, registry deferred |

## Decision

1. **Three tiers of channel:** cycle, pod, project.
2. **Names come from per-tier templates**, editable in admin. Defaults are the existing
   hand convention: cycle `{cycle_code}` (`#c03`), pod and project
   `{cycle_code}-{abbrev}` (`#c03-effortvsimpact`, `#c03-blah`).
3. **`cycles.slack_code VARCHAR(12) UNIQUE`**, set by an admin, suggested as `c` plus a
   zero-padded ordinal. Never derived from `cycles.id`, which is a surrogate key that
   skips values and does not mean what a person means by "cycle 3". A text code also
   expresses sub-cohorts (`c03a`), which a padded integer cannot, and sub-cohorts already
   exist in the schema (`00067_hq_open_cycle_sub_cohorts.sql`).
4. **No lab token in channel names.** The lab is already reachable through
   `cycles.lab_id` (`00062_local_labs.sql`) and is surfaced as a filter column in admin,
   not encoded in the name. The `UNIQUE` on `slack_code` is what keeps a second lab's
   cycle 3 from colliding: someone types `dc03`.
5. **`slack_abbrev` on `pods` and `projects`**, auto-suggested by a squashing normalizer
   (lowercase, drop everything outside `[a-z0-9]`, insert no separators, strip no
   stopwords, truncate at 20 with a warning rather than a hard cut), then hand-editable.
   `Effort vs Impact` suggests `effortvsimpact`, not `effort-vs-impact`. Frozen once a
   channel exists; renaming is an explicit per-row action calling `conversations.rename`.
6. **Private by default**, with a per-cycle visibility setting. Visibility is read back
   from `conversations.info` on every reconcile and stored, because flipping an existing
   channel is a manual admin action in Slack: `admin.conversations.convertToPublic` is
   Enterprise Grid only. **The setting governs new channels, never existing ones.**
7. **Channel membership is a union**, not a query on enrollment: active
   `cycle_enrollments`, active `pod_memberships`, `project_memberships`,
   `moderator_assignments` for the pod, `user_roles` owner and admin, and the existing
   staff flag. Poderators, admins and staff therefore need **no cycle enrollment** to be
   added. Admins and staff joining every pod and project channel is opt-in per person,
   because at ten pods it is noise.
8. **Identity:** `participants.slack_user_id`, `slack_state`, `slack_linked_at`, resolved
   by `users.lookupByEmail` in the reconcile cron. `slack_username` stays and is display
   only, since the API will not accept it. Unresolvable people reach a `unmatched` state
   and are listed in admin for a hand-entered ID.
9. **Convergence, not eventing.** The reconcile cron diffs the desired member set against
   `conversations.members` and invites the difference. Membership endpoints never call
   Slack. Pending membership is derived at reconcile time and never stored, so there is no
   mirror table to drift.
10. **Everything is in admin.** A workspace-level `admin/slack` page (connection, name
    templates, default visibility, standing members, reconcile controls, unmatched list)
    and a Slack panel on `admin/cycles/[cycle_id]` (cycle code, per-row abbreviation,
    resolved name, state, pending count, provision and archive actions).
11. **Channel IDs stay on `cycles`, `pods` and `projects`.** A `slack_channels` registry
    is the tidier shape but two of the three columns already exist and the Poderator PRD
    already reads them. The registry earns its place when a channel needs to belong to no
    cycle, pod or project, such as a standing per-lab channel.

## Why

Four constraints did the deciding, and each is worth knowing because each is the thing
that would reopen the question:

- **You cannot add someone to a channel who is not in the workspace, and invites take IDs,
  not emails.** So identity mapping is a prerequisite, not a later phase, and the whole
  feature is capped by workspace join rate, which OLOS cannot force. This is also why
  staff are affected: an admin who never joined Slack cannot be added either.
- **Channel names are permanent.** Archived channels keep their names reserved, so a name
  chosen badly is wrong forever. That is what makes a hand-set abbreviation and a hand-set
  cycle code worth the extra field over anything computed.
- **Dev, preview and prod run the same code against different databases**, which is why
  `lib/env/project.ts` exists. Auto-provisioning on pod activation would have seeded test
  and simulated cycles into the real workspace. Hence the admin button, the
  `slackEnabled()` gate, the `isProdProject()` gate, and a dry-run that logs the channel
  name and invite list without calling Slack. Recorded separately as
  [[slack-provisioning-trigger]].
- **Visibility is not automatable off Enterprise Grid.** Any design that treated
  public-versus-private as an OLOS-owned toggle would have been lying about what it
  controls, so OLOS reads it back instead.

## Consequences

- A migration adds `cycles.slack_code` (unique), `pods.slack_abbrev`,
  `projects.slack_abbrev`, `cycles.slack_channel_id`, and the three identity columns on
  `participants`. Visibility config goes on `cycle_config`.
- Scopes needed: `groups:write` for private channels, `channels:manage` for public and for
  rename, `users:read.email` for the lookup, `chat:write` once anything posts.
  `SLACK_BOT_TOKEN` is server-only and must never become a `NEXT_PUBLIC_` variable.
- Private channels cannot be discovered or rejoined by members, so anyone who leaves needs
  a re-invite. The reconciler covers this only for as long as it keeps running.
- The `UNIQUE` on `slack_code` means labs cannot number cycles independently unless their
  codes differ. That is deliberate and is the cost of keeping the lab out of the name.
- A pod and a project can want the same abbreviation, since both tiers use the same
  template. The admin preview flags it and a person picks another; no code resolves it.
- Rate limits are not a constraint at this scale, roughly ten to fifteen channels a cycle.
  Serverless function duration is, so provisioning must be resumable and must store each
  channel ID the moment it is created rather than looking channels up by name afterwards.
  `already_in_channel` on invite is success, not an error.
- Scope names and rate tiers in this note come from knowledge current to mid-2026 and must
  be re-checked against Slack's documentation before implementation.

## What is not decided

- **One workspace, or one per lab?** Everything here assumes a single workspace for the
  Labs. `docs/requirements/per-lab-configuration.md` anticipates per-lab Slack. Per-lab
  workspaces would mean a bot token per lab and would make decision 4 and the unique
  constraint unnecessary. Settled by whoever decides lab autonomy, not by this note.
- **Is `team_join` worth an inbound route?** A cron reconcile means someone who joins
  Slack at 10am may not land in their channels until the next run. Hourly is probably
  fine. Inbound would need a public route, request signature verification and a 3-second
  ack, and is the only inbound case with a clear payoff so far. Settled by whether the
  delay is actually felt.
- **What plan is the workspace on?** Free tier hides messages past 90 days, which decides
  whether pod channels can be treated as any kind of record, and whether roadmap §4.7 can
  ever mean more than removing someone from channels. Settled by checking.
- **Do projects need their own channels at all?** Decision 1 says yes because the schema
  and roadmap §4.5 assume it, but a pod and its single project sharing three people across
  two rooms fragments the conversation. Settled by watching a cycle run.

## Links

- Divergence from the Poderator PRD's provisioning invariant: [[slack-provisioning-trigger]]
- Roadmap items this implements: `docs/OLOS-roadmap.md` §4.4, §4.5, §4.7
- Per-lab context: [`docs/requirements/per-lab-configuration.md`](../../requirements/per-lab-configuration.md)
- Integration pattern being copied: `lib/integrations/luma.ts` and `app/api/cron/sync-luma-events/route.ts`
- Issue #189, the dismissal-based Slack checklist row that decision 8 closes
