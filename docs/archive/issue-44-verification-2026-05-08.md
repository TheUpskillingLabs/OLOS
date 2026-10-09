# Issue #44 — Verification Report

**Date:** 2026-05-08
**Branch:** `feature/magic-link-email`
**Issue:** [ISSUE-W1-006: wire Supabase Auth + Google OAuth](https://github.com/TheUpskillingLabs/OLOS/issues/44)
**Companion issue:** [ISSUE-W1-007: configure Supabase magic links via Resend SMTP](https://github.com/TheUpskillingLabs/OLOS/issues/45)
**Companion doc:** [`lib/auth/CLAUDE.md`](../lib/auth/CLAUDE.md)

---

## TL;DR

Code-side: **complete** with two known caveats.
Ops-side: **not complete** — three external setup tasks remain (Google Cloud OAuth client, Supabase Studio config, Resend domain verification).

---

## Code verification

| Check | Result |
|---|---|
| Key auth files exist after rebase | ✅ all 6 files present (`lib/auth/{middleware,roles,permissions,owner-emails,windows}.ts`, `app/api/auth/callback/route.ts`, `app/(auth)/login/page.tsx`) |
| TypeScript (`tsc --noEmit`) | ✅ clean (after `npm install` to fetch `lucide-react` + `resend` from a stale `node_modules`) |
| ESLint | ⚠ 1 error, 7 warnings — error is **pre-existing** (commit `5d74fd35`, April 10) on `app/(auth)/login/page.tsx:40`, unrelated to this branch |
| Migrations 00013/00014 syntax | ✅ valid `ALTER TABLE` statements |
| Auth coverage on API routes | ✅ 97 occurrences of `withAuth/withAdminAuth/withOwnerAuth`; 4 unguarded routes verified intentional (`auth/callback` public OAuth, `registrations` checks Supabase session manually, two cron routes use `CRON_SECRET`) |

---

## Issue #44 acceptance criteria

| Criterion | Status | Verified by |
|---|---|---|
| Sign-in via Supabase → role claims attached | ✅ | `lib/auth/roles.ts` returns `UserRoles` with `participantId`, `roles[]`, `permissions[]`, `moderatorPodIds[]`, `cycleEnrollments[]` |
| No `participants` row → clear message | ⚠ | Deviates: redirect to `/register` instead of 404. Documented; needs product ratify (see Issue #TBD-A) |
| All authenticated endpoints validate signature + read claims | ✅ | 97 wrapper invocations; Supabase verifies cookie |
| `participant_id`, `email`, role flags, moderator pods, cycle enrollments present | ✅ | Confirmed in `UserRoles` shape; helpers `isAdmin/isOwner/isModerator/isActiveParticipant` exist |
| OpenAPI spec updated | N/A | No OpenAPI doc in repo; no FastAPI service. Documented in `lib/auth/CLAUDE.md` |

---

## Pre-existing finding (action recommended)

**`app/(auth)/login/page.tsx:35-42`** holds `invited` in `useState` and sets it inside `useEffect`. ESLint flags this as a cascading-render bug. The fix is mechanical: `invited` is purely derivable from the `inviteToken` query param, so replace the state with `const invited = !!inviteToken;` and keep only the cookie write inside `useEffect`.

This pre-dates the magic-link branch (April 10) but lives on Issue #44's surface area and currently blocks a clean `npm run lint` gate.

---

## Alignment with long-term goal

The roadmap §1 goal is *"participants can sign in via magic link and submit weekly pulse checks; moderators can see who has and hasn't."* The auth work delivered on this branch unblocks three downstream items per the §1 dependency graph:

- **§1.7 / Issue #45** — code-complete on this branch (custom invitation + Resend HTTP); only Resend domain verification gates production
- **§1.11** (pulse-check form, depends on §1.6) — can begin immediately; doesn't need production Google OAuth, only the dev Supabase project to have the Google provider configured
- **§1.14** (moderator view, depends on §1.6 + §1.10) — same; can begin development now

The critical-path items (§1.4, §1.5, §1.8) remain blocked on **§1.4** awaiting open decision **D1** (ranked-choice pod registration). That's not in #44's lane — it's the migration-script lane.

---

## What's actually left to call #44 closed

In priority order:

1. **Fix the pre-existing lint error** (one mechanical change; ~5 minutes).
2. **Ratify the architectural deviations** with whoever owns product/architecture: 404 → redirect; `@supabase/ssr` vs `auth-helpers-nextjs`; direct Resend vs Supabase SMTP. See companion GitHub issues filed alongside this report.
3. **Run the ops checklist** (in `lib/auth/CLAUDE.md` §Open ops tasks): Google Cloud OAuth client → Supabase Studio Google provider → Redirect allow-list → Resend domain verification.

Items 2 and 3 are not engineering work and not on this branch's plate. Item 1 is the only thing actionable from inside the codebase.
