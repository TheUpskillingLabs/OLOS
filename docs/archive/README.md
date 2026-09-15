# `docs/archive/` — session artifacts and superseded plans

| | |
|---|---|
| **Status** | Canonical policy for this folder |
| **Owner** | Docs owner |
| **Last verified** | 2026-09-15 |

Files here were produced during one work session — a diff summary, a verification
report, a launch plan, an issue draft, a test log — and were accurate on their date.
They are kept because they explain *how* something was built or fixed, and moved here
so nobody mistakes them for current guidance. **Nothing in this folder is edited;**
its relative links are not checked by `docs-check`.

| File | Date | What it was |
|---|---|---|
| `branch-vs-main-2026-05-08.md` | 2026-05-08 | diff summary for the magic-link branch (PR #60) |
| `issue-44-verification-2026-05-08.md` | 2026-05-08 | verification report for Google OAuth (#44) |
| `launch-plan-2026-05-31.md` | 2026-05-31 | the Energy Cycle 3 hot-fix launch plan (PRs #108–#110) |
| `consolidated-issue-draft-onboarding-state-machine.md` | 2026-05-31 | the draft that became issue #110 |
| `PR-feedback-widget.md` | 2026-06 | PR description for the feedback widget (`00029`) |
| `dev-report-cycle-process.md` | 2026-07-09 | cycle-process verification report; introduced `verify:cycle` and `seed:test-cycle` |
| `testing-feedback-2026-07-11.md` | 2026-07-11 | stub; folded into `../feedback-running-list.md` |
| `hackathon-luma-about.md` | 2026-07-31 | Luma "About" copy paste-source after the bespoke route was retired |
| `pr-313-findings.md`, `pr-313-full-test-runbook.md` | 2026-08-01 | test log + runbook for the registered-status PR (#313/#348) |

**When to add a file here:** a doc in `docs/` describes a plan the build has moved past
and nobody cites it for current behavior; or a session report has served its purpose.
Move with `git mv`, fix inbound links, add a row above, and update
[`../README.md`](../README.md).
