# 05 · Trajectory

*What must land before the next cohort opens vs. what can run during the cycle.*

## The timeline

```
            BEFORE NEXT CYCLE  (blocking)         │   DURING THE CYCLE
─────────────────────────────────────────────────┼───────────────────────────
 Safety        ████████████                       │
  • cron: report-only + preview + grace + sandbox │
  • #122  #123  #121  #37  + cron re-enable        │
 Foundation       ████████                         │
  • promotion gate + CI + auto-migrate (#72 #76 #77 #78)
    (the dev/prod split already exists)            │
  • migration ready       (#42 → #43)              │
 Audit trail         ████   (#115, before #117)    │
                                                   │
 Steward tools           ░░░░████████──────────────┼──►  (#117)
 Pulse visibility                                  │   ████████  (#51 #87 #86 #97 #38)
 Polish & docs                                     │   ░░░████   (#120 #106 #105 #119 #65 #62 #99)
                          └ next cycle start ┘
```

## How to read it

- **Left of the line = must be done before we open the cohort.** Two themes are the blockers:
  - **Safety** — re-enable the cron without repeating May, plus the late-join grace and the test
    sandbox (the D-1…D-3 decisions).
  - **Foundation** — the dev/prod environments already exist (separate DBs, Vercel deployments, and
    domains); what's missing is the governance on top: CI checks on PRs, an enforced promotion gate
    for dev→main, and auto-applied migrations, so a mid-cycle fix can't reach prod unchecked.
- **Audit columns (#115)** land just before the stewardship tools (#117), so every manual fix an
  admin makes is traceable from day one.
- **Right of the line = improves the experience while the cycle runs** — moderator pulse visibility
  and UX/doc polish. None of it is blocking.

## The one process ask

**Assign an owner (a single accountable person) to every P0/P1 issue today.** They're currently
unowned, and unowned high-priority work is precisely how the May cron sat broken. This costs nothing
and de-risks everything above.

## Suggested 15-minute meeting flow

1. **Where we are / what we fixed** — [00](00-where-we-are.md) + [03](03-may-incident.md) *(2 min, build confidence)*.
2. **Walk the flow + lock-out diagram** — [01](01-cycle-journey.md) + [02](02-lockout-and-safeguards.md) *(4 min, shared mental model)*.
3. **Decision board** — make D-1…D-3, discuss D-4/D-5 — [04](04-decision-board.md) *(7 min)*.
4. **Trajectory** — confirm the "before next cycle" line and **assign an owner to each P0/P1** *(2 min)*.
