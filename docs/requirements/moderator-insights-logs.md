# Requirements — Moderator Insights on Learning Logs

| | |
|---|---|
| **Status** | Draft — for review (2026-07-27, drafted with Claude Code) |
| **Related code** | `lib/moderator/pod-insights.ts`, `lib/moderator/cross-pod-insights.ts`, `lib/moderator/rollup.ts`, `app/(dashboard)/moderator/pods/[pod_id]/insights-section.tsx`, `app/(dashboard)/moderator/cross-pod-insights-section.tsx`, `app/(dashboard)/moderator/ai-summary-block.tsx`, `app/(dashboard)/moderator/page.tsx` |
| **Related docs** | [`PRD-moderator-dashboard.md`](../PRD-moderator-dashboard.md) §7.9/§7.10, [`architecture-review-onboarding-state-machine.md`](../architecture-review-onboarding-state-machine.md) |
| **Depends on** | The registered/active + Learning-Log-cadence work (migration `00099`; `lib/learning-logs/at-risk.ts`; the `pod-detail.ts` health conversion) |

## Overview

The moderator **Insights** surfaces — the per-pod Insights tab (§7.9.2), the
cross-pod insights on the All-pods view (§7.9.3), the AI-assisted summary
(§7.10.3), and the fleet rollup cards (§7.10.2) — still read `pulse_checks`
(`survey_responses` free-text, `tools_used`, `blockers`/`tailwinds`). The
weekly **Learning Log** has replaced the pulse check as the engagement
instrument: new cycles never write `pulse_checks`, so for every current cohort
these panels render **empty** ("No pulse history yet"). The pod-health header
and roster at-risk signal were already moved to logs; Insights is the last
pulse-fed surface.

This document specifies rebuilding Insights on `learning_logs`. It is a
**requirements** doc, not an implementation plan — it defines the target
metrics, the field mapping, the legacy-pod behavior, and the open product
decisions. The one hard gap (AI-tool adoption has no Learning Log source) is
called out explicitly.

## Current state (pulse-based)

Every metric below is computed from `pulse_checks` rows for the pod's cycle,
bucketed by `scheduled_date` (the pre-scheduled weekly pulse row):

| Metric | Source | Where |
|---|---|---|
| **Top AI tools** (distinct members per tool, top 5) | `survey_responses.tools_used[]` | pod + cross-pod |
| **Weekly completion trend** (submitted / scheduled per week) | pulse `completed_at` per `scheduled_date` | pod + cross-pod (per-pod comparison) |
| **Response depth trend** (avg free-text chars per submitted pulse) | concatenated `survey_responses` free-text fields | pod |
| **Tailwinds vs blockers** (count of pulses mentioning each) | `survey_responses.tailwinds` / `.blockers` | pod |
| **Recent comments** (feeds the AI summary bundle) | concatenated free-text (`accomplishment`, `highlight`, `challenge`, `blockers`, `tailwinds`, `mitigation_strategy`, `anything_else`), initials + week | pod + cross-pod → `ai-summary-block.tsx` |
| **Pulses this period** (submitted vs possible, engagement trend) | `rollup.ts` over pulse rows | fleet cards (`moderator/page.tsx`) |

The AI summary bundles the recent comments (initials only) with
`cycle_config.ai_summary_prompt` for the moderator to paste into their own LLM
(OLOS runs no model server-side). Both scopes share a 4-week / full-cycle range
toggle, pre-computed server-side.

## The data shift — pulse fields → Learning Log fields

`learning_logs` (migration `00040` v1, `00091` weekly v2) carries a **richer**
signal than pulses, but a **different** one. There is no `survey_responses`
JSONB and no `tools_used`.

**Numeric (1–5) — new, logs-only, ideal for trend viz:**
- v1 (all kinds): `clarity`, `alignment`
- v2 (weekly): `progress_rating`, `collab_rating`, `capability_rating`, `energy_rating`
- `hours_bucket` (availability bucket text, e.g. "2–5 hrs/week")

**Blocked signal (replaces blockers/tailwinds):**
- `is_blocked` (boolean) + `blocker_context` (v1) / `stuck_tried` (v2)

**Free text (feeds depth + AI summary):**
- v1: `accomplished`, `exploring`, `next_focus`, `blocker_context`
- v2: `contribution`, `learned`, `stuck_tried`, `blocker_context`, `recognition`
- `feeling_word` (optional single word), `recognition` (optional shout-out)

**Structural:** `kind` (`weekly` / `milestone_7` / `milestone_13`),
`schema_version` (`v1` / `v2`), `cycle_id`, `created_at`, `share_publicly`.

> **Schema-version handling is mandatory.** A cycle can hold both v1 and v2
> logs. Every extractor (depth, AI-summary text, ratings) MUST read the union
> of the version-appropriate fields and skip nulls — do not assume v2.

> **Weeks come from the cycle calendar, not scheduled rows.** Logs have no
> `scheduled_date`. Reuse the reconstruction already shipped in
> `lib/learning-logs/at-risk.ts` (`consecutiveMissedLogWeeks`) and
> `lib/cycle/week.ts` (`getCycleWeek` / `getCycleWeekStart`): a member
> "completed" a cycle-week iff ≥1 cycle-attributed log lands in it. This is
> the same synthesis `pod-detail.ts` now uses for pod health.

## Requirements — target metrics

Each is the log-based replacement for a current tile. Restrict aggregate
trends to `kind='weekly'` logs unless noted (milestone reviews are a separate
instrument).

1. **Weekly completion trend** *(replaces "Pulse completion trend")* — per
   cycle-week, share of active members with ≥1 log that week. Reuse the
   synthesized-cadence logic. Keep the per-pod comparison on the cross-pod view.

2. **Response depth trend** *(keep, re-sourced)* — avg concatenated free-text
   length per week across the version-appropriate text fields. Direct analog;
   same "paragraphs → one-liners = disengaging" read.

3. **Blocked rate** *(replaces "Tailwinds vs blockers")* — per week, share of
   logs with `is_blocked = true`. The pulse tailwinds/blockers split has no
   clean log analog; `is_blocked` is the honest blocker signal. Pair it with
   (4) rather than inventing a "tailwind".

4. **Health-rating trends** *(new, logs-only — a genuine upgrade)* — weekly
   averages of the 1–5 ratings, viz'd as trend lines: `progress_rating`,
   `energy_rating`, `capability_rating`, `collab_rating` (v2) and
   `clarity`/`alignment` (v1). Decide the featured set in review (see Open
   Decisions). These replace the crude char-count/keyword proxies pulses used.

5. **Recent reflections → AI summary** *(keep, re-sourced)* — concatenate each
   log's version-appropriate free-text (initials + week), newest first, capped
   as today (24 pod / 32 cross-pod). Update `ai-summary-block.tsx` copy from
   "pulse comments" to "Learning Log reflections" and revise
   `cycle_config.ai_summary_prompt`'s default wording (it names pulses).

6. **Recognition feed** *(new, optional)* — surface recent non-empty
   `recognition` shout-outs. Low effort, high morale signal; can also be
   appended to the AI-summary bundle.

7. **Feeling-word cloud** *(new, optional / nice-to-have)* — frequency of
   `feeling_word` over the range. Defer if it complicates Phase 1.

## The hard gap — AI-tool adoption

"Top AI tools" has **no Learning Log source.** Logs do not capture a per-week
tool list the way `pulse_checks.survey_responses.tools_used` did. Resolve one
of:

- **(a) Drop the tile.** Simplest; accept that per-cycle AI-tool adoption is no
  longer tracked on the moderator surface.
- **(b) Add a `tools_used` field to the weekly log** (new migration + form
  field + validation). Restores the metric natively; costs a log-form change.
- **(c) Source from `baseline_responses`.** The onboarding baseline captures
  `ai_usage_frequency` (not a tool list) — a *frequency* proxy, not adoption by
  tool. Weaker, but zero new capture.

**Recommendation:** (a) for the first cut, revisit (b) if the tool-adoption
signal proves missed. This is a product decision — flagged, not assumed.

## Legacy pods

Mirror the deterministic split already used by the Recent-activity tab
(`recent-activity-feed.tsx`) and `pod-detail.ts`: a pod whose cycle has real
`pulse_checks` rows is a **legacy** pod and keeps the pulse-based insights
verbatim; every other pod is log-based. Do not backfill or migrate pulse
history into logs. New code paths read logs; the existing pulse functions stay
for the legacy branch.

## Privacy constraints

- `clarity` / `alignment` (and the v2 ratings) are documented as private to the
  member, their Poderator, and admins — "the metrics NEVER travel with a share"
  (`00040` header). Aggregate rating trends on the **moderator-scoped** Insights
  tab are fine; they must never leak into public `profile_updates` shares.
- The AI-summary bundle stays **initials-only** (as today). Free-text pasted to
  an external LLM is the moderator's action; keep the preview-before-copy flow.

## Affected surfaces (implementation scope, for the eventual plan)

- `lib/moderator/pod-insights.ts`, `lib/moderator/cross-pod-insights.ts` —
  rewrite the metric computation against `learning_logs`; branch to the legacy
  pulse path when the pod has pulse rows. Reuse `lib/learning-logs/at-risk.ts` +
  `lib/cycle/week.ts` for week reconstruction.
- `lib/moderator/rollup.ts` — `pulsesThisPeriod` → a logs-this-period /
  completion measure (mechanical; same synthesis).
- `insights-section.tsx`, `cross-pod-insights-section.tsx` — retitle tiles,
  swap the depth/sentiment tiles for blocked-rate + rating trends, drop or
  gate the AI-tools tile per the decision above.
- `ai-summary-block.tsx` + `cycle_config.ai_summary_prompt` — reflection
  wording.
- `moderator/page.tsx` — fleet cards labeled/fed from logs.

## Open decisions

1. **AI-tools tile:** drop (a) / add log field (b) / baseline proxy (c). *Rec: (a).*
2. **Featured ratings** for the health-trend tile: which of
   progress/energy/capability/collab (v2) + clarity/alignment (v1) lead, and how
   to present a cycle that mixes v1 and v2 logs.
3. **Keep pulse insights for legacy pods**, or retire the panels entirely once
   no active cycle is pulse-based? *Rec: keep the legacy branch; it's cheap.*
4. **Recognition feed / feeling-word cloud:** Phase 1 or defer.

## Suggested phasing

- **Phase 1 (mechanical, high value):** completion trend + depth trend + AI
  summary on logs; fleet rollup on logs. Reuses shipped synthesis; no schema
  change; unblocks every current cohort.
- **Phase 2:** blocked-rate + health-rating trends (the logs-only upgrade),
  recognition feed.
- **Phase 3:** resolve the AI-tools decision; feeling-word cloud.

## Verification

- Seed a log-based cycle with weekly logs spread across several cycle-weeks
  (mixed v1/v2), some members skipping weeks. Confirm each Insights tile
  populates: completion trend matches the synthesized cadence, depth reflects
  the version-appropriate text, rating trends average correctly, AI bundle
  lists initials-only reflections with the updated prompt.
- A **legacy** pod (cycle with `pulse_checks` rows) still shows the original
  pulse insights unchanged.
- A brand-new cycle with no completed weeks shows empty-but-not-broken tiles
  (no "No pulse history yet" copy).
- Privacy: verify no rating/clarity value appears in any public share surface.
