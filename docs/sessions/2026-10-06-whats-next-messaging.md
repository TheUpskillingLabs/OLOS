# What's next: the "new kind of Build Cycle" message on every surface

| | |
|---|---|
| **Date** | 2026-10-06 |
| **Ran by** | dev@ (+ Claude Code, https://claude.ai/code/session_016wuEPmUQtKEWY7fEfvU5Tr) |
| **Branch / PR** | `fix/whats-next-messaging` · PR into `dev` (this report's PR) |
| **Asked** | Align the platform with the board advisor's and AMG's message (an internal cycle Oct 13 – Dec 8 as an invitation; public workshops keep running; the first public cycle of 2027 kicks off January 12), so visitors at the week-of-Oct-12 events see the right thing. |

## What was done

- **One source for the copy:** `lib/cycles/whats-next.ts` (pure; tested in
  `whats-next.test.ts`) and `lib/cycles/whats-next-data.ts` (reads the HQ org cycle's dates
  and any upcoming open HQ cycle's start date). It replaces `lib/cycles/next-public-cycle.ts`
  (#483), which is deleted.
  - The kickoff date is one interim constant, `NEXT_PUBLIC_CYCLE_KICKOFF = "2027-01-12"`. An
    `upcoming` open cycle row overrides it, and after its day it falls back to "is being
    planned".
  - The internal cycle's dates come from its org cycle row. The invitation shows while that
    row exists, or, before ops creates it, until the kickoff date.
  - The Slack link is `NEXT_PUBLIC_INTERNAL_CYCLE_JOIN_URL`, then the Slack invite.
- **The homepage banner** (`app/page.tsx`) shows the message whenever no cycle is taking
  registrations: the chip, heading, invitation, not-changing line, and next-public line.
  Its buttons:
  - "See workshops and events" (the primary button);
  - the internal-cycle Slack link.
- **`/build-cycles`:** the "What's next" section uses the same three paragraphs, and the
  header and closing buttons are "See workshops and events".
- **Other surfaces:**
  - **the `/events` footnote:** the next-public line;
  - **the local lab stat:** "Jan 12, 2027 · next public Build Cycle";
  - **the sign-up card:** "Build Cycles" with the next-public line;
  - **the welcome email:** the kickoff, plus the workshops line;
  - **the dashboard's no-cycle state:** the next-public line and the workshops line.
- **Docs:**
  - `docs/requirements/cycle-4-readiness.md` §1 (the update), §4 and §9 (decision row);
  - `docs/roadmap/pre-registration-persona.md` §10 (the update, the sign-up stage, measure 8:
    the waitlist);
  - the `AGENTS.md` rule wording;
  - `CHANGELOG.md`.

## What was verified

- `npm run lint` (0 errors; 8 warnings, all pre-existing), `npm run test` (all pass,
  including 14 new `whats-next` tests), `npx tsc --noEmit`, `npm run build`, `npm run check:docs`.
- `grep -rn "NEXT_PUBLIC_CYCLE_YEAR\|next-public-cycle" app lib` returns only the provenance
  comment in `whats-next.ts`.
- **Not verified here:** the Vercel preview, because this environment's network policy
  blocks it. A reviewer walks the pages listed in the PR.

## Decisions made → where they live

| Decision | Recorded in |
|---|---|
| Name the internal cycle publicly, with its dates, as an invitation; join through Slack | `docs/requirements/cycle-4-readiness.md` §9 (2026-10-06), #480 |
| No waitlist for now (2026-10-09): workshops and events are the primary action | same |
| The first public cycle of 2027 kicks off January 12; one interim constant, overridden by data | same; `lib/cycles/whats-next.ts` header |

## Open questions / needs from others

- **Ops (#481):**
  - create the org cycle with **Oct 13 – Dec 8**;
  - set `NEXT_PUBLIC_INTERNAL_CYCLE_JOIN_URL` to the Slack thread;
  - pin AMG's message;
- **The volunteer (#414)** owns these files long-term; this is the owner-approved hot-fix
  pattern, as with #483.

## Next

- Rebase PR #486 on `dev` and add the dashboard's "What's next" card, replacing the no-cycle
  empty state.
