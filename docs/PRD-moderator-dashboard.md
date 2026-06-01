# PRD — Poderator Dashboard

| | |
|---|---|
| Status | Draft |
| Author | Madhu (drafted with Claude) |
| Last updated | 2026-05-20 |
| Related persona | [`personas.md` — Poderator](personas.md#poderator) |
| Related spec | [`TUL_MVP_Spec.md`](../TUL_MVP_Spec.md) §Roles, §Pulse Checks, §Pod Registration |
| Related architecture | [`OLOS-architecture-brief.md`](OLOS-architecture-brief.md) §Roles, §Phase machine |
| Related roadmap items | §1.13, §1.14, §2.7, §3.5, §3.6 |
| Related code | [`lib/auth/CLAUDE.md`](../lib/auth/CLAUDE.md) (role resolution); `app/(dashboard)/pods/[id]/` (planned) |
| Related issues | TBD (file at implementation kickoff) |

## 1. Background

OLOS assigns a poderator to each pod for the duration of a single cycle. The poderator's responsibility is to keep the pod's momentum up, surface and re-engage members at risk of disengagement, and orient the pod to what each phase of the cycle requires of them. They are not staff, and they are not the subject-matter expert on the pod's problem area.

Poderator-facing functionality is currently scattered across the roadmap: §1.13 and §1.14 cover a pod-members list with pulse-completion status, §2.7 covers pulse response review, §3.5 covers pulse aggregations, and §3.6 covers project membership visibility. There is no unified surface that brings these capabilities together, and no single page a poderator can land on to assess their pod's state.

## 2. Problem statement

A poderator today has no purpose-built place in OLOS to do their job. The information they need to identify at-risk members, understand what their pod should be doing this week, and act on disengagement signals is either not yet built, lives in disconnected views, or sits in external systems (Slack, sheets). Without a unified surface, the poderator role is harder to take on, harder to scale across cycles, and less effective at the program's core goal of preventing silent attrition.

## 3. Goals

- Provide a single signed-in page where a poderator can assess the health of their pod(s) and identify members needing attention within 30 seconds of landing on it.
- Surface disengagement signals (missed pulses, dropped activity) in time for the poderator to intervene before a member leaves.
- Consolidate the poderator-facing capabilities already on the roadmap into one coherent surface.
- Make pod-scoped program state legible without requiring the poderator to contact staff or open external tools.
- Reduce orientation cost for first-time poderators who do not have prior participant experience.
- Preserve role-stacking: a poderator who is also a participant in their own project must retain both views.
- Support multi-pod poderator assignment as a first-class case, since multi-pod assignment is the common pattern.

## 4. Non-goals

- A project-level dashboard for the building phase that follows pod and project formation.
- Cross-pod analytics or organizer-facing aggregations.
- Modification of the pulse-check schema, response shape, or submission behavior.
- New external-resource provisioning (Slack channels, Drive folders, GitHub repos, Google Groups remain provisioned at pod activation, per the existing architectural invariant).
- Replacement of poderator ↔ member communication channels (conversations continue in Slack; the dashboard surfaces signal only).
- Modification of pod membership (add/remove member actions remain staff-only and are handled elsewhere).
- Automated outreach to members (no auto-DMs, auto-emails, or auto-reminders sent from OLOS on the poderator's behalf).

## 5. Glossary

- **Poderator** — community member assigned to one or more pods for one cycle. Stored as one or more rows in `moderator_assignments` with `removed_at IS NULL`. See [`personas.md`](personas.md#poderator).
- **Pod** — group within a cycle, seeded by a top-voted problem statement.
- **Pulse check** — weekly check-in completed by active participants. The configured number of consecutive missed pulses (default: 2) is the canonical disengagement signal.
- **Phase** — one of the seven cycle stages (problem submission, pod voting, pod registration, solution submission, project voting, project shortlist, project registration).
- **All pods view** — the cross-pod overview presented to multi-pod poderators, aggregating at-risk-member nudges from all assigned pods into a single list.
- **Per-pod view** — the full dashboard scoped to one pod, comprising the pod status header, member roster, pulse response review, phase guidance, and pod resources.

## 6. Information architecture

The dashboard exposes two views, navigated via a switcher control at the top of the page:

- **All pods view** — cross-pod aggregated nudges only. Default landing for multi-pod poderators on first sign-in.
- **Per-pod view** — full per-pod content (status header, nudges scoped to that pod, member roster, phase guidance, pod resources). Default landing for single-pod poderators.

Within a per-pod view, sections render top to bottom as follows:

1. Pod status header (§7.1)
2. At-risk-member nudges, scoped to the pod (§7.2)
3. Member roster (§7.3)
4. Pulse response review — drill-in from the roster (§7.4)
5. Pod-level pulse insights (§7.9)
6. Phase guidance (§7.5)
7. Pod resources (§7.6)

The All pods view shows, top to bottom: cross-pod at-risk nudges (§7.2), pod summary cards (§7.10.1), a members-needing-attention rollup (§7.10.2), cross-pod pulse insights (§7.9.3), and an LLM summary prompt export affordance (§7.10.3). The switcher and the poderator's last-selected view are described in §7.7.

## 7. Functional requirements

### 7.1 Pod status header

The header summarizes the pod and the cycle at a single glance.

- Display the pod name and the cycle name.
- Display pod status (`forming`, `active`, or `inactive`).
- Display the current cycle phase by name and number (e.g. "Phase 4: Solution Proposals").
- Display the open and close timestamps for the current phase, plus a relative countdown to the close timestamp.
- Display one pod-health indicator: the count of pod members who have **not** completed the current week's pulse check, banded into three states (healthy, warning, critical). Bands are absolute-headcount, not percentage-based, because poderators think in terms of "Sarah didn't pulse" rather than "we're at 78%."
- Display a small **trend arrow** (↑ / ↓ / →) alongside the headline indicator, reflecting the direction of pulse-completion over the last three weeks.
- Band thresholds (e.g. "healthy = 0 missing, warning = 1–2 missing, critical = 3+ missing") are configurable per cycle in cycle-config, with global defaults applied when a cycle hasn't overridden them.
- For pods in `forming` or `inactive` status, suppress the pulse indicator and replace it with a status explainer.

### 7.2 At-risk-member nudges

Nudges are server-computed and surfaced on the dashboard. Only one nudge type ships in v1.

- **At-risk member nudge.** Fires when a pod member has missed the configured number of consecutive pulses (default: 2). One nudge per affected member.
- Nudge persists until either the member submits a pulse or the poderator dismisses it.
- Dismissal is per poderator, per nudge instance. A dismissed nudge does not suppress future at-risk nudges for the same member if the condition re-triggers.
- Render no more than three nudges at any time per view. Excess collapses into a "see N more" affordance.
- The system flags only. The poderator follows up via Slack DM or other means; the dashboard does not initiate outreach.
- In the per-pod view, nudges are scoped to the pod. In the All pods view, nudges aggregate across all of the poderator's pod assignments and each nudge identifies the source pod.
- Delivery is dashboard-only in v1. No email or Slack push. Backend nudge computation is decoupled from delivery so future channels (e.g. weekly digest email) can be added without changing the underlying logic.
- The miss-threshold for the nudge is configurable per cycle in cycle-config.

### 7.3 Member roster

The roster lists every member of the pod with engagement signal.

- One row per member.
- Each row displays the **member preview** (§7.3.1 below), the pulse-engagement status badge, and the last-activity timestamp formatted as a relative time.
- On row expansion or hover, additional profile fields are revealed: employer, interest areas, work style, group strengths, labs goals.
- A click-through to the member's full profile additionally exposes: AI tools used, cycle-fit signal, city-level location.
- Never exposed to the poderator: phone number, free-text personal notes, contact-consent flags. The registration form must disclose to upskillers which fields their poderator can see (program-team-owned copy update, ships alongside this dashboard).
- Pulse-engagement status values:
  - **Current** — completed this week's pulse.
  - **Pending** — pulse window is open, no submission yet.
  - **Late** — pulse window closed without a submission.
  - **At risk** — has hit the configured consecutive-miss threshold.
- Default sort order: at-risk, late, pending, current.
- Filter by status; search by name. Filter and sort state persists per poderator across sessions.
- Each row exposes two quick actions: open the member's pulse response history (links into §7.4) and open a Slack DM to the member (deep-link to Slack).
- Members with `cycle_enrollments.status = 'inactive'` are excluded from the default view. A "Show inactive" toggle reveals them, rendered at reduced opacity, sorted to the bottom, each showing their inactive-since date.

#### 7.3.1 Member preview shape

The same structured **member preview** is used everywhere a poderator sees a member at-a-glance: the per-pod roster, the All pods nudges (§7.2), and the pulse response panel header (§7.4). One shape, rendered slightly differently per surface but with no field redefinition.

| Field | Type | Source |
|---|---|---|
| `name` | string — first name + last initial (e.g. "Linda P.") | `participants.first_name`, `participants.last_name` |
| `ai_experience_level` | enum: `new`, `consumer`, `builder`, `shipper` | `participants.ai_experience_level` (new column) |
| `professional_role` | string (short — e.g. "Researcher") | `participants.professional_role` |
| `industry` | string (short — e.g. "NGO", "Federal") | `participants.industry` |
| `availability` | string (short, freeform — e.g. "weekends only") | `participants.availability_snippet` |

UI labels for `ai_experience_level` (program-team-owned copy, may be edited without code changes):

| Enum value | Default UI label |
|---|---|
| `new` | New to building |
| `consumer` | Consumer of AI tools |
| `builder` | Has built with AI |
| `shipper` | Ships AI projects |

Render rules per surface:

- **Per-pod roster row.** Two-line display: line 1 — `name`; line 2 — `{ai_experience_level label} · {availability}`. A separate "Background" table column shows `{professional_role} · {industry}` on viewports md and above.
- **All pods nudges (§7.2).** Single-line preview: `{name}` · `{professional_role} · {industry}` · `{availability}`. AI experience level is omitted at the cross-pod triage stage to keep the line scannable; the poderator can drill in for it.
- **Pulse response panel header (§7.4).** Same as the roster row plus the pod name as a chip; field shape unchanged.

Filter/sort:

- Roster filter supports filtering by `ai_experience_level` value (e.g. "show me everyone new to building").
- Roster sort options include AI experience level (alphabetical by enum-ordered display).

### 7.4 Pulse response review

The pulse response review is a drill-in surface accessed from the member roster.

- Opens as a side panel (or modal on narrow viewports) without navigating away from the dashboard.
- Displays an **individual-level aggregate block** at the top of the panel, summarizing this member's pulse history across the cycle (see §7.9.1).
- Displays the selected member's per-week pulse responses below the aggregate, most recent first.
- Each response shows: submission timestamp, free-text answers, and selected options for multi-select fields.
- Default range for per-week responses: last four weeks of responses for the active cycle. The poderator can expand to the full cycle via an inline "Show full cycle history" control at the bottom of the per-week stream. The aggregate block always reflects the full cycle regardless of the expand state.
- Read-only with respect to OLOS state: the poderator cannot edit pulse responses, send messages from the panel, or initiate any outreach from inside OLOS. Only the participant can submit or modify their own responses. The panel renders a visible "Read-only — OLOS doesn't send messages" stance in the panel footer to make the no-automated-outreach posture (§4) explicit.
- The panel surfaces a single passive affordance: an **Open Slack DM** link that deep-links to Slack for the currently-viewed member. The same affordance from §7.3 carries into the panel for one-click convenience; OLOS does not send the message — Slack does, and only after the poderator types and sends.
- Access is scoped to the poderator's assigned pods. Attempts to load responses for members outside the poderator's pod assignments return 403.
- Navigation between members within the panel does not close the panel; the aggregate block re-renders for the new member. The panel header shows a "Member N of M" indicator reflecting the member's position in the current roster sort, with previous/next arrows that follow that order.

### 7.5 Phase guidance

The phase guidance section orients the poderator to what the cycle phase requires of their pod.

- Display a plain-English description of the current phase, including what members are expected to do, what the poderator should look out for, and what healthy pod activity looks like at this stage.
- Display the close timestamp for the current phase and the open timestamp for the next phase.
- Display a phase-specific signal block, with content determined by the current phase:
  - Pod voting: count of pod members who have voted vs. registered.
  - Solution proposal submission: count of proposals submitted, with submitter identity.
  - Project voting: count of active members who have cast ballots.
  - Project registration: list of projects below the minimum registrant threshold.
- The plain-English description and the deadlines are always present. The phase-specific signal block updates as the cycle progresses through phases.

### 7.6 Pod resources

The resources panel surfaces external resources provisioned for the pod.

- Display deep links to the pod's Slack channel, Drive folder, GitHub repo, and Google Group.
- Each link sources from the URL persisted to the database at pod activation.
- If a resource failed to provision and is missing from the database, render a "missing — contact staff" affordance instead of a broken link.
- The panel is read-only. Resource provisioning is handled at pod activation; this dashboard does not provision or re-provision resources.

### 7.7 Switcher and last-view persistence

The switcher is the primary navigation control between the All pods view and per-pod views.

- The switcher appears at the top of every dashboard page.
- The switcher options are: "All pods" (overview) and each pod the poderator is assigned to, listed by name.
- Single-pod poderators see a switcher with one option; the All pods entry is suppressed.
- A poderator's most recent selection persists across sessions. They land wherever they last were.
- First-time multi-pod poderators land on **All pods** by default.
- First-time single-pod poderators land on their single pod's view.
- The active selection is reflected in the URL path so that links between poderators (e.g. shared in Slack) deep-link correctly.

### 7.8 In-product tooltips

Lightweight tooltips assist with UI-mechanic orientation, particularly for first-time poderators. They do not replace the poderator handbook or kickoff session, which own programmatic orientation ("what does a healthy pod look like at week 4").

- Tooltips attach to specific UI elements: the pod-health indicator, the trend arrow, engagement-status badges, the at-risk nudge type, the phase guidance section header.
- Tooltips trigger on hover for desktop, on tap for touch devices.
- Each tooltip displays automatically the first 1–2 times a poderator encounters its element, then suppresses for that poderator. Suppression is per poderator, per tooltip key.
- The "help" affordance for each tooltipped element remains visible (e.g. small `?` icon) so a poderator can re-trigger the tooltip on demand even after auto-suppression.

### 7.9 Pulse-check aggregations

Aggregated views of pulse-check data surface patterns the per-week response stream can't show on its own. Aggregations are computed server-side and render at three scopes: individual, pod, and across-pods.

The structured fields on each pulse check (AI tools used, multi-select option lists) aggregate by deterministic counts. The free-text fields ("what went well," "what I'm stuck on," "help I need") are reduced to themes by an LLM pass and stored with citations back to the source pulse responses, so a poderator can always trace a theme back to who said what.

#### 7.9.1 Individual aggregation

Rendered as a block at the top of the pulse response review side panel (§7.4), above the per-week responses. Scoped to a single member across the full active cycle.

- **Top AI tools used.** Up to five tools, ordered by frequency of selection across that member's pulse responses. Each shows a count of the number of pulses in which the member named it.
- **Recurring "stuck on" themes.** Up to three themes derived from the member's free-text responses, ordered by frequency. Each theme is one short phrase plus a count of pulses where it surfaced.
- **Recurring help requests.** Up to three themes from the "help I need" field, same shape as above.
- **Engagement trajectory.** A small sparkline or week-by-week dot row showing pulse completion across the cycle (submitted / missed) so the poderator can see at a glance whether engagement has been rising, falling, or stable.
- Each theme links back to the source pulse responses, scrolling the panel to the relevant week(s) on click.

#### 7.9.2 Pod-level aggregation

Rendered as a section on the per-pod dashboard, between the member roster (§7.3) and the phase guidance (§7.5). Scoped to one pod, default to the last four weeks with a toggle for the full cycle.

- **Top AI tools across the pod.** Up to five tools, ordered by the count of pod members who named them in their pulse responses (not by raw mention count, so one heavy user doesn't dominate). Each shows the count of pod members.
- **Top "stuck on" themes.** Up to three LLM-derived themes from the pod's free-text responses, each with a count of distinct members who surfaced it. Themes that appear in only one member's responses are suppressed.
- **Top help requests.** Same shape as stuck-on themes.
- **Pulse completion trend.** A small bar or line showing the pod's pulse-completion rate over the displayed range, week by week.
- Each theme item links to the underlying pulse responses, opening the pulse review panel (§7.4) for the relevant member(s) and scrolling to the matching week.
- A clear empty state when the pod has insufficient data (fewer than two members with pulse responses in the range): "Not enough pulse data yet to show themes."

#### 7.9.3 Cross-pod aggregation

Rendered as a section on the All pods view, beneath the pod-summary cards. Scoped to all of the poderator's assigned pods, default to the last four weeks with a toggle for the full cycle.

- **Patterns across your pods.** LLM-derived themes that appear in two or more of the poderator's pods, surfaced as a list with per-pod breakdown (e.g. "Confusion about solution proposal scope — Health Systems Access · Energy Grid Resilience"). Helps a poderator notice when a problem is structural to the program rather than specific to one pod.
- **AI tool adoption by pod.** A small grid comparing the top tools in each pod side by side. Useful for cross-pollination: if Pod A is getting traction with Cursor and Pod B isn't using it yet, the poderator can route that knowledge.
- **Engagement comparison.** Each pod's pulse-completion rate over the displayed range, shown as side-by-side mini-trends so the poderator can spot a pod whose engagement is sliding relative to the others.
- Section is suppressed entirely for single-pod poderators.

#### Cross-cutting requirements

- **Computation.** Theme extraction runs after each pulse submission window closes and is cached. Structured-field aggregates are computed live (cheap) unless `pulse_check_aggregates` is in use.
- **LLM provenance.** Each LLM-derived theme records which pulse-response rows contributed to it. Poderators see this as "from N responses across M members" with a link to the underlying responses.
- **Privacy.** Themes are visible to poderators of pods the responses came from. Cross-pod themes are visible only to poderators with assignments in all contributing pods (no leakage between unrelated pods).
- **Tone.** Theme labels are descriptive, not judgmental. The system surfaces "Confusion about proposal scope," not "Members seem lost." This is a design rule for prompts that generate themes; copy review is required.

### 7.10 All pods view composition

The All pods view aggregates signal across every pod the poderator is assigned to. In addition to cross-pod nudges (§7.2) and cross-pod insights (§7.9.3), three All-Pods-specific surfaces render here.

Single-pod poderators do not see §7.10.1 or §7.10.2 (their default landing is the per-pod view). §7.10.3 renders on both the All pods view and on each per-pod dashboard.

#### 7.10.1 Pod summary cards

One card per assigned pod, rendered in a horizontal grid beneath the cross-pod nudges.

- Each card displays: pod name, pod status (`forming`, `active`, `inactive`), cycle phase name + week number, headline pulse-health figure (count of members missing this week's pulse), and a three-week trend arrow (↑ / ↓ / →).
- The headline figure uses the same band thresholds as §7.1 (healthy / warning / critical).
- Each card is a click-through to that pod's per-pod view.
- Default sort: pods with non-zero at-risk nudge counts first, then alphabetical by pod name.

#### 7.10.2 Members-needing-attention rollup

A four-metric KPI block summarizing engagement across all assigned pods. Rendered between the pod summary cards (§7.10.1) and the cross-pod insights (§7.9.3).

- **Pulsing this week.** Count of members who have submitted this week's pulse over total active members across all assigned pods.
- **At risk.** Count of members at the configured consecutive-miss threshold (§7.2 nudge condition), with count of pods affected.
- **Pulses this period.** Count of pulses submitted over total possible pulses across the displayed range. Range follows the §7.9.3 last-4-weeks / full-cycle toggle.
- **Engagement trend.** Aggregate weekly completion rate as a percentage, with a three-week trend arrow and the prior-week comparison value.

#### 7.10.3 LLM summary prompt export

The dashboard provides a "Copy summary prompt" affordance that produces a templated prompt the poderator can paste into a third-party LLM (ChatGPT, Claude, Gemini, etc.) to get a narrative summary of what's going on with their pods. OLOS does not call any LLM as part of this affordance — the poderator's own tool does the work.

- The affordance renders on both the All pods view (covering all assigned pods) and each per-pod dashboard (covering one pod). Placement is alongside the §7.9 cross-pod / pod-level insights section.
- Clicking opens a preview modal showing the exact prompt that will be copied, with the poderator's current data interpolated.
- The prompt template, including its phrasing and the instruction to the LLM (e.g. "Summarize what's going on with these pods this week and flag anything I should pay attention to"), is stored as a versioned string the program team can edit without code changes.
- Interpolated data: pod names, current phase per pod, count of members per pod, weekly pulse-completion rate per pod, top stuck-on themes and top help-request themes from §7.9, at-risk member count per pod.
- **Privacy.** The prompt excludes by default: member full names (use initials), free-text pulse responses, contact information, and any field listed in §7.3 as "never exposed to the poderator." The preview is the source of truth — the poderator sees exactly what will be copied, so they can review before pasting into a third-party LLM.
- A short disclaimer renders beside the affordance: "Copies a summary of your pod data. You'll paste it into your own AI tool — OLOS doesn't send anything." The exact copy is program-team-owned.
- Telemetry: log copy events (poderator id, scope = `all_pods` or `pod_id`, timestamp) to gauge feature usage without recording prompt contents.

## 8. Permissions and access control

- Routes:
  - `/moderator` — All pods view.
  - `/moderator/pods/[id]` — per-pod view.
- Authorization is enforced at the route level and re-checked at each underlying API endpoint.
- Visible to:
  - Users with one or more poderator assignments (`moderator_assignments` row, `removed_at IS NULL`). The All pods view aggregates across all the poderator's assignments; the per-pod view requires assignment to the specific pod.
  - Admins and owners (global access to all pods on both views).
  - Observers (read-only access; nudge dismissals disabled).
- A poderator with both poderator and participant roles can navigate between the poderator dashboard and the participant view without re-authentication. Role-stacking is preserved.
- Loss of poderator assignment (`removed_at` is set) revokes access immediately on the next request, including in the All pods view aggregation.

## 9. Data model implications

This PRD primarily consumes existing data. The following additions are anticipated:

- **`nudge_dismissals`** — new table. Schema: `(moderator_participant_id, pod_id, nudge_key, dismissed_at)`. Records dismissed nudge instances so they remain dismissed across sessions.
- **`moderator_ui_state`** — new table. Tracks per-poderator switcher last-selected view (`all_pods` or a specific `pod_id`), roster filter/sort state, and tooltip suppression keys. Applies to admins and poderators alike.
- **`pulse_themes`** — new table. Schema: `(theme_id, scope_type, scope_id, scope_window_start, scope_window_end, source_field, theme_label, member_count, mention_count, contributing_pulse_ids[], generated_at)`. Stores LLM-derived themes for §7.9 aggregations. `scope_type` is one of `individual`, `pod`, or `cross_pod`. Theme labels are subject to the tone rules in §7.9. Populated by the LLM theme-extraction pipeline that runs after each pulse submission window closes.
- **`pulse_check_aggregates`** — deferred. May be introduced later if live query performance on `pulse_themes` proves insufficient.
- **`cycle_config` extensions** — new fields for: pod-health band thresholds (healthy/warning/critical headcount cutoffs), the consecutive-miss threshold for the at-risk nudge, and the default time window for pulse aggregations (e.g. last four weeks vs full cycle). Global defaults applied when a cycle hasn't set its own values.

All other data — pod metadata, poderator assignments, pod memberships, pulse checks, pod-resource URLs, cycle and phase windows — is sourced from existing tables. No modification to existing core schemas is proposed.

## 10. Decisions log

This section records the decisions made during PRD review. Each decision supersedes the corresponding open question from the prior draft.

| Topic | Decision |
|---|---|
| Pod-health indicator bands | Absolute-headcount thresholds (not percentages). Single-week headline figure with a three-week trend arrow alongside. Configurable per cycle in cycle-config; global defaults apply when not overridden. |
| Nudges in v1 | One type only: **at-risk member** (configured consecutive-miss threshold, default 2). System flags, poderator follows up; no automated outreach. Configurable per cycle. |
| Nudge delivery | Dashboard-only for v1. Backend logic decoupled from delivery channel so a weekly digest email or per-event push can be added later without rewriting. |
| Multi-pod poderator assignment | First-class case. Switcher offers "All pods" overview view + per-pod views. Cross-pod aggregation applies only to nudges; rosters, phase guidance, and resources stay per-pod. |
| View persistence | The poderator's most recent switcher selection persists across sessions. First-time multi-pod poderators default to All pods; first-time single-pod poderators default to their pod's view. |
| Profile visibility tiering | Four tiers: always in row (AI experience + availability), on expansion/hover (role, industry, employer, interest areas, work style, group strengths, labs goals), click-through to profile (AI tools, cycle-fit signal, city-level location), never visible (phone, free-text notes, contact-consent flags). Registration form copy must disclose poderator visibility. |
| First-poderator onboarding | No in-product walkthrough. Programmatic orientation via poderator handbook + kickoff session (program-team-owned). In-product tooltips cover UI mechanics, auto-suppressing after first 1–2 encounters per element. |
| Inactive members | Hidden from roster by default. "Show inactive" toggle reveals them at reduced opacity, sorted to the bottom, each with their inactive-since date. |
| Pulse-check aggregations | Three scopes: individual (in the pulse response side panel), pod-level (in the per-pod dashboard), and cross-pod (in the All pods view, single-pod poderators excluded). Structured fields aggregate by counts; free-text fields are reduced to themes by an LLM pass with provenance back to source responses. Default range last 4 weeks, full-cycle toggle available. Ships with the dashboard in a single phase. |
| Route structure | Routes use `/moderator` (All pods) and `/moderator/pods/[id]` (per-pod), not the `/pods/[id]/moderator` pattern in the original PRD draft. All poderator routes live under `app/(dashboard)/moderator/`. |
| Admin ui-state | Admins receive `moderator_ui_state` rows like poderators. Filter/sort/tooltip state persists for admins too. |

## 11. Operational note: auto-flip

The cycle-inactivity auto-flip (member → `inactive` after two consecutive missed pulses) is **disabled for the current cycle**. This is set elsewhere in cycle-config and is not changed by this dashboard. Confirm before relying on the auto-flip in any downstream logic or messaging. A separate breadcrumb in the cycle-config notes or the architecture brief is recommended to keep this decision discoverable.

## 12. References

- [`personas.md` — Poderator](personas.md#poderator)
- [`OLOS-architecture-brief.md`](OLOS-architecture-brief.md), §Roles and §Phase machine
- [`OLOS-roadmap.md`](OLOS-roadmap.md), §1.13, §1.14, §2.7, §3.5, §3.6
- [`TUL_MVP_Spec.md`](../TUL_MVP_Spec.md), §Roles, §Pulse Checks, §Pod Registration
- [`lib/auth/CLAUDE.md`](../lib/auth/CLAUDE.md), session model and role resolution
