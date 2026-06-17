# 00 · Where we are

*One screen. Read this first.*

OLOS shipped **mid-cycle** during the Energy & Climate cohort. The hard onboarding bugs from the
May launch are **fixed in code** (issue #110, Phases A/B/C merged). The one safety-critical piece
that caused the May cascade — the automated job that marks disengaged people "inactive" — is
**turned off**, and must be turned back on *safely* before the next cohort opens.

## Status at a glance

| Area | State | The read |
|---|---|---|
| Sign-in, profiles, pulse checks, pod & project registration | 🟢 Live & working | Core participant flow is solid |
| Onboarding state machine (the reconciler + admin self-service UI) | 🟢 Merged | May root cause is addressed in code |
| **Revocation cron** (auto-marks people inactive) | 🔴 **Off** | Rewritten, but never validated against live data and has no human-review step |
| Late-join after pod registration closes | 🟡 No path | Engaged-but-slow people can get stuck / locked out |
| Test isolation (a safe place to exercise flows) | 🟡 None | Testing risks polluting or revoking real data |
| dev/prod split + CI (auto-checks on changes) | 🔴 None | Every change still ships straight to the live cohort |

## The shape of the backlog

- **27 open issues.** Almost everything funnels through **two gates**:
  - **#110** — onboarding state machine + the revocation cron.
  - **#72** — splitting dev from prod with a promotion gate.
- **Most P0/P1 issues currently have no owner.** This is the single biggest *process* risk — unowned
  high-priority work is how the May cron sat broken.

## What this means for the meeting

We are in good shape on the *participant-facing* product. The work before the next cycle is almost
entirely **safety and foundation**: re-enable the cron without repeating May, give late joiners a
way in, create a safe place to test, and stop shipping straight to live.

> Next: [01-cycle-journey.md](01-cycle-journey.md) — how someone moves through a cycle, and where
> the lock-out risk lives.
