# OLOS — Core-Team Decision Materials

Succinct, diagram-forward briefs that explain **where OLOS is**, **how the cycle flow works**,
**where people can get locked out**, and **the decisions the team needs to make** before opening
the next cohort.

These exist so non-technical and technical team members share one mental model and can decide
together — fast.

## Contents

| Doc | What it answers |
|---|---|
| [00-where-we-are.md](00-where-we-are.md) | What's built, what's safe, what's risky (one screen) |
| [01-cycle-journey.md](01-cycle-journey.md) | How an Upskiller moves ideation → pods → projects, and where lock-out can happen |
| [02-lockout-and-safeguards.md](02-lockout-and-safeguards.md) | How someone becomes "inactive," and the safeguards on that path |
| [03-may-incident.md](03-may-incident.md) | What broke in May and what's different now |
| [04-decision-board.md](04-decision-board.md) | The choices to make as a team (D-1…D-5) |
| [05-trajectory.md](05-trajectory.md) | What must land before the next cycle vs. during it |
| [one-page-brief.md](one-page-brief.md) | All of the above on one front/back page → builds to `one-page-brief.pdf` |

## How to use these

- **In a meeting:** open the docs in order, or hand out `one-page-brief.pdf`. Suggested 15-min
  run-of-show is at the bottom of [05-trajectory.md](05-trajectory.md).
- **Diagrams:** the numbered docs use Mermaid (renders automatically in GitHub and VS Code).
  The one-page brief uses plain-text diagrams so it converts cleanly to PDF.

## Rebuild the PDF

```sh
pandoc docs/comms/one-page-brief.md -o docs/comms/one-page-brief.pdf \
  --pdf-engine=xelatex -V geometry:margin=0.6in -V fontsize=9pt
```

## Refresh each cycle

These are living docs. After each cycle (or when the cron/flow changes), update:
- **00** — the traffic-light states and open-issue count.
- **04** — move resolved decisions to "ratified," add new ones.
- **05** — re-draw the before/during-cycle line for the upcoming cohort.

Source of truth for the underlying detail: [../OLOS-roadmap.md](../OLOS-roadmap.md) (esp. §3.7) and
[../architecture-review-onboarding-state-machine.md](../architecture-review-onboarding-state-machine.md).
