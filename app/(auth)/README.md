# `app/(auth)/` — the two doors in: Google sign-in and the registration funnel

| | |
|---|---|
| **What this is** | `/login` (the Google sign-in card, with a "join" and a "log in" variant) and `/register` (the onboarding funnel a new Google account walks through to become a participant). |
| **Zone / owner** | `frontend` for these pages and their client components. The callback (`app/api/auth/callback/route.ts`), the funnel endpoint (`app/api/registrations/funnel/route.ts`) and `lib/auth/` are the `backend` zone. See [`docs/agent-teams.md`](../../docs/agent-teams.md). |
| **Conventions** | Agent conventions and the full flow: [`lib/auth/CLAUDE.md`](../../lib/auth/CLAUDE.md) — read it before touching anything here. The group has no nav or footer on purpose. |
| **Last verified** | 2026-10-02 |

## What is here

| Path | What it does | Notes |
|---|---|---|
| `login/page.tsx` | The full-page shell around the card. Reached by hard navigation only: invite emails (`/login?invite=…`), the callback's failure redirect, direct loads. | soft in-app navigations are intercepted by `app/@authmodal/(.)login` and show the same card as a popup |
| `login/login-card.tsx` | Client. Two doors: `?intent=join` (and any `?invite=`) shows the Google-auth explainer; a plain log-in shows the compact card. Sets the `invite_token` and `auth_intent` cookies, then `supabase.auth.signInWithOAuth({ provider: "google" })` with `redirectTo` `/api/auth/callback`. Renders the callback's `?error=` states. | copy is owner-approved; change it in the prototype first (see the file comment) |
| `register/page.tsx` | Server. No session → `/login`; an existing `participants` row → `/dashboard`; otherwise seeds the name fields from the Google profile and renders the funnel. | |
| `register/funnel.tsx` | Client. Role intents → the signup steps on the shared flow engine (`app/components/flow/flow-screen.tsx`) → choose a Local Lab (the zip suggests one via `/api/labs/suggest`) → the Participant Agreement and consent → `POST /api/registrations/funnel` → `/dashboard`. | validation and `PARTICIPANT_AGREEMENT_VERSION` live in `lib/validations/funnel-registration.ts` |
| `error.tsx` | The group's error boundary ("Something went wrong signing you in"). | |

## How it fits

[`proxy.ts`](../../proxy.ts) sends a signed-out visitor to `/login` for any path that is not
on its public allowlist. After Google, the callback route applies the ban gate first
(migration `00102`, keyed on email), then looks up `participants` by email: a row is linked to
the auth user (and any pending invitation fulfilled) and the member lands on `/dashboard`;
no row through the join door goes to `/register`; no row through the log-in door goes back to
`/login?error=no_account`. The funnel endpoint writes the `participants` row (and a
`metro_waitlist_signups` row when the member picked a waitlist), reading `metros`, `testers`
and `cycle_config`. Sequence diagram, invitation flow, the spec deviations (#63, #64) and the
ops checklist: [`lib/auth/CLAUDE.md`](../../lib/auth/CLAUDE.md). Tables:
[`SCHEMA.md`](../../SCHEMA.md). Labs as the membership spine:
[`docs/LOCAL_LABS.md`](../../docs/LOCAL_LABS.md). What the funnel does and does not do today,
and the planned changes to it: §2.1 and §7.U of
[`docs/roadmap/handoff-2026-09-28-onboarding-journeys.md`](../../docs/roadmap/handoff-2026-09-28-onboarding-journeys.md).

## Open issues in this area (snapshot 2026-10-02)

Live view: [label `area/frontend`](https://github.com/TheUpskillingLabs/OLOS/issues?q=is%3Aopen+label%3Aarea%2Ffrontend) ·
[label `area/backend`](https://github.com/TheUpskillingLabs/OLOS/issues?q=is%3Aopen+label%3Aarea%2Fbackend) ·
[all open issues](https://github.com/TheUpskillingLabs/OLOS/issues).

- [#415](https://github.com/TheUpskillingLabs/OLOS/issues/415) — A6 — Waitlist v2: three optional fields, the lab-less dashboard copy, and the city count (feedback #11) (`priority/p2, size/s, persona/pre-registrant`)
- [#212](https://github.com/TheUpskillingLabs/OLOS/issues/212) — [labs][p1] Registration routing is metro-blind — getRegistrationCycle() ignores the participant's lab (`priority/p1, size/s`)
- [#96](https://github.com/TheUpskillingLabs/OLOS/issues/96) — Improve form dropdowns
- [#384](https://github.com/TheUpskillingLabs/OLOS/issues/384) — Platform bans / blacklist: prevent re-registration after removal (design + policy scoping)

This list is a snapshot; the live view above is the truth. Refreshed at each sprint boundary
([`docs/roadmap/documentation-framework.md`](../../docs/roadmap/documentation-framework.md) §9.1).

## Before you change something

- Read [`lib/auth/CLAUDE.md`](../../lib/auth/CLAUDE.md) first; the sign-in path and the
  invitation flow have ratified decisions behind them.
- Tests: `npm run test` covers the auth helpers (`lib/auth/*.test.ts` — grants, lab, projects,
  roles, simulation); nothing covers these pages or the callback end to end. "Local
  verification" in `lib/auth/CLAUDE.md` is the manual checklist.
- The funnel copy and the Participant Agreement are owner-approved: change them in the
  prototype first, and treat a bump of `PARTICIPANT_AGREEMENT_VERSION` as a legal-review item.
- Copy: "The Labs" (never "TUL"), "Upskiller", "Poderator"; never course / class / student /
  lesson / module in the UI. No real names in committed code or fixtures.
- Constitution: consent-gated messaging (`contact_consent` is collected here), no activity
  telemetry, no in-app LLM.
- Every PR needs a `CHANGELOG.md` line; a schema change needs a migration number claimed on the
  issue first. Branch and PR workflow: [`CONTRIBUTING.md`](../../CONTRIBUTING.md).
