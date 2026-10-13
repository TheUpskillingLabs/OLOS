# Ambassador application: first screen without the film, as a structured overview

| | |
|---|---|
| **Date** | 2026-10-12 |
| **Ran by** | Claude Code (https://claude.ai/code/session_01D61Awe6Ks4HZ21dAZ8LE7F) |
| **Branch / PR** | `claude/gifted-hypatia-bj5i6u` · PR into `dev` |
| **Asked** | Make the missing orientation video "less obvious that there is missing information", and turn "that giant text box" into something "more structured in what the ambassador program involves, how it will benefit the ambassador and where we hope to take it." |

## What was done

- **The photo:** `/ambassador/apply`'s first screen no longer shows "[PLACEHOLDER] The orientation
  film goes here." While `video.src` is empty, it shows the community photo in the video's 16:9 frame,
  with a caption, and switches to the "Before you apply." heading and the "Overview" step label.
  Setting `video.src` brings the film back.
- **The steps:** the ten-paragraph "The short version" is replaced by numbered steps
  (`app/components/ambassador/apply-overview.tsx`):
  1. What you'll do;
  2. What you get;
  3. Where it's going;
  4. The Labs in brief, grouped into Who we are, Build Cycles, What you learn and Your account.

  Step 4 keeps every fact the ten quiz questions ask about. Each topic has a `more` slot for
  the fuller pieces planned later; it renders nothing until it has an `href`.
- **Copy:** `lib/ambassador/content/apply.json` → `video`. Steps 2 and 3 are new copy, drafted
  here and approved by the program owner on 2026-10-13 (`draft: false`). Steps 1 and 4 reuse
  existing wording from `program.json` and the old short version.
- **Styles** in `ambassador.css` (`.amb-photo`, `.amb-overview`, `.amb-topics`), the dashboard
  nudge copy in `ui.json`, comments in the apply page and validation, and
  `docs/ambassadors/CLAUDE.md` ("Where the words live").

## What was verified

- `npx tsc --noEmit` and `npx eslint` on the touched areas are clean.
- The `lib/ambassador` tests pass, including new ones:
  - every step and topic has points;
  - each `more` slot is either empty or complete;
  - no on-screen string says "placeholder", "coming soon" or "film", or uses the banned UI words.
- `npm run build` passes.
- The screen, server-rendered with the built CSS, was checked at 1440px and 390px: no horizontal
  scroll, and no missing-content wording.
- Each of the ten quiz answers was checked against step 4.

## Decisions made → where they live

| Decision | Recorded in |
|---|---|
| Photo, not a "coming soon" card, until the film exists | `apply.json` `video.$comment`, `docs/ambassadors/CLAUDE.md` |
| Overview as numbered steps; quiz facts in their own final step; future topic pieces as hidden `more` slots | same |

## Open questions / needs from others

- The film, when it exists: set `video.src`, `poster` and `captions`.
- The fuller topic pieces: when each exists, set its topic's `more` to `{ "label", "href" }`.

## Next

- Merge the PR into `dev`, check the preview, then promote with the next `dev → main`.
