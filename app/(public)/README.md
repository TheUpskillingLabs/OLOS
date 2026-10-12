# `app/(public)/` — the outward-facing site: what a visitor sees without an account

| | |
|---|---|
| **What this is** | The browse-free pages of theupskillinglabs.org — events, the Learning Library, local labs, stories, Build Cycles, about, board, contact, donate, get involved, and the legal pages — sharing one layout (the dark public nav and the open-source footer). |
| **Zone / owner** | `frontend` (public pages and their client components). The data they read comes from `lib/content/`, which is the `backend` zone. See [`docs/agent-teams.md`](../../docs/agent-teams.md). |
| **Conventions** | No `CLAUDE.md`. Every page exports `dynamic = "force-dynamic"` because `layout.tsx` reads request cookies for the auth-aware nav (`publicSession()` in `lib/auth/public-session.ts`). A new path must be added to `publicPaths` in [`proxy.ts`](../../proxy.ts). Pages are composed from `app/components/chrome/` (`EditorialHeader`, `ProsePage`) and `app/components/content/` (teasers). |
| **Last verified** | 2026-10-02 |

## What is here

"Static" means the copy is JSX in `page.tsx` and nothing is read from the database (apart
from the layout's session read).

| Path | What it renders | Data | Where the copy comes from |
|---|---|---|---|
| `layout.tsx` | The shell: `PublicNav` (Log in / Join or the member avatar), the orb gradient defs, the page, `OsFooter`. | `publicSession()` → `participants` | — |
| `loading.tsx`, `error.tsx`, `not-found.tsx` | A branded spinner, an error boundary that keeps the public chrome, and a 404 with "Browse events". | — | — |
| `about/` → `/about` | The About page on the editorial grid: beliefs, what we have built, pulled quotes. | static | inline; "from the generator" (the design prototype, not in this repo) |
| `board/` → `/board` | Board-of-directors cards with headshots. `/team` redirects here (`next.config.ts`). | static | adapted from [`docs/marketing-site/pages/the-team.md`](../../docs/marketing-site/pages/the-team.md) |
| `build-cycles/` → `/build-cycles` | The promise cards, "the current cycle", its anchor events, partner problems, a register CTA. | `events` where `anchor` via `getEvents()`; the cycle facts are the hard-coded `CYCLE_PUBLIC` in `lib/cycles/public-cycle.ts` (still "Summer 2026") | inline; a DB-backed version is #414 |
| `code-of-conduct/` → `/code-of-conduct` | The Code of Conduct as a `ProsePage`. | static | mirrors [`docs/legal/CODE_OF_CONDUCT.md`](../../docs/legal/CODE_OF_CONDUCT.md) — keep both in sync by hand |
| `contact/` → `/contact` | "Partner with us": sponsor / community / venue partners and a contact line. | static | adapted from [`docs/marketing-site/pages/partner.md`](../../docs/marketing-site/pages/partner.md) |
| `donate/` → `/donate` | A landing for the every.org checkout; the give button opens `DONATE_URL` from `lib/donate.ts` (popup script in the root layout). | static | adapted from [`docs/marketing-site/pages/donate.md`](../../docs/marketing-site/pages/donate.md) |
| `events/` → `/events` | Hero with the next anchor events (`components/content/featured-events.tsx`) and the month-grouped agenda island with URL-synced filters (`events-agenda.tsx`). | `events` via `getEvents()` | DB; the hero footnote is hard-coded |
| `events/[slug]/` → `/events/[slug]` | Event detail with the registration rail, an `.ics` link (`lib/content/event-ics.ts`), a photo `gallery.tsx`, and `rsvp.tsx` (POST `/api/events/[id]/rsvp`). Members-only events 404 when signed out. Luma-managed events register on Luma. | `events` via `getEvent()`; `event_rsvps` for "You're going" | DB (`description` rendered by `lib/content/markdown.tsx`) |
| `get-involved/` → `/get-involved` | Volunteer teams and the mentor pathway. | static | adapted from [`volunteer.md`](../../docs/marketing-site/pages/volunteer.md) and [`open-roles.md`](../../docs/marketing-site/pages/open-roles.md) |
| `library/` → `/library` | The Learning Library grid; "Coming Soon" when empty. | `resources` via `getResources()` | DB |
| `library/[slug]/` → `/library/[slug]` | Resource detail with a CTA labelled by `content_type` ("Open it" / "Watch now") and a recirculation row. | `resources` via `getResource()` | DB |
| `local-labs/` → `/local-labs` | "Find your city": `MetroSearch` (client) over every metro, active lab first; typing a new city POSTs `/api/labs/waitlist`. `/labs` redirects here. | `metros` via `getMetros()` | DB |
| `local-labs/[slug]/` → `/local-labs/[slug]` | Two branches: an active lab (join via `join-active-button.tsx` → `/api/labs/[id]/join`, follow button, page updates) or a waitlist pitch (`join-button.tsx` → `/api/metros/[id]/waitlist`). The active branch hard-codes "Summer 2026 · Civic & Elections Cycle in progress". | `metros`, `events`, `participants`, `metro_waitlist_signups`; `lib/pages/server.ts` | DB plus inline copy |
| `privacy/` → `/privacy` | The Privacy Policy as a `ProsePage`. | static | mirrors [`docs/legal/PRIVACY_POLICY.md`](../../docs/legal/PRIVACY_POLICY.md) |
| `sectors/[slug]/` → `/sectors/[slug]` | A sector's cycles and workstreams, with follow and page updates. A deep-link target from the dashboard rail; not in the public nav, and **not** on the `proxy.ts` allowlist, so it is sign-in only today. | `sectors`, `cycles`, `workstreams` via `lib/content/org-pages.ts` | DB |
| `stories/` → `/stories` | Upskiller Spotlights: a filterable grid (`stories-client.tsx`) and the share-your-story modal (POST `/api/stories`). Empty until consented stories are published. | `spotlights` via `lib/content/spotlights.ts` | DB |
| `stories/[slug]/` → `/stories/[slug]` | One spotlight: hero, pull quote, the story, more spotlights. | `spotlights` via `getSpotlight()` | DB |
| `terms/` → `/terms` | The Terms of Service as a `ProsePage`. | static | mirrors [`docs/legal/TERMS_OF_SERVICE.md`](../../docs/legal/TERMS_OF_SERVICE.md) |
| `workstreams/[slug]/` → `/workstreams/[slug]` | A workstream's lab, sector and pods, with follow and page updates. Same gating as `sectors/`. | `workstreams`, `metros`, `sectors`, `pods` via `getWorkstreamPage()` | DB |

Public surfaces that live outside this folder: the home page [`app/page.tsx`](../page.tsx)
(hero, the Build Cycles banner keyed on `getRecruitingCycle()`, then events, library, labs and
spotlights from the same queries), the shareable cohort page `app/c/[cycle_id]/page.tsx`
(reads `cycles`; drafts 404), and the field survey under `app/(survey)/`.

## How it fits

`proxy.ts` lets these paths through without a session (owner rule: no gated browse); the
layout then reads the session only to decide what the nav shows. Pages read through
`lib/content/queries.ts`, `spotlights.ts` and `org-pages.ts` with the service-role client
(the content tables are public-SELECT under RLS) and never gate on the result; the client
islands (RSVP, join, waitlist, share a story) write through `app/api/`. The tables are in
[`SCHEMA.md`](../../SCHEMA.md) and the content model in the "Public content" section of
[`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md). The hand-off brief
[`docs/roadmap/handoff-2026-09-28-onboarding-journeys.md`](../../docs/roadmap/handoff-2026-09-28-onboarding-journeys.md)
is the plan of record for this folder: §2.1 is a verified reading of each page (what is
hard-coded, which promises the code cannot keep) and §7.U is the lane that fixes it. Labs
are explained in [`docs/LOCAL_LABS.md`](../../docs/LOCAL_LABS.md); the legacy marketing copy
is the reference corpus in [`docs/marketing-site/`](../../docs/marketing-site/README.md).

## Open issues in this area (snapshot 2026-10-02)

Live view: [label `area/frontend`](https://github.com/TheUpskillingLabs/OLOS/issues?q=is%3Aopen+label%3Aarea%2Ffrontend) ·
[all open issues](https://github.com/TheUpskillingLabs/OLOS/issues).

- [#414](https://github.com/TheUpskillingLabs/OLOS/issues/414) — A4 — Public cohort page v2 (`/c/[cycle_id]`) and a DB-backed `/build-cycles` — the Showcase slice candidate (`priority/p1, size/m, persona/pre-registrant`)
- [#473](https://github.com/TheUpskillingLabs/OLOS/issues/473) — Learning Library detail page: the "Open it" / "Watch now" button falls back to `href="#"` when a resource has no URL (`good first issue, priority/p2, size/s`)
- [#474](https://github.com/TheUpskillingLabs/OLOS/issues/474) — `/events` mobile hero: "Get the monthly email" links to `/get-involved`, which has no email form (dead end) (`good first issue, priority/p2, size/s`)
- [#472](https://github.com/TheUpskillingLabs/OLOS/issues/472) — Onboard the volunteer developer joining to build the public pages: access, reading order, the scoping conversation, the first PR, and the lane that follows (`priority/p1, size/s`)
- [#182](https://github.com/TheUpskillingLabs/OLOS/issues/182) — Migrate marketing site onto OLOS and sunset the separate Squarespace site
- [#441](https://github.com/TheUpskillingLabs/OLOS/issues/441) — S2.8 — Curriculum in-product: M0–M4 in `/library`, ladder steps linking to modules, weeks 0–2 `weekly_messages` authored from the curriculum (`priority/p2, size/s`)
- [#453](https://github.com/TheUpskillingLabs/OLOS/issues/453) — K4 — The theme primer for the next cycle: template + the example, as a Learning Library resource (due Oct 9 for the Showcase slice) (`priority/p1, size/s`)
- [#419](https://github.com/TheUpskillingLabs/OLOS/issues/419) — A8 — Copy and content for the between-cycles experience: ladder copy, drip messages, theme primer, the Showcase email (`priority/p1, persona/pre-registrant`)
- [#415](https://github.com/TheUpskillingLabs/OLOS/issues/415) — A6 — Waitlist v2: three optional fields, the lab-less dashboard copy, and the city count (feedback #11) (`priority/p2, size/s, persona/pre-registrant`)

This list is a snapshot; the live view above is the truth. Refreshed at each sprint boundary
([`docs/roadmap/documentation-framework.md`](../../docs/roadmap/documentation-framework.md) §9.1).

## Before you change something

- New here? Start with [`ONBOARDING.md`](../../ONBOARDING.md), then
  [`CONTRIBUTING.md`](../../CONTRIBUTING.md); #472 is the onboarding issue for this folder and
  §7.U of the hand-off brief is its lane. Good first issues: #473, #474.
- Tests: none cover these pages. The helpers they call are covered —
  `lib/content/format.test.ts`, `featured.test.ts`, `event-ics.test.ts`, `markdown.test.ts`
  — and `npm run test` runs them; `npm run lint` and `npm run build` catch the rest.
- A new page needs a wireframe first
  ([`documentation-framework.md`](../../docs/roadmap/documentation-framework.md) §5), its path
  in `proxy.ts`, and `export const dynamic = "force-dynamic"`.
- Copy: second person, plain language, sentence case (`DESIGN_SYSTEM.md` §11). "The Labs"
  (never "TUL"), "Upskiller", "Poderator"; never course / class / student / lesson / module.
  The legal pages mirror `docs/legal/` — change the markdown and the page together. The
  marketing-site corpus is reference material, not final copy. No real participants' names in
  anything committed (the repo is public).
- Constitution: no in-app LLM, no activity telemetry, nothing that shames a member who is
  behind, consent-gated messaging — and no gated browse on these pages.
- Every PR needs a `CHANGELOG.md` line; `npm run check:docs` when you touch a doc.
