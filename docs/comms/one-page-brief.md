---
title: "OLOS — Pre-Cycle Decision Brief"
subtitle: "Where we are, how the flow works, and what to decide before the next cohort"
date: "2026-06-17"
header-includes: |
  \setlength{\parskip}{3pt}
  \setlength{\parindent}{0pt}
  \renewcommand{\baselinestretch}{0.96}
  \AtBeginDocument{\small}
---

## 1 · Where we are

OLOS shipped **mid-cycle**. The hard onboarding bugs from the May launch are **fixed in code**
(issue #110). The one safety-critical piece that caused the May cascade — the job that marks
disengaged people "inactive" — is **turned off**, and must come back on *safely* before the next
cohort opens.

| Area | State | The read |
|:------------------------------|:------|:----------------------------------------------|
| Sign-in, pulse checks, pod & project registration | Live | Core participant flow is solid |
| Onboarding state machine (reconciler + admin UI) | Merged | May root cause addressed in code |
| **Revocation cron** (auto-marks inactive) | **OFF** | Rewritten, never validated live, no human-review step |
| Late-join after pod registration closes | Gap | Engaged-but-slow people can get locked out |
| Test isolation (safe place to exercise flows) | Gap | Testing risks polluting / revoking real data |
| dev/prod split + automated checks (CI) | None | Every change still ships straight to live |

**27 open issues**, almost all funneling through two gates: **#110** (onboarding/cron) and **#72**
(dev/prod split). **Most P0/P1 issues have no owner** — the top process risk.

## 2 · The cycle journey (where lock-out happens)

```
Join -> 1 Problem -> 2 Vote -> 3 Pick Pod(s) -> [pod hits min?] -> Pod ACTIVE (you become "active")
     -> 4 Propose -> 5 Vote -> 6 Projects finalized -> 7 Pick ONE project -> Build / Showcase

  RISK: you never join a pod   OR   your pod never fills   =>   stuck: never becomes "active"
```

You are only **"active"** once you're in a pod that reached its minimum size. The two ways to fall
out are exactly what the automated job acts on.

## 3 · How someone becomes "inactive" (and the safeguards)

```
ACTIVE --(no active pod after pod-reg close + GRACE)--> WARNING email
ACTIVE --(2 pulse checks missed in a row)-----------> WARNING email
WARNING --> 3-day grace --> joins pod / submits pulse --> ACTIVE
                       \--> still failing -----------> INACTIVE (read-only, reversible)
INACTIVE --(admin reactivate  OR  re-register / pulse)--> ACTIVE
```

Safeguards: a **grace window** before "no pod" counts (slow != disengaged) · **warning + 3-day
grace** before anyone goes inactive (built) · **report-only mode + admin preview** so an admin sees
who *would* be affected before the system acts · **admins/owners exempt** and a **test cycle
excluded entirely** · **always reversible**.

## 4 · What broke in May, and what's different now

| The May job did this | The rewritten job does this |
|:----------------------------------------|:-------------------------------------------------|
| Counted pod membership across all cycles | Looks at only the current cycle |
| Judged from the wrong start date | Baseline = later of activation or pod-reg open |
| Acted immediately, silently | Warning email -> 3-day grace -> only then acts |
| No safe way to test | A test cycle is excluded entirely (sandbox) |
| Ran live with no preview | Report-only mode + admin preview *(proposed, D-1)* |

> **Promise we can make the cohort:** no one is marked inactive without a warning, a grace period,
> and a human review — and it is always reversible.

## 5 · Decision board

Options + our recommended lean. The team **ratifies or overrides** — D-1…D-3 shape the pre-cycle
build, so confirming them unblocks everyone.

| # | Decision | Options | Lean | Why it matters |
|:--|:------------------------|:-----------------------------------|:----|:----------------------------|
| D-1 | Re-enable the cron — how? | (a) report-only -> preview -> soak -> enforce; (b) re-enable as-is after soak; (c) leave off, nudge by hand | **a** | The exact May failure surface; a human gate is cheap insurance |
| D-2 | Late join after pod-reg closes (#123) | (a) configurable grace window; (b) moderators add to own pod; (c) admin-only + runbook | **a** | Decides whether slow-but-engaged people get locked out |
| D-3 | Safe testing of pulses (#122) | (a) is\_test flag + hidden sandbox pod; (b) role-based exemption only; (c) literal hidden pod in live cycle | **a** | Exercise real flows without skewing live data |
| D-4 | Warning email tone (#37) | (a) firm "revoked, refill to regain"; (b) soft "refill anytime, no penalty" | team | Clarity vs. discouraging people; hits everyone warned |
| D-5 | Multi-pod -> multiple pulses? (#97) | (a) one pulse per person; (b) one per pod | team | Shapes pulse data + the "missed 2" trigger |

*Lower-stakes / can defer:* calendar invites (#119), permissions doc (#62), and a guidance note so
the late-join grace doesn't run past Solution-Proposal open.

## 6 · Trajectory — what must land before the next cohort

```
              BEFORE NEXT CYCLE (blocking)        |   DURING THE CYCLE
  Safety        ############                      |
   - cron: report-only + preview + grace + sandbox|     (#122 #123 #121 #37 + re-enable)
  Foundation       ########                       |
   - dev/prod split + CI; migration ready         |     (#72 #76 #77 #78; #42 -> #43)
  Audit trail         ####  (#115, before #117)   |
  Steward tools          .....########------------|-->  (#117)
  Pulse visibility                                |   ########   (#51 #87 #86 #97 #38)
  Polish & docs                                   |   ...#####   (#120 #106 #105 #119 #65 #62 #99)
                          [ next cycle start ]
```

**Left of the line = must ship before we open the cohort** (Safety + Foundation). **Right = improves
the experience while the cycle runs** — none of it blocking.

**The one process ask:** assign a single accountable owner to every P0/P1 issue today. They're
currently unowned, and unowned high-priority work is how the May cron sat broken.

---

*Meeting flow (15 min): §1+§4 where we are / what we fixed (2m) · §2+§3 walk the flow (4m) ·
§5 make D-1…D-3, discuss D-4/D-5 (7m) · §6 confirm the line + assign owners (2m).*
