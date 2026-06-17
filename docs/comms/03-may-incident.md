# 03 · What broke in May, and what's different now

*The honest version, in plain terms.*

## What happened

When OLOS launched mid-cycle in May, a daily automated job meant to flag *disengaged* members
instead marked **~75% of the cohort "inactive."** People briefly lost write access. We turned the
job off the same day and restored access.

## Why it happened (three plain bullets)

- It counted pod membership across **all cycles**, not just the current one.
- It judged people from the **wrong start date**, so it decided they were inactive too early.
- It acted **immediately** — no warning email, no grace period.

## What's different now

| The May job did this | The rewritten job does this |
|---|---|
| Counted pod membership across **all cycles** | Looks at **only the current cycle** |
| Judged from the wrong start date | Baseline = the later of *activation* or *pod-registration open* |
| Acted immediately, silently | **Warning email → 3-day grace → only then acts** |
| No safe way to test | A **test cycle is excluded entirely** (sandbox, #122) |
| Ran live with no preview | **Report-only mode + an admin preview before it acts** *(proposed — D-1)* |

The first three are already in the merged code. The last two are the work we're deciding on now.

## The promise we can make the cohort

> **No one gets marked inactive without a warning, a grace period, and a human review — and it is
> always reversible.**

> Next: [04-decision-board.md](04-decision-board.md) — what we need to decide to keep that promise.
