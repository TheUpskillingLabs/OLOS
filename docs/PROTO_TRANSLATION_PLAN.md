# onboarding-proto → OLOS: staged translation plan

**Design source of truth:** the `onboarding-proto` repo (static HTML prototype).
**Priority order (owner decision):** (1) the onboarding flow, (2) reskinning OLOS
to match the prototype. Everything else comes in the stages below.
**Branch:** `claude/onboarding-proto-to-olos-q0qzli` (based on `dev`).

The prototype's own translation docs are the companion references:
`onboarding-proto/docs/HANDOFF.md` (URL → route, data file → table, localStorage
key → production equivalent) and `onboarding-proto/docs/OLOS_BACKEND_CHANGES.md`
(every schema/API change the frontend implies).

---

## Stage A — Design-system foundation ✅ (this branch)

The prototype's three-layer system (`tokens.css` → `system.css` → per-page
vocabulary) becomes ordered sections of `app/globals.css`:

- **`@theme`** carries the canonical palette (`--color-ink #00141b` …
  `--color-meta-soft #8a979b`), `--radius-card: 14px`, `--shadow-card(-lg)`,
  and `--font-sans` → Geologica. New React code uses the utilities
  (`bg-paper`, `text-ink`, `text-teal-deep`, `rounded-card`, `shadow-card`).
- **`:root` aliases** keep the prototype's own token names (`--ink`, `--paper`,
  `--r`, `--pad`/`--maxw`, `--rule*`, `--od1/2/3`, `--grain`) so the component
  layer below stays diffable against the prototype, line for line.
- **The component layer** (`@layer components`) is `system.css` + the
  funnel-relevant slice of `app.css`, ported near-verbatim: type scale
  (`.t-display` … `.t-stat`, `.lbl`, `.idx`, `.on-dark` remap, ≥1024px bumps),
  the `.btn` family (`.btn-teal` fills with `--teal-deep` for AA — `--teal`
  stays the accent), cards/chips/kv/status, the modal shell, and the whole
  onboarding vocabulary (`.onboard`/`.sheet`, `.seg`, `.field(-grid)`,
  `.choice`/`.dot`, `.opt-card`, `.tag-btn`, `.agree-scroll`/`.agree-hint`,
  `.google-btn`, `.s-cover`).
- **Geologica via `next/font/google`** — self-hosted at build time, zero
  runtime CDN requests, honoring the prototype's no-CDN rule without porting
  the 450KB base64 `font.css`. Root layout also sets
  `viewport.interactiveWidget: "resizes-content"` (mobile-keyboard rule).
- **Legacy quarantine:** the pre-reskin dark look (midnight/aqua/cloud tokens +
  the old body styling) survives only inside the `.theme-legacy` wrapper, which
  `app/(dashboard)/layout.tsx` applies. Un-migrated pages render exactly as
  before; each stage below removes the wrapper from the surface it migrates,
  and the last one deletes the legacy tokens.

Hard rules carried over: one radius (no pills; genuine circles only), warm
`--paper` as the only light page background, dark reserved for covers/nav/
footers, 4px baseline grid, 16px+ inputs, focus-visible teal outlines,
`prefers-reduced-motion` respected, **"The Labs" never "TUL"** in rendered UI.

Deliberately deferred from A (they'd be dead code until their consumers exist):
`.media`/orb gradient frames + the orb SVG defs sprite, `.sitenav`/`.appnav`/
`.tabbar` chrome CSS, and the chrome React components (`public-nav`, `app-nav`,
`tab-bar`, `site-footer`, `orb-defs`) — they land with C2/C7.

## Stage B — The onboarding funnel ✅ (this branch)

Prototype → OLOS mapping (all inside the existing `(auth)` route group; both
routes were already public in `proxy.ts`):

| Prototype | OLOS |
|---|---|
| `view-google-auth` (auth explainer) | `/login` — copy ported verbatim; keeps the `?invite=` cookie write + invited badge and `signInWithOAuth` |
| `view-role-intent` (multi-select) | `/register` stage 1 (`RegistrationFunnel` roles screen) |
| `FLOWS('signup')` 5 screens | `/register` stage 2 — data-driven `SIGNUP_STEPS` + step renderers (`info`/`fields`/`choice`/`consent`) |
| typed-email step | read-only OAuth email (strictly better; ratified) |
| zip → silent lab assignment | `lib/metros.ts` `metroFromZip()` server-side → `participants.metro_slug` |
| Participant Agreement + scroll-gate | rendered in full, gated (`scrollTop + clientHeight >= scrollHeight - 8`; fits-without-scrolling counts as read); `attachAgreeGate` semantics preserved |
| `FLOWS('signup').onComplete` writes | one `POST /api/registrations/funnel` |
| `olos.session.v1` | the Supabase `@supabase/ssr` auth cookie — nothing to build |

Backend (migration `00031_funnel_registration_fields.sql`): `participants`
gains `zip`, `metro_slug`, `role_intents TEXT[]` (+ CHECK on
cycle/events/volunteer/mentor), `referred_by`, `agreement_version`,
`agreement_accepted_at`. The hear-about answer lands in the pre-existing
`source` column; `work_situation`'s existing CHECK already matched the
prototype's describes-you options exactly.

The funnel endpoint mirrors `/api/registrations/short` (session check,
`auth_user_id`-match 403, ILIKE dedup + "already registered" email, owner
bootstrap, confirmation email with the cycle CTA window logic) **plus**
invitation fulfillment: `fulfillInvitation` is factored into
`lib/auth/invitations.ts` and runs right after the insert, closing the gap
where an invited *new* user's invite would dangle (the OAuth callback runs
before their participants row exists). `/api/registrations/short` stays for
back-compat; its UI (`short-form.tsx`) is deleted.

**Post-signup branching is deferred by design:** the funnel always lands on
`/dashboard`; `role_intents` is stored so the cycle threshold (C1), mentor
intake, and volunteer flow can light up later without re-asking. Flows never
silently chain (owner rule) — deferral is consistent with it.

Copy rule (hard): all funnel copy is owner-approved Red Antler voice, ported
byte-for-byte (curly apostrophes included). **Change copy in the prototype
first**, then re-port.

## Stage C — deferred stages (ordered)

1. **C1 — Cycle registration ceremony.** Two-beat threshold
   (`view-cycle-threshold`, dark `.s-cover`) → 4-question cycle flow → Open
   Cycle Agreement `signature` step (scroll-gated, typed full name, version
   `open-2026-07-v2` rendered *and* stored) → signed confirmation + `.ics`.
   New `cycle_agreements` table (backend doc §2c; insert-only, read as a
   precondition inside `reconcileEnrollmentActivation` — never a second
   enrollment write path). Extract the flow engine to `app/components/flow/`
   when this stage adds `textarea/checks/tags/signature` step types.
2. **C2 — Dashboard (Home).** Replace the `.theme-legacy` shell with the
   prototype's app chrome (`app-nav` + `tab-bar`, avatar-as-Me menu); setup
   checklist, Learning Log card (Pulse-check rename — owner decision), todos.
   Restyle `app/components/ui/*` here (their consumers migrate here).
3. **C3 — Learning.** Teaser catalogs (events + library) from a `resources`
   table; Luma events cache when the subscription question is settled.
4. **C4 — Directory.** Member directory + visitor mode; needs a broadened
   participants SELECT policy (00020 is pod-mates-only today) + follows.
5. **C5 — Me.** `/profile` grows into the prototype's profile (badges,
   citations, updates); keep `/profile` path (the placeholder-name gate
   targets it).
6. **C6 — Personas.** Reskin `/moderator` (Poderator copy rules: shepherd,
   never "moderator" in rendered UI) + `/admin`; View-as menu.
7. **C7 — Public content pages.** New `(public)` route group: landing `/`
   (replaces the redirect router — highest-risk flip), `/about`, `/cycles`,
   `/stories`, `/events/[slug]`, `/library/[slug]`, `/labs/[slug]`; real
   `metros` + `metro_waitlist_signups` tables retiring `lib/metros.ts`;
   `proxy.ts` flips from public-list to protected-prefix.

## Decisions made (ratified in this branch)

1. Geologica via `next/font/google`, not the base64 port.
2. Design system = `@theme` tokens + a verbatim CSS component layer — not a
   Tailwind-utility rewrite of every prototype class.
3. `.theme-legacy` quarantine; surface-by-surface migration; `ui/*` components
   restyle with their consuming surface, never big-bang.
4. `role_intents` as a `participants` TEXT[] + CHECK (signup-time capture),
   not `option_lists` rows.
5. Metro assignment app-side (`lib/metros.ts`) until C7's real `metros` table.
6. Participant Agreement acceptance as two `participants` columns; the Open
   Cycle Agreement gets its own table at C1.
7. Invite and self-serve signup share one funnel; the funnel endpoint fulfills
   the `invite_token` cookie server-side post-insert.
8. Post-signup role branching deferred to C1+ (intents stored now).

## Owner decisions needed (none block A/B)

- Pulse check → Learning Log rename (mechanism + timing) — before C2.
- Feedback category taxonomy (Bug/Idea/Confusing/Love-it vs current CHECK) — C6.
- Directory visibility default (opt-in vs opt-out) — before C4.
- Open Cycle licensing legal review (MIT + CC BY 4.0, typed-name signature) — before C1 serves real members.
- Luma Plus subscription — before C3 scoping.
- Cycle-interest field disposition (prototype's 4 questions vs the current
  join form's longer intake) — at C1.
- Registration email copy Red Antler pass (mechanism unchanged).

## Risk register (top items)

| Risk | Mitigation |
|---|---|
| Next 16 API drift vs training data | Read `node_modules/next/dist/docs/` before new patterns (AGENTS.md); `next build` per PR |
| Service-role clients bypass RLS | Session checks + `auth_user_id`-match 403 in every handler; new tables ship RLS in the same migration |
| Enrollment-lifecycle second write path (§3.7 incident) | `cycle_agreements` insert-only; everything routes through `reconcileEnrollmentActivation` |
| New skin breaking legacy dark pages | `.theme-legacy` remap; screenshot pass on dashboard/admin/moderator/pulse-check before merges (needs a Supabase-connected env) |
| Copy fidelity | Change copy in the prototype first; grep-diff against `onboarding-proto/app.js` in review |
| Invitation × funnel edges | Fulfillment factored to one function; funnel writes real names so the placeholder gate can't trap invitees; test matrix in C1 QA |
| Migration numbering collisions | `ls supabase/migrations | tail -1` before each new file; SCHEMA.md updated in the same PR |
