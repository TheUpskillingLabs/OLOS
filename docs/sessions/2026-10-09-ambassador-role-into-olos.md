# Move the Ambassador role from the `ambassadors` prototype into OLOS

| | |
|---|---|
| **Date** | 2026-10-09 |
| **Ran by** | Brendan Whitaker + Claude Code (https://claude.ai/code/session_01DFWSyXRzu6A4hujUu9891B) |
| **Branch / PR** | `brendan-cld/charming-einstein-0tsaej` · PR not opened yet |
| **Asked** | "I want the ambassador role specific stuff all over to OLOS" — after an analysis of the prototype's sign-up and experience. |

## What was done

- **Schema** — `supabase/migrations/00104_ambassadors.sql`: `ambassador` in `participant_roles`; the
  Ambassador Agreement in `agreement_acceptances`; `ambassador_applications`, `ambassador_invites`,
  `ambassador_nominations`, `ambassador_step_progress` with self + admin RLS. `SCHEMA.md` updated.
- **Content** — every ambassador string, the five steps, the quiz, the agreement, scenarios, FAQ, deck
  and program copy moved to `lib/ambassador/content/` (CC BY 4.0 playbook notice kept).
- **Logic** — `lib/ambassador/`: server-graded quiz, the stage machine, a small Markdown reader for the
  steps, invite checks, the next session from published events, dashboard tasks.
- **API** — `app/api/ambassadors/**`: the apply flow, guide progress, "ready", coordinator decisions,
  invites, nominations. Coordinator routes are Lab-scoped (`requireLabAccess`).
- **Pages** — `/get-involved/ambassador` (public, unlisted), `/ambassador/start` (public front door),
  `/ambassador` (home by stage), `/ambassador/apply`, `/ambassador/guide/[step]` (with practice cards and
  the story builder), `/ambassador/present` (full-screen deck, short/notes/practice), `/ambassador/nominate`,
  `/ambassador/coordinator` (Lab leads + admins).
- **Wiring** — an Ambassador task kind in the dashboard queue; an "Ambassador" avatar-menu item; the
  OAuth callback honors an allowlisted `return_to` (`/ambassador*` only) for returning members;
  `proxy.ts` allows exactly `/ambassador/start`; Terms §3 names the Ambassador Agreement.
- **Dependency** — `qrcode-generator` (the deck's QR, as in the prototype).
- **Prototype repo** — the `ambassadors` repo's account tools and `/ambassador/` now redirect here (same branch name there).

## What was verified

- `npx tsc --noEmit` clean; `npm run lint` — no errors (pre-existing warnings only); `npm test` — 73 files /
  665+ tests pass, including new `lib/ambassador/*.test.ts` and `lib/auth/return-to.test.ts`.
- `npm run build` passes; all ambassador routes appear in the route table.
- The full migration chain `00001`→`00104` applied to a scratch Postgres 16 (Supabase schemas stubbed);
  `00104` re-runs cleanly; CHECKs reject bad roles/statuses; deleting a coordinator nulls the "by" columns
  and deleting an ambassador cascades their rows.
- `next start`: `/get-involved/ambassador` renders (desktop and 390px phone, no console errors, no
  horizontal scroll); `/ambassador/start` parks its cookies and sends a signed-out visitor to
  `/login?intent=join`; signed-in pages redirect to `/login`.
- **Not verified:** the signed-in pages and API routes against a live Supabase (no Supabase API in the
  session container). Needs a pass on the dev preview: apply → pending → coordinator confirms; apply with
  an invite → in straight away; the guide's Done; deck modes; nominate → invite.

## Decisions made → where they live

| Decision | Recorded in |
|---|---|
| Lab leads coordinate their Lab's ambassadors; admins see all | `docs/ambassadors/CLAUDE.md` (needs a vault note once `docs/vault/` lands) |
| Story draft, practice checks and "who will you ask" names stay on the device | `docs/ambassadors/CLAUDE.md`, `SCHEMA.md` |
| New members land on the dashboard (task), not redirected into the apply flow | `docs/ambassadors/CLAUDE.md`, `lib/auth/CLAUDE.md` |
| No coordinator emails; the queue is a dashboard task | `docs/ambassadors/CLAUDE.md` |

## Open questions / needs from others

- Board approval of the role (the program page stays unlisted).
- Legal review of the Ambassador Agreement draft and the Terms §3 wording.
- Real copy for `placeholder: true` entries, the orientation film, and the coordinator contact.
- Upskiller referrals (crediting new members to an ambassador) need the registration funnel to read a referrer.
- Apply `00104` to dev, then to prod on promotion.
