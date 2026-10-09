# Ambassador launch banner and two-reviewer applications

| | |
|---|---|
| **Date** | 2026-10-09 |
| **Ran by** | Claude Code (https://claude.ai/code/session_01D61Awe6Ks4HZ21dAZ8LE7F) |
| **Branch / PR** | `claude/gifted-hypatia-bj5i6u` (stacked on `brendan-cld/charming-einstein-0tsaej`) · PR not opened yet |
| **Asked** | "Create an announcement banner for announcing the launch of the ambassador program in the center of the dashboard", with the application "positioned as an application where two people will review the quiz results, agreement and pair their application with information about them stored in their OLOS records." |

Built on top of the branch that moved the Ambassador role into OLOS (`00104`,
[`2026-10-09-ambassador-role-into-olos.md`](2026-10-09-ambassador-role-into-olos.md)); it
merges after that one.

## What was done

- **Schema**: `supabase/migrations/00105_ambassador_reviews.sql` adds `ambassador_reviews`
  (one row per reviewer per round, admin-only RLS). `SCHEMA.md` updated.
- **Review rules**: `lib/ambassador/review.ts` is pure and tested.
  - Two approvals approve; two declines decline; a split goes to an admin.
  - Nobody reviews their own application or one they referred.
  - The other review stays hidden until you've recorded yours.
- **Server**: `lib/ambassador/data.ts` gains `reviewsFor`, `recordReview`,
  `supersedeReviews`, `settleApplication`, and a reviewer-aware `coordinatorQueueCount`.
- **Decision route**: `app/api/ambassadors/applications/[id]` has a `review` action.
  - `approve` now only reinstates someone who stepped back.
  - `decline` is gone.
  - `reopen` starts a new review round.
- **Apply route**: `app/api/ambassadors/application` makes every submission `pending`. A
  pre-approved invite is recorded as its inviter's approval.
- **Review page**: `/ambassador/coordinator/[id]` shows the application beside the applicant's OLOS
  record (`lib/ambassador/record.ts`): profile, Lab, roles, cycles, pods, projects, event RSVPs and
  agreements. Learning Log content is left out. The queue at `/ambassador/coordinator` shows
  "n of 2 reviews" and "Waiting for you".
- **Banner**: `app/components/ambassador/launch-banner.tsx`, with its rules in
  `lib/ambassador/launch.ts` and its loader in `lib/ambassador/banner.ts`. It sits at the top of
  `centerColumn()` in `app/(dashboard)/dashboard/page.tsx`, so it appears in every dashboard state.
  It has a launch version and an in-review version, each dismissed per member via `task_dismissals`.
- **Copy**: `ui.launch` was added. Wording that promised "in straight away" with an invite, or
  "your coordinator confirms you", was updated in `apply.json`, `invite.json`, `ui.json`, the
  apply flow and the ambassador home.

## What was verified

- `npx tsc --noEmit` is clean.
- `npx eslint` on every touched area is clean.
- `npm test`: 75 files and 684 tests pass. That includes `lib/ambassador/review.test.ts` and
  `lib/ambassador/launch.test.ts`.
- `npm run check:migrations` passes.
- Ran the full chain `00001`→`00105` on a scratch Postgres 16 (Supabase schemas stubbed).
  - `00105` re-runs cleanly.
  - A second counting review by the same reviewer hits the unique index.
  - After a reopen (`superseded_at`) the same reviewer can review again.
  - A bad decision fails the CHECK.
  - Deleting a reviewer keeps the row with `reviewer_id` NULL.
  - Deleting the application cascades to its reviews.
- `npm run build` passes. `/ambassador/coordinator/[id]` appears in the route table.
- The banner markup was rendered with the built CSS at 1440px and 390px. Both versions were
  checked, with no horizontal scroll at either width.
- Not run end to end against Supabase. The API routes and pages weren't exercised with a real
  session, because there's no Supabase project in this environment.

## Decisions made → where they live

| Decision | Recorded in |
|---|---|
| Two reviewers; a split goes to an admin; an invite counts as one approval | `docs/ambassadors/CLAUDE.md` (decisions table); needs a vault note once `docs/vault/` lands |
| Reviewers see participation, not Learning Log content | `docs/ambassadors/CLAUDE.md`, `lib/ambassador/record.ts` header |
| Banner leads the center column, dismissible per version | `lib/ambassador/launch.ts` header |

## Open questions / needs from others

- **When it goes live.** The banner shows to everyone once this reaches production, and the
  program page is still awaiting board approval. Hold promotion, or set `ui.launch.until` to a
  past date.
- **The reviewer pool.** Today it's Lab leads of the applicant's Lab plus admins. Should it be
  narrower?
- **Reapplying.** Should declined applicants be able to reapply on their own, and after how long?
- **Quiz answers.** The quiz keeps only its score, so reviewers can't see individual answers.
  Storing them would need a column and a decision on whether reviewers should see them.

## Next

- Merge `brendan-cld/charming-einstein-0tsaej` first, then open this branch's PR into `dev`.
- A maintainer applies `00104` and `00105` to dev, then walks through the full path with three
  accounts: an applicant, two reviewers, and an admin for a split.
