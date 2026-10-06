# Requirements — The between-cycles dashboard (lane M-core: #412 + #413)

| | |
|---|---|
| **Status** | Plan of record for the build on `feat/between-cycles-dashboard` (2026-10-03) |
| **Owner** | Lane M (single owner of `lib/tasks/**`, `app/(dashboard)/dashboard/**`, `app/components/tasks/**` while the lane is open) |
| **Last verified** | 2026-10-03 against `dev@2533ad6` |
| **Issues** | [#412](https://github.com/TheUpskillingLabs/OLOS/issues/412) (A1, the two lists) · [#413](https://github.com/TheUpskillingLabs/OLOS/issues/413) (A2, the readiness ladder) · copy [#457](https://github.com/TheUpskillingLabs/OLOS/issues/457) (K8) · ops follow-ups [#481](https://github.com/TheUpskillingLabs/OLOS/issues/481) |
| **Binding sources** | [`../roadmap/handoff-2026-09-28-onboarding-journeys.md`](../roadmap/handoff-2026-09-28-onboarding-journeys.md) §4 (rules), §6 (rulings), §7.M (the spec) · [`../roadmap/pre-registration-persona.md`](../roadmap/pre-registration-persona.md) §4, §8 (acceptance), **§10 (the long gap)** · [`cycle-4-readiness.md`](cycle-4-readiness.md) |

This document turns those sources into one build plan, adjusted for the decisions of
2026-10-03:
- Cycle 4 runs as an internal **org cycle**.
- The next **public** cycle opens in **2027**.

So the state most members will be in for months is **"no cycle announced"**, and that is
the state this build gets right first. Where this document and the brief disagree, this
document records why (§9).

## 1. Who sees what

`deriveBetweenCycles` is pure and lives in `lib/tasks/between-cycles.ts`. It is true when
**all** of these hold:
- the member is in an onboarding state (`no_cycle` or `no_enrollment`);
- they are **not** an assignment-only Poderator;
- they are **not** an active org-cycle member;
- **and** one of these: an upcoming open cycle exists, no active open cycle exists, or
  the active open cycle's `registrationWindow().state === 'closed'`.

`page.tsx` and `lib/tasks/preview.ts` both call it, so the admin preview cannot drift.

| State | Who | Center column (after the existing queue) |
|---|---|---|
| **S0 No cycle announced** (prod from Oct 13 until the 2027 row exists) | any member not in a cycle | the pinned announcement; **What's next** (the internal cycle invitation, the Jan 12 kickoff, the one-tap waitlist; added 2026-10-06, §4); **Still open**; **Get ready for January 12** (no cycle-dependent rows); no register card |
| **S1 Announced, not registered** | an upcoming open cycle exists | Still open; Get ready (all rows that apply); register card `open` |
| **S2 Pre-registered** | has an agreement on the upcoming cycle | Still open; Get ready (row 2 ✓); register card "{done} of {total} ready" |
| **S3 Active cycle, registration closed** | the active cycle is past its join windows, nothing upcoming | Still open; Get ready (as S0) |
| **S4 Lab-less or waitlisted** | `metro_id` null or the lab is not active | as S0/S1, but **no Register task**; rows 1–2 route to `/local-labs`; a waitlisted member sees row 1 ✓ "You're on the {city} list" |
| **Overlap** (§6.3) | engaged in the active cycle **and** pre-registered for the upcoming one | the engaged dashboard, plus the Get ready card |
| Org-cycle member, assignment-only Poderator | — | unchanged (workstreams / shepherd copy); never the ladder |

## 2. "Still open" (`open_now` surface, rendered by the existing `TaskList`)

The heading is "Still open". Each row is shown only if its source has something. The
list is never empty: the Library row is the fallback.

| Row | Source (read in `lib/tasks/tasks.ts`) | Links to |
|---|---|---|
| The next two public events in the next 30 days (workshops and anchor events) | `events`, published, not members-only, `start_at` within 30 days | `/events/{slug}`; "All workshops and events →" `/events` |
| See what {cycle} built (the most recent `closed`/`archived` open cycle) | `cycles` | `/cycles/{id}`. **Verify at build time** that a non-member can view a closed cycle's page; if not, link its projects in `/directory` and file the gap |
| Add an observation to the field survey | `field_surveys.status = 'open'` | `/survey/{share_slug}` |
| Read the newest member story | `spotlights` (published) | `/stories/{slug}` |
| Browse the Learning Library (fallback, and always last) | — | `/learning` |
| Projects looking for help | after A5 [#417](https://github.com/TheUpskillingLabs/OLOS/issues/417) | — |

Keys come from `openNowTaskKey(kind, id)`. Rows are not dismissible; they come and go
with their source. Copy is short, second person, and dated where there is a date.

## 3. "Get ready" (`prepare` surface, new `ReadinessLadderCard`)

The heading is "Get ready for {cycle}" in S1/S2, and "Get ready for the next Build
Cycle" in S0/S3.
- Done rows sort first. ✓ marks a verified row, ○ a self-attested one.
- Each row shows title · why · minutes.
- Self-attested rows offer "Not for me", and it can be undone.
- The progress line reads "{n} of {shown} ready". Rows that are not shown never count,
  and skipped rows do count.
- The legend reads "✓ we can see it's done · ○ your word is enough".
- **Nothing gates on it.**

| # | Row | Kind | Done when | Shown when |
|---|---|---|---|---|
| 1 | Join a Local Lab | ✓ | `metro_id` on an active lab, **or** a `metro_waitlist_signups` row (titled "You're on the {city} list") | always |
| 2 | Pre-register for {cycle} | ✓ | a `cycle_agreements` row for the upcoming cycle | an upcoming open cycle exists |
| 3 | Save the key dates | ○ | `prepare:dates:c{id}` | an upcoming cycle exists (until key dates come from `cycle_events` in M-2, the row links the cycle page) |
| 4 | Join Slack and say hello in #intros | ○ | `prepare:slack` | always (manual until Slack identity, #436) |
| 5 | Add your GitHub username | ✓ | `participants.github_username` | always (**the write path is pulled into M-core**, §9) |
| 6 | Set up an AI assistant you can use | ○ | `prepare:assistant` | a published `resources` row with slug `onboarding-ai-assistant` |
| 7 | Read the primer for {cycle} | ○ | `prepare:primer:c{id}` | an upcoming cycle **and** a resource `primer-{cycle.slug}` |
| 8 | Complete your directory card | ✓ | `headline` + `profile_image_url` + at least one `role_intents` | always |
| 9 | Watch the welcome videos | ○ | `prepare:videos` | a published resource `onboarding-welcome` |

**In S0 today** rows 1, 4, 5 and 8 show ("{n} of 4"). Rows 6 and 9 appear when the success
team publishes those resources (#481), giving the six rows of persona §10.2.

**Keys** come from `prepareTaskKey(step, cycleId?)`:
- account-scoped steps: `prepare:{step}` (slack, assistant, videos);
- cycle-scoped steps: `prepare:{step}:c{id}` (dates, primer);
- skips: `…:skip`.

All of them match the existing `TASK_KEY_PATTERN` and persist through the existing
`POST`/`DELETE /api/tasks/dismiss`. That route refuses writes while an admin is
simulating a member (§6.3).

**At kickoff** `setup:slack` reads `prepare:slack`, so Slack is never asked twice.

**Copy** comes verbatim from the knowledge repo's `program/curriculum/readiness-ladder.md`
(K8 #457 owns edits). Until it is wired in, `TASK_COPY.prepare` carries the persona
doc's §4.2 titles and why-lines, marked `// copy: K8 #457`. The PR does not merge with
placeholder copy unless the success team signs off.

## 4. The line of communication

- **The pinned announcement.** The existing `AnnouncementsPanel` is the channel the
  success team controls ("The next public Build Cycle opens in 2027…", #481). In S0–S4 it
  renders compact, limit 1, above "Still open" on **every** breakpoint, not only phones.
- **What's next (S0; replaces the no-cycle sentence, 2026-10-06).** The public site's
  message (`lib/cycles/whats-next.ts`, #488) as the first card after the phone
  announcement, `WhatsNextCard` at `#whats-next` (the homepage's signed-in "Join the 2027
  waitlist" lands here): the internal cycle (Oct 13 – Dec 8, from its org cycle row) as an
  invitation via Slack, "workshops and meetups keep running", and "the first public Build
  Cycle of 2027 kicks off January 12" with `WaitlistButton`. One tap PATCHes the member's
  own `role_intents` with `'cycle'` added (`lib/participants/role-intents.ts`), optimistic
  with an undo; once on, it reads "You're on the 2027 waitlist ✓" and the promise. Never
  dismissible. The empty-state note it replaces stays only for members the card doesn't
  reach. The Get-ready heading names the kickoff ("Get ready for January 12"). No dates
  are hard-coded in this lane: they come from `whats-next.ts`.
- **The hero lede** for between-cycles members points at the two lists ("Here's what's
  open now, and how to get ready").

## 5. Wireframe (phone first; desktop puts the same column between the existing rails)

```
┌──────────────────────────────────────┐
│ Welcome, Sam                          │  hero (existing)
│ Here's what's open now, and how to    │
│ get ready.                            │
├──────────────────────────────────────┤
│ FROM THE LABS                 pinned  │  AnnouncementsPanel, limit 1
│ The next public Build Cycle opens in  │
│ 2027. Until then…                     │
├──────────────────────────────────────┤
│ Up next                               │  existing queue (custom tasks etc.)
├──────────────────────────────────────┤
│ STILL OPEN                            │
│ → Prompting workshop · Thu Oct 15     │
│ → See what Summer 2026 built          │
│ → Read the newest member story        │
│ → Browse the Learning Library         │
├──────────────────────────────────────┤
│ GET READY FOR THE NEXT BUILD CYCLE    │
│ 2 of 4 ready                          │
│ ✓ Join a Local Lab            1 min   │
│ ✓ Complete your directory card 5 min  │
│ ○ Join Slack, say hello  10 min       │
│   why… · Not for me                   │
│ · Add your GitHub username   10 min   │
│   (turns ✓ once it's on your profile)│
│ ✓ we can see it's done · ○ your word  │
├──────────────────────────────────────┤
│ (S0: the "What's next" card leads the │  2026-10-06: moved to the top of
│ column instead: the internal cycle,   │  the lead; see §4
│ workshops, Jan 12 + the waitlist)     │
├──────────────────────────────────────┤
│ Journal (practice log) · feed         │  existing
└──────────────────────────────────────┘
```

In S1/S2 the card heading names the cycle, rows 2/3/7 appear, and the register card takes
the last slot ("{done} of {total} ready" once pre-registered). This sketch stands in for
the R4 wireframe for #412. The PR links it, and phone and desktop screenshots replace it
on review.

## 6. Files

| File | Change |
|---|---|
| `lib/tasks/between-cycles.ts` (new) + `.test.ts` | `deriveBetweenCycles` |
| `lib/tasks/types.ts` | `Task` gains `why?`, `minutes?`, `verified?`, `skippable?`, `skipped?`; `surface` adds `open_now`, `prepare`; `TaskKind` adds both |
| `lib/tasks/keys.ts` + test | `prepareTaskKey`, `openNowTaskKey` |
| `lib/tasks/definitions.ts` + new `definitions.test.ts` | `TASK_COPY.prepare`, `TASK_COPY.openNow`; the shared copy lint (word-bounded; "username" allowed) |
| `lib/tasks/assemble.ts` + test | `TaskInputs` gains `betweenCycles`, `labActive`, `waitlistCity`, ladder facts, open-now sources, available resource slugs; emits both surfaces; no Register task when `!labActive`; `setup:slack` reads `prepare:slack` |
| `lib/tasks/tasks.ts` | the reads in §2/§3, in the existing `Promise.all` |
| `lib/tasks/preview.ts` | uses `deriveBetweenCycles` |
| `app/components/tasks/readiness-ladder-card.tsx` (new), `index.ts` | the card (client; optimistic tick/skip like `task-list.tsx`) |
| `app/components/tasks/cycle-register-card.tsx` | pre-registered: "{done} of {total} ready", drops "We'll open your next steps here when it starts" |
| `app/(dashboard)/dashboard/page.tsx` | `labActive`, waitlist row, ladder facts; the S0–S4 layout; the overlap card; the announcement placement; reserved `div#dash-tminus` |
| `app/api/tasks/dismiss/route.ts` | refuse under admin simulation |
| `lib/validations/participants-update.ts`, `/profile/edit` form | `github_username` (GitHub's rule: 1–39 characters, alphanumeric or single hyphens, no leading or trailing hyphen). Help text: "Just the username. You'll be invited to the Labs' GitHub organization when your pod forms." |

**Not touched:** `lib/cycles/public*.ts`, `app/(public)/**`, `app/c/**` (the volunteer's,
#414) and `lib/moderator/**` (lane P). **No migration.**

## 7. Tests (`lib/**/*.test.ts`; nothing under `app/` is unit-tested)

- **`between-cycles.test.ts`:** S0–S4, overlap, org member, assignment-only Poderator,
  the active cycle with registration open (false), seeding an upcoming row (flips to S1).
- **`assemble.test.ts`:**
  - row visibility per state;
  - progress counts only shown rows;
  - "Not for me" counts and reverses;
  - verified rows flip on the fact;
  - no Register task for lab-less members;
  - a waitlisted member gets row 1 ✓;
  - `setup:slack` honours `prepare:slack`;
  - the open-now fallback row is always present.
- **`keys.test.ts`:** key grammar, skip keys, and `TASK_KEY_PATTERN` acceptance.
- **`definitions.test.ts`:** the copy lint (never course / class / student / lesson /
  module, "TUL", "user", "lead", "registrant"; no "stay tuned", no "soon").
- **Validation test** for `github_username`.

## 8. Commit plan and the board demo

**Commits on `feat/between-cycles-dashboard`**, each green on its own:
1. The pure core: types, keys, `between-cycles.ts`, tests.
2. Copy and the copy lint.
3. `assemble` and the data reads, plus the preview.
4. The UI: ladder card, register card, page layout, announcement placement, the dismiss
   guard.
5. The GitHub username field.
6. Docs: `CHANGELOG`, session report, screenshots in the PR, the vault note or
   *Decision needed* issue for §9, and the #481 follow-ups.

**Demo** (Vercel preview against dev data, test accounts only):
1. Signed out, `/`: the cycle banner states the 2027 line, and "Join The Labs" opens
   sign-up (#483).
2. Sign up a new test member. The dashboard shows the pinned announcement, "Still open"
   (workshops, Library) and "Get ready", 1–2 of 4.
3. Tick Slack and mark the AI assistant "Not for me"; reload on a phone and both persist.
   Add a GitHub username; row 5 flips ✓.
4. Admin seeds an `upcoming` open test cycle on **dev**. On the next page load the card
   names the cycle, rows 2/3 appear, and the register card shows. Pre-register; the card
   reads "{n} of {total} ready". Then move the test cycle back to `draft`.

## 9. Where this departs from the brief, and why

| Brief (§7.M) | Here | Why |
|---|---|---|
| The `github_username` write path is M-2 | pulled into M-core | without it row 5 can't be completed, and the demo would show a dead row |
| The floored "N in {lab} are getting ready too" line | deferred until #414 ships `social-proof.ts` | the 2026-10-02 hand-off forbids building the volunteer's helper; D4 floor = 5 when it lands |
| "Pre-registered" read through U's `viewerRegistration()` | the existing `cycle_agreements` read in `page.tsx` | same reason; swap in a follow-on when #414 lands |
| `div#dash-tminus` reserved slot (§7.M item 9) vs "M ships no slot" (§6.2) | reserved, empty, labelled | the 2026-10-02 hand-off (newer) asks for it; costs one element |
| Rows 2, 3, 7 always in the nine | hidden while no cycle is announced | persona §10.2 (2026-10-03): a step that can't be taken isn't shown |
| The announcement shows on phones only (2-item strip) | limit 1, every breakpoint, in S0–S4 | it is the line of communication for the long gap (§4) |

These are recorded in the PR's vault note, or in a *Decision needed* issue while #391 is
unmerged.

## 10. Acceptance

Persona §8 items 1–6, as restated in brief §7.M, plus:
- S0 renders correctly with **no** upcoming cycle and **no** onboarding resources
  published, and nothing links to a dead end.
- The no-cycle sentence comes from `nextPublicCycleLine()`, not a literal.
- The admin preview matches the member view in every state.
- Lint, test, build and docs-check are green, and phone and desktop screenshots are in
  the PR.
