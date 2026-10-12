# `app/` — the Next.js App Router: every page, layout, and API route

| | |
|---|---|
| **What this is** | The URL surface of OLOS: four route groups of pages, one parallel slot for the sign-in popup, the `api/` route handlers, and the shared React components. |
| **Zone / owner** | `frontend` for pages, `components/` and `globals.css`; `backend` for `api/**` — see the file-ownership map in [`docs/agent-teams.md`](../docs/agent-teams.md). |
| **Conventions** | No `CLAUDE.md` at this level. This is Next.js 16: read `node_modules/next/dist/docs/` before writing code ([`AGENTS.md`](../AGENTS.md)). A new page outside the signed-in app must be added to the `publicPaths` allowlist in [`proxy.ts`](../proxy.ts). Area notes: [`lib/auth/CLAUDE.md`](../lib/auth/CLAUDE.md), [`docs/poderator-dashboard/CLAUDE.md`](../docs/poderator-dashboard/CLAUDE.md). |
| **Last verified** | 2026-10-02 |

## What is here

Route groups (parenthesised folders) do not appear in URLs; each one shares a layout.

| Path | What it does | Notes |
|---|---|---|
| `(public)/` | The outward-facing site: `/about`, `/events`, `/library`, `/local-labs`, `/stories`, `/build-cycles`, `/board`, `/contact`, `/donate`, `/get-involved`, the legal pages. One layout: public nav + open-source footer. | [`(public)/README.md`]((public)/README.md) — browse-free, allowlisted in `proxy.ts` |
| `(dashboard)/` | The signed-in app: `/dashboard`, `/cycles`, `/pods`, `/projects`, `/learning`, `/directory`, `/u/[handle]`, `/profile`, `/network`, `/lab`, `/pulse-check`, `/survey/[slug]/results`, plus the `/moderator` (Poderator) and `/admin` surfaces. | [`(dashboard)/README.md`]((dashboard)/README.md) — gated by `proxy.ts` |
| `(auth)/` | `/login` (the Google sign-in card) and `/register` (the onboarding funnel). | [`(auth)/README.md`]((auth)/README.md) |
| `(survey)/` | `/survey/[slug]` — the public field survey: account-free, anonymous, one question at a time, in a chrome-less layout. Reads `field_surveys` / `survey_questions` through `lib/content/surveys.ts`. | shipped; the plan is [`docs/SENSEMAKING_FLOW.md`](../docs/SENSEMAKING_FLOW.md) |
| `@authmodal/` | Parallel route slot. A soft in-app navigation to `/login` is intercepted by `(.)login/page.tsx` and the sign-in card opens as a popup over the current page; `default.tsx` renders nothing everywhere else. | hard loads (invite emails, refreshes) get the full `(auth)/login` page |
| `api/` | The server endpoints: 130 `route.ts` handlers in ~40 domain folders — auth callback, registrations, invitations, cycles, pods, projects, events, labs/metros, moderator, admin, owner, cron, OG images, and more. | [`api/README.md`](api/README.md) — `backend` zone |
| `c/[cycle_id]/` | The public, shareable cohort page: non-sensitive `cycles` columns (name, dates, description, what you build) and a "Sign in to register" CTA. Draft cycles 404. Kept apart from the signed-in `/cycles/[id]`. | v2 is #414 |
| `components/` | Shared React: `chrome/` (nav, footers, editorial grid, prose page), `content/` (teasers, agenda, spotlights, metro search), `flow/` (the step engine behind the funnel and the survey), `cycle/`, `tasks/`, `feedback/`, `auth/`, `ui/`. | [`components/README.md`](components/README.md) — `frontend` zone |
| `layout.tsx` | Root layout: the Geologica font (self-hosted by `next/font`), site-wide metadata and social-card defaults, the `authmodal` slot, and the every.org donate embed script. | |
| `page.tsx` | The home page (`/`): hero, the Build Cycles banner keyed on `getRecruitingCycle()`, then events, library, labs and spotlights read from the content tables. Force-dynamic. | a public surface; described in [`(public)/README.md`]((public)/README.md) |
| `globals.css` | The design-system CSS — tokens, type scale, component classes — the implementation of [`DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md). | `frontend` zone |
| `error.tsx`, `not-found.tsx` | Chrome-less root error boundary and 404. Each route group has its own pair that keeps its chrome. | |
| `favicon.ico`, `icon.png`, `apple-icon.png`, `opengraph-image.jpg`, `twitter-image.jpg` (+ `.alt.txt`) | Icons and social cards, picked up by Next's metadata file conventions. | the comment in `layout.tsx` calls the cards `.png`; the files are `.jpg` |

## How it fits

[`proxy.ts`](../proxy.ts) runs before every request: it refreshes the Supabase session and
redirects a signed-out visitor to `/login` unless the path is on its public allowlist. Pages
are server components that read through `lib/` (content queries, cycle resolvers, auth
helpers) and render components from `components/`; client islands mutate through `api/`
handlers, which share their Zod schemas with the forms via `lib/validations/`. The ten-minute
orientation is [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) (its `app/` table omits
`(survey)/` and `c/`); the tables behind the pages are in [`SCHEMA.md`](../SCHEMA.md); the
current plan for the public and onboarding surfaces is
[`docs/roadmap/handoff-2026-09-28-onboarding-journeys.md`](../docs/roadmap/handoff-2026-09-28-onboarding-journeys.md).

## Open issues in this area (snapshot 2026-10-02)

Live view: [label `area/frontend`](https://github.com/TheUpskillingLabs/OLOS/issues?q=is%3Aopen+label%3Aarea%2Ffrontend) ·
[label `area/backend`](https://github.com/TheUpskillingLabs/OLOS/issues?q=is%3Aopen+label%3Aarea%2Fbackend) ·
[all open issues](https://github.com/TheUpskillingLabs/OLOS/issues).

Each child README carries the snapshot for its own area. The items below cut across more than
one group:

- [#182](https://github.com/TheUpskillingLabs/OLOS/issues/182) — Migrate marketing site onto OLOS and sunset the separate Squarespace site
- [#414](https://github.com/TheUpskillingLabs/OLOS/issues/414) — A4 — Public cohort page v2 (`/c/[cycle_id]`) and a DB-backed `/build-cycles` — the Showcase slice candidate (`priority/p1, size/m, persona/pre-registrant`)
- [#472](https://github.com/TheUpskillingLabs/OLOS/issues/472) — Onboard the volunteer developer joining to build the public pages: access, reading order, the scoping conversation, the first PR, and the lane that follows (`priority/p1, size/s`)
- [#106](https://github.com/TheUpskillingLabs/OLOS/issues/106) — [frontend] form accessibility — add aria-required, aria-invalid, aria-describedby to Field primitives (`good first issue, priority/p2, size/s`) — the primitives live in `components/ui/form.tsx`
- [#96](https://github.com/TheUpskillingLabs/OLOS/issues/96) — Improve form dropdowns

This list is a snapshot; the live view above is the truth. Refreshed at each sprint boundary
([`docs/roadmap/documentation-framework.md`](../docs/roadmap/documentation-framework.md) §9.1).

## Before you change something

- Tests: `npm run test` runs Vitest over `lib/**/*.test.ts`. Nothing under `app/` has tests
  (UI and DB-integration testing is not set up — see "Testing" in
  [`CONTRIBUTING.md`](../CONTRIBUTING.md)); `npm run lint` and `npm run build` are the gate.
- A new browse-free page needs its path in `publicPaths` in `proxy.ts`, or signed-out visitors
  are bounced to `/login`. A new page or mode needs a wireframe before the code
  ([`documentation-framework.md`](../docs/roadmap/documentation-framework.md) §5).
- Copy: "The Labs" (never "TUL"), "Upskiller", "Poderator"; never course / class / student /
  lesson / module in the UI. Voice rules are in `DESIGN_SYSTEM.md` §11.
- Constitution: no in-app LLM, no activity telemetry, nothing that shames a member who is
  behind, consent-gated messaging.
- Ownership: pages and `api/**` are different zones — do not mix them in one PR unless you own
  both; `components/ui/form.tsx` has one owner at a time.
- Every PR needs a `CHANGELOG.md` line; run `npm run check:docs` when you touch a README.
  Branch and PR workflow: [`CONTRIBUTING.md`](../CONTRIBUTING.md).
