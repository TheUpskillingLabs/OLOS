# `app/components/` — the shared component library

| | |
|---|---|
| **What this is** | The React components used by more than one route group: the UI primitives, the task surfaces, the page chrome (nav bars, footers, editorial headers), the public content cards, the flow engine, and a few cross-cutting buttons. |
| **Zone / owner** | `frontend` ([`docs/agent-teams.md`](../../docs/agent-teams.md), file-ownership map). **`ui/form.tsx` is shared and single-owner** — one teammate at a time; claim it on the issue before you touch it. |
| **Conventions** | No `CLAUDE.md` at this level; `tasks/` has one — agent conventions: [`tasks/CLAUDE.md`](tasks/CLAUDE.md). Visual rules and the copy voice are [`DESIGN_SYSTEM.md`](../../DESIGN_SYSTEM.md) §8 (component library) and §11 (voice & writing). Import primitives from the barrels `ui/index.ts` and `tasks/index.ts`. |
| **Last verified** | 2026-10-02 |

## What is here

Grouped by kind; descriptions come from each file's header comment and its importers (read on
2026-10-02). Server-safe means no `"use client"`, so the component can render inside a Server
Component.

| Path | What it does | Notes |
|---|---|---|
| **UI primitives — `ui/`** | | barrel: `ui/index.ts` |
| `ui/form.tsx` | `Field` (label / helper / error / char count), `Input`, `Textarea`, `Select` (custom chevron), and `FormField`, which reads the error for its `name` from react-hook-form context. | **Single-owner.** #106 (ARIA) and #96 (dropdowns) both land here. |
| `ui/button.tsx`, `ui/status-badge.tsx`, `ui/stat-card.tsx`, `ui/alert-banner.tsx`, `ui/empty-state.tsx`, `ui/spinner.tsx`, `ui/org-chip.tsx` | The presentational set from the prototype's grammar: the `.btn` button, the dot + uppercase status label (never a pill), the number card, the four-variant left-edge banner, the icon + title + action empty state, the spinner, the "organization" tint for admin chips. | Server-safe. |
| `ui/data-table.tsx` | The shared admin table — config-driven columns, the one place to restyle every admin list. | Server-safe; interactivity lives in a column's `cell`. |
| `ui/tabs.tsx`, `ui/filter-dropdown.tsx`, `ui/tooltip.tsx`, `ui/toggle-switch.tsx` | Controlled client primitives: the WAI-ARIA underline tab bar, the chip-triggered radio filter, hover / focus tooltips (`Tooltip`, `TooltipIcon`), the toggle switch. | Keyboard contracts copied from the app-nav avatar menu. |
| `ui/sheet.tsx`, `ui/confirm-dialog.tsx` | The right-side drawer, and the destructive-action dialog built on it (optional type-to-confirm; the parent owns the mutation). | The app has no toast system — feedback is inline. |
| **Task surfaces — `tasks/`** | | barrel: `tasks/index.ts`; conventions: [`tasks/CLAUDE.md`](tasks/CLAUDE.md) |
| `tasks/task-list.tsx`, `tasks/task-card.tsx` | The dashboard's "Up next" queue — one DOM tree that is a snap strip on phones and a 2-column grid on desktop — and the single card rendering. Dismissals persist to `task_dismissals` via `POST /api/tasks/dismiss`. | Data comes from `lib/tasks/` (`Task`, `dashboardTasks`). |
| `tasks/task-row.tsx` | The cycle-page "Open now" row: never dismissible, same window labels as the cards. | Server-safe; dates via `lib/cycles/lab-time`. |
| `tasks/checklist-card.tsx`, `tasks/cycle-register-card.tsx` | "Get set up" (the account-housekeeping checklist) and the registration state card (`open` / `pre_registered` / `closed`). | Lane M (#412 / #413) adds `ReadinessLadderCard` beside these. |
| **Chrome — `chrome/`** | | |
| `chrome/app-nav.tsx` (+ `nav-search.tsx`), `chrome/dashboard-footer.tsx` | The signed-in app bar — destinations, the typeahead search over people / pods / projects (`GET /api/directory/suggest`), the persona pill, the avatar menu — and the slim footer with the feedback and support links. | Rendered by `app/(dashboard)/layout.tsx`. |
| `chrome/simulation-banner.tsx`, `chrome/simulation-write-guard.tsx` | The "you are viewing as someone else" banner (`lib/auth/simulation`) with its no-JavaScript exit link, and the fetch wrapper that narrates blocked writes while a simulation runs. | Present on both the member and admin shells. |
| `chrome/public-nav.tsx`, `chrome/site-footers.tsx`, `chrome/editorial.tsx`, `chrome/prose-page.tsx`, `chrome/hero-fade.tsx` | The public bar; the two public footers (`PgFoot`, `OsFooter`); the editorial "standards-manual" header and section grid every public content page composes from (`.ed-*` in `globals.css`); the prose-page shell for legal / contact / board; the landing hero's scroll fade. | Used by `app/page.tsx`, `app/(public)/`, `app/c/`. |
| `chrome/orb.tsx`, `chrome/orb-defs.tsx` | The brand orb (SVG) and its gradient defs sprite — mount `OrbDefs` once per page, and never put the orb raw under text. | On the landing, the dashboard hero, and the spotlights. |
| **Content cards — `content/`** | | types from `lib/content/` |
| `content/teasers.tsx` | `EventTeaser`, `ResourceTeaser`, `LabTeaser`, `MediaFrame` — every card is the metadata for its real page; no accordion on browse cards. The `corner` slot holds the `/learning` heart. | Lane L (#441) adds `content/shelf.tsx` here. |
| `content/events-agenda.tsx`, `content/featured-events.tsx` | The month-grouped agenda with its All / Workshops / Anchor and In person / Virtual filters (shared by `/events` and `/learning`), and the `/events` hero band with the next two anchor events. | Filtering is client-side over the server-fetched list. |
| `content/home-spotlights.tsx`, `content/share-story-modal.tsx`, `content/metro-search.tsx` | The landing's Upskiller Spotlights row, the "Share your story" modal (`POST /api/stories`), and the public city search for Local Labs (browse first, account only when a name goes on a list). | |
| **Flows, auth, cycle** | | |
| `flow/flow-screen.tsx` | The flow engine: one question per screen, confirm-to-advance, scroll-gated agreements. Step types `info`, `text`, `textarea`, `fields`, `choice`, `consent`, `signature`. | Consumers: the register funnel, the cycle join ceremony, the public survey. |
| `auth/auth-modal.tsx` | The intercepted `/login` popup shell for the `app/@authmodal` parallel route; closing goes `router.back()`. | |
| `cycle/cycle-info.tsx` | A cycle's public information page (admin-authored content with a structured fallback); the caller supplies the CTA. | Used by `/c/[cycle_id]`. |
| `feedback/feedback-widget.tsx` | The in-app feedback form (category, text, up to three screenshots), mounted by the dashboard layout and opened from the avatar menu or footer. | Triaged at `/admin/feedback`. |
| **Cross-cutting (loose files)** | | |
| `follow-button.tsx` | Optimistic follow / unfollow for a member or a page (`/api/follows`); 44px minimum height in both sizes. | On profiles, pods, projects, workstreams, the network page. |
| `contacts-download-button.tsx` | A plain anchor to the group contact-export routes (CSV). Render only where the viewer is authorized; the route re-checks. | Server-safe. |
| `owner-lifecycle.tsx`, `owner-entity-actions.tsx` | The owner-only Danger Zone (archive / reset) for cycles, pods, and projects, and the compact row-level verbs used by the owner console (`/api/owner/*`). | Callers gate on `isOwner`. |
| `proposal-details.tsx`, `solution-proposal-details.tsx` | The read-only renderers (and the `proposal_data` shape helpers) for a problem proposal and a solution pitch, shared by the galleries, the registration cards, and the Poderator submissions view. | Legacy row shapes fall back where a mapping exists. |

## How it fits

Everything here is imported by `app/page.tsx`, `app/(public)/`, `app/(auth)/`, `app/c/`,
`app/(survey)/`, and the signed-in group described in
[`app/(dashboard)/README.md`](../(dashboard)/README.md). Server components take their data as
props from the page that fetched it; client components call `app/api/` routes directly and roll
back on failure. Colors, type, spacing, and the `.btn` / `.ed-*` / `.menu-item` classes live in
`app/globals.css` — see [`DESIGN_SYSTEM.md`](../../DESIGN_SYSTEM.md) §15: most patterns stay
inline Tailwind, and a pattern earns a component here only once it repeats three or more times
and is stable. The folder is listed in
[`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md#directory-map); the task surfaces' data
model is [`lib/tasks/`](../../lib/tasks/) and its tables are in [`SCHEMA.md`](../../SCHEMA.md).

## Open issues in this area (snapshot 2026-10-02)

Live view: [label `area/frontend`](https://github.com/TheUpskillingLabs/OLOS/issues?q=is%3Aopen+label%3Aarea%2Ffrontend) ·
[all open issues](https://github.com/TheUpskillingLabs/OLOS/issues).

- [#106](https://github.com/TheUpskillingLabs/OLOS/issues/106) — [frontend] form accessibility — add aria-required, aria-invalid, aria-describedby to Field primitives (`good first issue, priority/p2, size/s`)
- [#105](https://github.com/TheUpskillingLabs/OLOS/issues/105) — [backend+frontend] harden LinkedIn URL handling — validate format + sanitize render (`good first issue, priority/p2, size/s`)
- [#96](https://github.com/TheUpskillingLabs/OLOS/issues/96) — Improve form dropdowns
- [#99](https://github.com/TheUpskillingLabs/OLOS/issues/99) — Refactor problem proposal form for react (`good first issue`)
- [#412](https://github.com/TheUpskillingLabs/OLOS/issues/412) — A1 — Between-cycles dashboard mode: the two lists ("Still open this cycle" / "Get ready for {next cycle}") (`priority/p1, size/l, persona/pre-registrant`)
- [#413](https://github.com/TheUpskillingLabs/OLOS/issues/413) — A2 — Readiness ladder: nine steps, verified where the platform can and manual ticks where it cannot (`priority/p1, size/m, persona/pre-registrant`)
- [#457](https://github.com/TheUpskillingLabs/OLOS/issues/457) — K8 — Wire the readiness-ladder copy into `lib/tasks/definitions.ts` (with A2 #413): titles, why, time, done-state, links per step (`priority/p1, size/s`)

This list is a snapshot; the live view above is the truth. Refreshed at each sprint boundary
([`docs/roadmap/documentation-framework.md` §9.1](../../docs/roadmap/documentation-framework.md)).

## Before you change something

- **Tests.** Nothing in this folder is covered by `npm run test` (Vitest includes `lib/**` only).
  Keep logic that can be tested in `lib/` and pass it in; `npm run lint` and `npm run build` are
  the checks that see components.
- **`ui/form.tsx` is single-owner.** #106 and #96 both touch it; take them on one branch and say
  so on the issue first — the "Working in parallel" rules in
  [`CONTRIBUTING.md`](../../CONTRIBUTING.md).
- **Task-shaped UI** goes in `tasks/` under its [`CLAUDE.md`](tasks/CLAUDE.md): one fact per page,
  window labels from `CYCLE_WINDOWS`, dates via `lib/cycles/lab-time`, dismissals only through
  `task_dismissals`.
- **Design rules.** Tokens from `globals.css` only; one 14px radius (genuine circles are the
  exception); 44px tap targets; cards are teasers for their real page. Check the pattern in
  [`DESIGN_SYSTEM.md`](../../DESIGN_SYSTEM.md) §8 before adding a variant.
- **Copy and constitution.** "The Labs" (never "TUL"), "Upskiller", "Poderator"; sentence case;
  never course / class / student / lesson / module in UI. No in-app LLM, no activity telemetry,
  nothing that shames a member who is behind.
- **Done means** CI green and a `CHANGELOG.md` line, plus a decision note when you chose
  something — [`documentation-framework.md` §5](../../docs/roadmap/documentation-framework.md).
