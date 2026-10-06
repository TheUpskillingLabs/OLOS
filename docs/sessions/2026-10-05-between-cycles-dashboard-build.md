# The between-cycles dashboard build (lane M-core)

| | |
|---|---|
| **Date** | 2026-10-05 |
| **Ran by** | Claude Code session for the maintainers (https://claude.ai/code/session_016wuEPmUQtKEWY7fEfvU5Tr) |
| **Branch / PR** | `feat/between-cycles-dashboard` · #486 (also merged this session: #483, #484, #485) |
| **Asked** | "Move forward so we can align the platform and build out the architecture to bring people in without confusing them. Next week we're at several public events — the public side has to look right, and people need materials to view when they log in, even though we won't be in an active cycle." |

## What was done

- **Merged:**
  - #484, the Poderator cadence join-date floor (closes #463);
  - #485, the build spec and the Sprint 1 re-baseline;
  - #483, the public copy hot fix (merged earlier in the session).
- **Built #412 and #413 on `feat/between-cycles-dashboard`, in the spec's §8 order:**
  1. **The core:** `deriveBetweenCycles`, the readiness and open-now keys, and the `Task`
     readiness fields.
  2. **Copy:** `TASK_COPY.prepare` and `openNow` (placeholders marked `copy: K8 #457`), plus
     the shared copy lint in `lib/tasks/copy-lint.ts`.
  3. **Assembly:**
     - `buildReadinessRows`, with visibility rules, verified versus self-attested rows,
       reversible skips, and done rows first;
     - `buildOpenNowRows`, which is never empty;
     - optional assembler inputs, the lab-less Register suppression, one Slack step, the
       between-cycles reads in `tasks.ts`, and the admin preview on the shared rule.
  4. **UI:**
     - `OpenNowList` and `ReadinessLadderCard`;
     - the pre-registered card shows readiness;
     - the page layout leads with the lists, with the announcement on phones, the reserved
       `#dash-tminus`, and the overlap card;
     - `/api/tasks/dismiss` refuses writes during admin simulation.
  5. **GitHub username:** the field on `/profile/edit`, with validation and normalization.
- **Paper trail:**
  - #487: a *Decision needed* issue for the six departures from brief §7.M;
  - #481: ops log follow-ups (publish the onboarding resources and post the pinned
    announcement before the events);
  - `app/components/tasks/CLAUDE.md`: the new surface names.

## What was verified

- `npm run lint`: 0 errors, the 8 existing warnings.
- `npm run test`: 687 passing, about 45 of them new across `lib/tasks` and `lib/validations`.
- `npx tsc --noEmit` and `npm run build`: clean.
- **Not verified visually.** This session's network policy blocks the Vercel preview and no
  local Supabase is configured, so phone and desktop screenshots come from a reviewer on the
  preview (the PR's manual-testing steps).

## Decisions made → where they live

| Decision | Recorded in |
|---|---|
| Six departures from brief §7.M (GitHub username pulled forward; social proof and `viewerRegistration` deferred to #414; the `#dash-tminus` slot; rows 2/3/7 hidden with no cycle; the announcement placement) | #487; spec §9 |
| "Still open" is a vertical list, not the Up-next strip | `app/components/tasks/CLAUDE.md`; #487 |

## Open questions / needs from others

- **Success team:**
  - the readiness copy from the knowledge repo (K8 #457);
  - publish `onboarding-welcome` and `onboarding-ai-assistant` (and later
    `onboarding-olos`, `onboarding-slack`, `onboarding-github`);
  - post the pinned announcement (#481).
- **A reviewer** checks the preview with a test member in each state (the PR's steps) and adds
  screenshots.
- **Public pages before next week's events:** see the PR comment and #481. The Library
  detail CTA (#473) and the `/events` mobile email button (#474) sit with the volunteer.

## Next

- Review and merge #486, then the follow-on M-2: `?from=signup` ledes, key dates and `.ics`
  from `cycle_events`, the `/local-labs?reason=cycle` band coordinated on #414, and social
  proof once #414 lands.

## Addendum, 2026-10-06: "What's next" and the waitlist

- **Brought in #488** (the public "what's next" message) with a merge commit, because #488
  awaits review. When it lands in `dev`, the identical changes merge cleanly, so #486's diff
  shrinks back to its own work.
- **Added `WhatsNextCard`** (`#whats-next`), which leads the column in S0. It shows the
  internal cycle invitation via Slack, "workshops and meetups keep running", and the Jan 12
  kickoff. Its copy is `lib/cycles/whats-next.ts`, verbatim.
- **Added `WaitlistButton`:** one tap PATCHes the member's own `role_intents` with `'cycle'`
  added (`lib/participants/role-intents.ts`, tested against `participantsUpdateSchema`). It is
  optimistic, with an undo, and rolls back with a message if the save fails.
- **Layout changes:**
  - the S0 empty-state note now shows only to members the card doesn't reach;
  - the Get-ready heading names the kickoff: "Get ready for January 12" (`kickoffLabel`).
- **Docs:** spec §2 (S0 row) and §4, the wireframe note, `app/components/tasks/CLAUDE.md`
  naming, and the CHANGELOG line.
- **Verified:** `npm run test` (699 passing), `tsc`, lint (0 errors), and `npm run build`.
  Not verified visually, for the same reason as above.
