# The Ambassador role — `docs/ambassadors/`

| | |
|---|---|
| **Status** | Canonical for the Ambassador role in OLOS (shipped with migration `00104`) |
| **Owner** | Maintainers; copy owned by the ambassador coordinator |
| **Last verified** | 2026-10-09 |

Read this before touching `app/(dashboard)/ambassador/`, `app/(present)/ambassador/`,
`app/(public)/get-involved/ambassador/`, `app/api/ambassadors/`, `app/components/ambassador/`,
`lib/ambassador/`, or migrations `00104`/`00105`.

The role was built first as a static prototype in the `TheUpskillingLabs/ambassadors` repo
(Astro, no backend: everything on the applicant's phone). It moved here so that being an
ambassador is a real record: who is one, which Lab they belong to, who confirmed them, and
who came in through them. The prototype's account tools now redirect to these pages.

## The ladder, and where each rung lives

**Raise your hand → Get in → Get ready → Pass it on.**

| Rung | Route | What happens | Records |
|---|---|---|---|
| Launch banner | Dashboard, top of the center column (`app/components/ambassador/launch-banner.tsx`) | Every member who hasn't applied sees "The Ambassador program is open" until `ui.launch.until`; once they've applied it says the application is in review. Apply goes straight to `/ambassador/apply`. Each version is dismissed on its own key. Rules: `lib/ambassador/launch.ts`. | `task_dismissals` |
| Raise your hand | `/get-involved/ambassador` (public, unlisted, `noindex`) | The program page. Every "Become an ambassador" goes to `/ambassador/start`. | — |
| Front door | `/ambassador/start?invite=…&ref=…` (public, exact path in `proxy.ts`) | Parks the invite/referrer in the `amb_join` cookie, then: signed in → apply; returning member → Google sign-in, back to apply (`return_to`); new → sign-in → registration → dashboard task "Continue to the ambassador application". | cookies only |
| Get in | `/ambassador/apply` | The film or short read → the ten-question quiz (8 to pass, graded on the server) → the Ambassador Agreement → confirm details → the pass. | `ambassador_applications`, `agreement_acceptances` |
| Reviewed | `/ambassador/coordinator` → `/ambassador/coordinator/[id]` | Two reviewers each approve or decline, seeing the quiz result and agreement beside the applicant's OLOS record (`lib/ambassador/record.ts`). Two approvals confirm; two declines say not this time; a split goes to an admin, whose review decides. A pre-approved invite skips review: finishing the quiz and agreement makes the invitee an ambassador. Rules: `lib/ambassador/review.ts`. | `ambassador_reviews`, `participant_roles` (`ambassador`) |
| Get ready | `/ambassador` + `/ambassador/guide/[step]` | Five steps — The Labs, The Conversation, Your Story, The Room, Practice — each with one Done. All five → "Tell your coordinator you're ready". | `ambassador_step_progress`, `ready_at` |
| The button | `/ambassador/coordinator` | Handed over in person; the coordinator marks it. | `button_given_at` |
| Pass it on | `/ambassador` (share link), `/ambassador/nominate` | The share link (`/ambassador/start?ref=<handle>`) credits new ambassadors to the sharer; nominations go to the coordinator, who can turn one into an invite. | `referred_by_participant_id`, `ambassador_nominations`, `ambassador_invites` |
| Present | `/ambassador/present` (`?short`, `?notes`, `?practice`) | The full-screen deck; the notes view drives a presentation window on the same device. | — |

## Who coordinates

**A Lab's leads** (`participant_roles.role = 'lab_lead'`, scoped by `lab_id`) coordinate that
Lab's ambassadors; **admins** see every Lab and HQ. The check is `requireLabAccess`
(`lib/auth/lab.ts`) on every coordinator route. An application's `lab_id` is the applicant's
active Lab (`participants.metro_id`) at submit, else the inviter's Lab, else NULL (HQ — admins
decide). A dedicated coordinator role can come later if the jobs split; nothing here assumes
the lead does it forever.

The same people are the **reviewers**: any two of them review a pending application. Nobody
reviews their own application or one they brought in through their share link, and each reviewer
decides without seeing the other review until they've recorded their own.

## Decisions made in the move (and why)

| Decision | Why |
|---|---|
| The role grant (`participant_roles`) is the truth; the application row is the history. | One authority table for the app and RLS (the 2026-07 authorization unification). An admin can grant the role directly; `ambassadorStage()` treats any active grant as "ambassador". |
| Invites are random, single-use, expiring tokens; an email on the invite must match. | The prototype's invite was unsigned data in the URL — anyone could mark themselves "in". |
| The quiz is graded on the server; a failed attempt gets hints, not answers. | So the answer key never ships to the browser. |
| The story draft, practice self-checks and "Who will you ask?" names stay on the device. | The agreement says ambassadors don't collect contact details for The Labs; the names are third parties who agreed to nothing. Story and practice are private practice, not records. |
| New members land on the dashboard after registration, with an Ambassador task — not redirected into the apply flow. | The funnel's owner decision: no intent silently chains into another flow. The `return_to` cookie only brings *returning* members back, and only to `/ambassador*` paths (`lib/auth/return-to.ts`). |
| Two reviewers decide every application (`00105`). | The program launches as an application, not a coordinator's sign-off: two people look at the quiz, the agreement and the person's OLOS record. A split goes to an admin rather than a third lead, so it has one clear owner. |
| Open applications are reviewed by two people; a pre-approved invite is "in" once onboarding is done. | The front door stays open to anyone, so strangers get two reviewers. An invite is a coordinator's vouching, so the invitee only has to finish the onboarding (`canSubmit`). The claim on the invite is atomic and single-use; the inviter is recorded as `decided_by` and as a `source = 'invite'` review row. (Owner decision, 2026-10-10; supersedes the 00105 "one more reviewer" rule.) |
| Reviewers see participation, not private reflections. | The OLOS record panel shows profile, Lab, roles, cycles, pods, projects, event RSVPs and agreements. Learning Log content and health checks stay between the member, their Poderator and admins (SCHEMA.md). The quiz keeps only its score, so per-question answers aren't shown. |
| Reviewer notes never reach the applicant. | A review-driven decline leaves `decision_note` empty; the applicant sees the plain "not this time" copy. |
| No emails to coordinators. | Consent-gated messaging; the coordinator's queue is a dashboard task and the `/ambassador/coordinator` page. |
| The next session comes from the published public events, not a hand-kept schedule. | `lib/ambassador/session.ts`; the prototype's `data/schedule.json` went stale. |
| Terms of Service §3 now names the Ambassador Agreement. | It said the Build Cycle agreement was the only additional agreement. |

## Where the words live

All copy is JSON (plus `steps.ts`) in `lib/ambassador/content/`, imported through
`lib/ambassador/content.ts`. Components never hard-code copy. Entries with
`placeholder: true` show a "[PLACEHOLDER] draft copy" marker until real copy replaces them.

- The five steps: `steps.ts` (Markdown; built-in blocks on their own line: `<!-- ladder -->`,
  `<!-- faq -->`, `<!-- story -->`, `<!-- asks -->`, `<!-- present -->`; an unknown name throws
  and a unit test parses every step).
- The quiz, agreement, film/short read and pass: `apply.json`. **Bump `agreement.version`
  when the agreement text changes**: acceptances of an older version stop counting.
- Practice situations: `scenarios.json` (`core: true` puts one in the first round of six).
- Deck: `deck.json`. FAQ: `faq.json`. Program page: `program.json`. UI strings: `ui.json`.
- The coordinator contact in `help.json` is hidden while it's still the placeholder.

The playbook content (steps, scenarios, FAQ, deck, story prompts) is CC BY 4.0
(`lib/ambassador/content/LICENSE.md`); everything else is all rights reserved.

## Still open

- **Board approval** of the role and the program page (it stays unlisted and `noindex`).
- **The launch banner goes live with the code.** It shows to every signed-in member once this
  reaches production, and links the (still unlisted) program page. Promote only after board
  approval, or set `ui.launch.until` in `lib/ambassador/content/ui.json` to a past date to hold it.
- **Who reviews.** Today any Lab lead of the applicant's Lab, or any admin. Whether the pool should
  be narrower (named reviewers per Lab) is open.
- **Reapplying.** A declined application can be reopened by a coordinator; there's no self-serve
  reapply or waiting period yet.
- **Legal review** of the Ambassador Agreement draft and the Terms §3 wording.
- **Real copy** for every `placeholder: true` entry, the orientation film, and the coordinator contact.
- **Upskiller referrals.** The share link counts new *ambassadors*. Crediting new *Upskillers*
  to an ambassador needs the registration funnel to read a referrer — a separate change.
- **Offline.** The prototype's service worker cached the guide and deck for a phone in a
  room; OLOS has none yet.
