# 04 · Decision board

*The choices to make as a team. Options + our recommended lean; the team ratifies.*

| # | Decision | Options | Recommended | Why it matters |
|---|---|---|---|---|
| **D-1** | **Turn the cron back on — how?** | (a) report-only → admin preview → soak → enforce  ·  (b) re-enable as-is after a staging soak  ·  (c) leave it off, nudge manually | **(a)** | This is the exact surface that failed in May. A human gate before it acts is cheap insurance. |
| **D-2** | **Late join after pod registration closes** (#123) | (a) a configurable **grace window**  ·  (b) moderators add people to their own pod  ·  (c) admin-only + a written runbook | **(a)** | Decides whether slow-but-engaged people get locked out at the pod-registration deadline. |
| **D-3** | **Safe testing of pulses** (#122) | (a) an `is_test` flag + a **hidden sandbox pod**  ·  (b) role-based exemption only  ·  (c) a literal hidden pod inside the live cycle | **(a)** | Lets developers and admins exercise real flows without skewing live data or risking real revocations. |
| **D-4** | **Warning email copy / tone** (#37) | (a) firm — "access revoked, refill to regain"  ·  (b) soft — "refill anytime, no penalty" | *team call* | Balances being clear vs. discouraging people. Affects every participant who ever gets warned. |
| **D-5** | **Multi-pod → multiple pulses?** (#97) | (a) one pulse per person  ·  (b) one pulse per pod | *team call* | Affects the shape of pulse data and the "missed 2 pulses in a row" trigger. |

## Already leaning / ratify-to-confirm

D-1, D-2, and D-3 each have a clear recommended path (option **a**). The team's job is to **ratify or
override** — these are the calls that shape the pre-cycle build work, so confirming them unblocks
everyone.

## Lower-stakes / can defer

- **Calendar invites on registration** (#119) — convenience; build now or backlog.
- **Permissions documentation** (#62) — staff reference; document as-is or redesign.
- **Grace overlapping Solution-Proposal open** — a flow edge to *flag* (don't let the late-join grace
  run so long that people land in a pod after proposals start). Worth a sentence of guidance, not a
  blocker.

## What each decision unblocks

- **D-1** → the cron re-enablement runbook (report-only mode, admin preview, soak, then enforce).
- **D-2** → a small config change so registration *and* the cron honor a grace buffer.
- **D-3** → a one-migration `is_test` flag + a seeded sandbox the dashboards and crons ignore.

> Next: [05-trajectory.md](05-trajectory.md) — when this work lands relative to the next cycle.
