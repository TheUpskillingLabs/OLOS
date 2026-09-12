---
title: Slack provisioning is triggered from admin, not automatically at pod activation
date: 2026-09-12
status: proposed
kind: divergence
tags: [spec-divergence, integrations, admin]
related: ["[[ADR-0003-slack-channel-provisioning]]"]
---

# Slack provisioning is triggered from admin, not automatically at pod activation

**Recorded ahead of implementation.** Nothing is built yet, so this describes a decided
departure rather than shipped behaviour. It moves to `accepted` when provisioning ships.

## What the spec says

`docs/PRD-moderator-dashboard.md` §4 Non-goals:

> New external-resource provisioning (Slack channels, Drive folders, GitHub repos, Google
> Groups remain provisioned at pod activation, per the existing architectural invariant).

The PRD treats provisioning-at-pod-activation as an existing invariant it is deliberately
not touching. `docs/requirements/per-lab-configuration.md` reads the same way: pods and
projects "create Slack channels, Drive folders" as a consequence of being created.

## What the build will do instead

Provisioning is an explicit, idempotent action in admin: a **Provision** button per row and
per cycle on `admin/cycles/[cycle_id]`, guarded by `slackEnabled()` and `isProdProject()`,
with a dry-run that logs the channel name and the invite list without calling Slack. Pod
activation has no Slack side effect.

Ongoing convergence is still automatic: the reconcile cron adds late Slack joiners and new
pod members without anyone pressing anything. What is manual is the **first** creation of a
channel, not the maintenance of its membership.

## Why it moved

Recorded in full in [[ADR-0003-slack-channel-provisioning]]. The short version: OLOS runs
the same code against a shared dev Supabase project, a preview deployment and production,
and it has a member-simulation mode. A side effect wired to pod activation would fire
during seeding, test cycles and simulation, and would create real channels in the real
workspace, which cannot be undone cleanly because archived channels keep their names
reserved forever.

`lib/env/project.ts` exists because treating prod as dev has been a live risk in this
codebase before. This is the same hazard with a more visible blast radius: a junk channel
is seen by every member of the workspace.

## Is the spec now wrong, or is the build?

**The PRD should be amended when this ships.** The invariant it cites was never
implemented, so the PRD is describing an intention rather than a behaviour, and the
intention turns out to be unsafe as stated. Until provisioning ships, the PRD stays as
written and this note is the record of why it will change.

Whoever amends it should also correct the implication that the other three resources
(Drive, GitHub, Groups) are provisioned automatically today. None of them are.

## Downstream effects

- Roadmap §4.7 (access revocation automation) is the mirror image of this and inherits the
  same reasoning: deprovisioning should be an explicit admin action, not a side effect of a
  revocation row appearing.
- Anything written on the assumption that a pod's `slack_channel_id` is populated as soon
  as the pod is active has to tolerate `NULL`. The pod and project pages, and the Poderator
  dashboard's resource links, need an unprovisioned state rather than a broken link.
