# `lib/auth/` — Authentication & Role Resolution

Source of truth for sign-in, role/permission resolution, and route guards. This
folder pairs with [`app/api/auth/callback/route.ts`](../../app/api/auth/callback/route.ts),
[`app/(auth)/login/page.tsx`](../../app/(auth)/login/page.tsx),
[`lib/email/`](../email/), [`proxy.ts`](../../proxy.ts), and the
`[auth.*]` blocks in [`supabase/config.toml`](../../supabase/config.toml).

This document covers the work in **Issue #44** (Supabase Auth + Google OAuth)
and **Issue #45** (magic-link delivery). Read it before changing anything in
the sign-in path or the invitations email flow.

---

## TL;DR — How this differs from `TUL_MVP_Spec.md`

The MVP spec describes a **Python/FastAPI backend** that exchanges a Supabase
session token for a hand-rolled `pyjwt` JWT (`POST /auth/google`). **This
codebase is Next.js full-stack — there is no FastAPI service, and there is no
hand-rolled JWT.** The spec language survives in the issue text; the
implementation does not. Translate before writing code.

| Spec concept | This repo |
|---|---|
| `POST /auth/google` returning a FastAPI JWT | Supabase OAuth callback at [`/api/auth/callback`](../../app/api/auth/callback/route.ts); session lives in the `@supabase/ssr` cookie |
| "JWT claims" (`participant_id`, role flags, `moderator_assignments`, `cycle_enrollments`) | Per-request resolution in [`resolveUserRoles`](./roles.ts) → `UserRoles` object |
| `pyjwt` signing + verification | Supabase verifies the session cookie; route handlers consume `UserRoles` via [`withAuth`](./middleware.ts) |
| `JWT_SIGNING_SECRET` env var | Not used. `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` |
| OpenAPI spec for `POST /auth/google` | No OpenAPI doc in this repo. The Next.js callback is documented in code; route contracts live alongside the handlers |
| FastAPI middleware authorizing endpoints | [`withAuth` / `withAdminAuth` / `withOwnerAuth`](./middleware.ts) wrappers + the edge proxy in [`proxy.ts`](../../proxy.ts) |

**The data the spec wants in the JWT is all present** — it's just produced on
demand from Postgres rather than encoded into a stateless token. This is
intentional: it lets permission/role/enrollment changes take effect on the
next request instead of waiting for a token to expire.

---

## Sign-in flow (Google OAuth)

```
User                  Frontend              Supabase Auth        Next.js callback        Postgres
 │                       │                       │                      │                    │
 │ click "Sign in" ─────►│                       │                      │                    │
 │                       │ signInWithOAuth ─────►│                      │                    │
 │ ◄─── Google consent ──┴───────────────────────┤                      │                    │
 │ approve  ──────────────────────────────────► │ exchange ───────────►│                    │
 │                                               │                      │ select participants│
 │                                               │                      │  by email ────────►│
 │                                               │                      │ ◄──── row or null ─│
 │                                               │                      │ link auth_user_id  │
 │                                               │                      │ fulfill invite     │
 │ ◄──── redirect / or /register ─────────────────────────────────────  │                    │
```

Files:

- [`app/(auth)/login/page.tsx`](../../app/(auth)/login/page.tsx) — landing page;
  sets the `invite_token` cookie if the URL carries `?invite=…`, then calls
  `supabase.auth.signInWithOAuth({ provider: "google", options.redirectTo })`.
- [`supabase/config.toml`](../../supabase/config.toml) `[auth.external.google]`
  — Google provider enabled, `client_id` / `secret` from `GOOGLE_CLIENT_ID` /
  `GOOGLE_CLIENT_SECRET`. Production credentials are configured in the
  Supabase Studio project, not in this file.
- [`app/api/auth/callback/route.ts`](../../app/api/auth/callback/route.ts) —
  the only OAuth landing endpoint. Exchanges the `code`, looks up
  `participants` by email (service-role client, bypasses RLS), links
  `auth_user_id` if missing, auto-promotes owner emails, fulfills any pending
  invitation, then redirects.

  - **No participant row** → redirect to `/register`. (See §404 vs redirect
    below.)
  - **Auth failure** → `?error=auth_failed` query on `/login`.

- [`lib/auth/owner-emails.ts`](./owner-emails.ts) — `OWNER_EMAILS` env var
  list; first sign-in from one of those addresses upserts an `owner` row in
  `user_roles`. This is bootstrap-only and intentional.
- [`lib/auth/roles.ts`](./roles.ts) — `resolveUserRoles(supabase, authUserId)`
  produces the `UserRoles` shape every guarded route consumes. **This is the
  spec's "JWT claims" surface.**
- [`lib/auth/middleware.ts`](./middleware.ts) — wraps route handlers; resolves
  roles, returns 401 for unauthenticated, 403 for `withAdminAuth` / `withOwnerAuth`.
- [`proxy.ts`](../../proxy.ts) — Next.js 16 edge middleware; redirects
  unauthenticated users to `/login` for non-public, non-API paths. API routes
  enforce auth themselves via the wrappers.

### `UserRoles` shape

```ts
{
  userId: string;            // Supabase auth.users.id
  participantId: number | null;
  roles: Role[];             // owner, admin, observer, developer, moderator, participant
  permissions: Permission[]; // granular grants from participant_permissions
  moderatorPodIds: number[];
  cycleEnrollments: { cycleId: number; status: "active" | "inactive" | "revoked" }[];
}
```

Maps 1:1 onto the spec's required JWT claim set:

| Spec claim | `UserRoles` field |
|---|---|
| `participant_id` | `participantId` |
| `email` | from the Supabase session (`user.email`), not on `UserRoles` |
| `is_admin` / `is_owner` / `is_observer` | derived via `isAdmin(roles)` / `isOwner(roles)` / `roles.includes("observer")` in [`roles.ts`](./roles.ts) |
| active `moderator_assignments` | `moderatorPodIds` |
| active `cycle_enrollments` | `cycleEnrollments` |

---

## Invitation flow (admin → invitee)

This is the custom-token flow that powers Wave 1 onboarding. It is **not**
Supabase Auth's built-in magic-link OTP — it is a Postgres-backed token that
hitches a ride on Google OAuth.

1. Admin creates an invitation via [`POST /api/invitations`](../../app/api/invitations/route.ts).
   A row lands in `invitations` with a UUID `token`, `email`,
   `permissions[]`, `role_preset`, optional `cycle_id` / `pod_id`, and
   `expires_at`.
2. Admin either copies the link (`/login?invite={token}`) or clicks "Send
   email" → [`POST /api/invitations/{id}/send`](../../app/api/invitations/[invitation_id]/send/route.ts)
   which renders [`invitation-template.ts`](../email/invitation-template.ts)
   and dispatches via the Resend HTTP API. `email_sent_at` records the send.
3. Invitee opens the link. [`/login`](../../app/(auth)/login/page.tsx) writes
   `invite_token={uuid}` to a `SameSite=Lax` cookie (1 hour TTL) and shows
   the "You've been invited" CTA.
4. Invitee clicks "Sign in with Google". OAuth completes.
5. Callback runs `fulfillInvitation()` in
   [`/api/auth/callback`](../../app/api/auth/callback/route.ts):
   - Read the cookie, clear it.
   - Match `invitations.token` AND `invitations.email == user.email` AND
     `status='pending'` AND not expired. Email match prevents
     forward-the-link attacks.
   - Upsert `participant_permissions` rows.
   - Upsert `user_roles` row for `owner` / `admin` / `developer` / `observer`
     presets (audit trail; `moderator` is *not* added here — moderator is
     derived from `moderator_assignments` rows).
   - Upsert `cycle_enrollments` (status=active) when `cycle_id` set.
   - Upsert `moderator_assignments` when `pod_id` set (queries the pod for
     `cycle_id`).
   - Mark invitation `accepted` + `accepted_at`.

**Bulk-invite path** (the unbuilt §1.8 / Issue #46): `cycle_id`, `pod_id`,
`permissions`, and `role_preset` are NULL/empty. The `notes` column carries
per-row admin messaging (e.g. "Name not found in participants").

---

## Issue #45 — magic-link email delivery (Resend)

The literal text of #45 wants **Supabase Auth's built-in magic-link emails**
routed through **Resend SMTP**. The branch instead sends invitation emails
**directly** from the Next.js route via the **Resend HTTP API**. Why:

| Direct Resend HTTP (chosen) | Supabase SMTP relay |
|---|---|
| Per-invite payload (`role_preset`, `cycle_name`, etc.) baked into the email body | Limited to Supabase's template variables |
| Renders our branded template from [`invitation-template.ts`](../email/invitation-template.ts) | Requires uploading templates to Supabase project settings |
| Tracked per-row in `email_sent_at` | No first-class delivery tracking in Supabase |
| Decoupled from Supabase Auth's OTP/recovery flows | Coupled — same template fires for every Supabase email |
| Failure surfaces a 502 in our admin UI | Failures buried in Supabase logs |

**Implication for #45's acceptance criteria:** the test inbox check, branded
sender, magic-link body with expiration, plain-text fallback, and SPF/DKIM
verification are all satisfied by the Resend HTTP path. The remaining
literal-goal task (configuring Supabase Auth SMTP → Resend) is **still worth
doing** because:

- We currently issue zero Supabase-Auth-side emails (OAuth-only signup), but
  any future Supabase-side email (account recovery, email-change confirmation,
  Supabase magic-link OTP) would otherwise hit Supabase's default sender and
  fail SPF/DKIM on `theupskillinglabs.org`.
- It's a one-line config item in Supabase Studio; cheap insurance.

**Action when picking this up:** in Supabase Studio → Project Settings →
Auth → SMTP Settings, set:

```
Host:        smtp.resend.com
Port:        587
Username:    resend
Password:    <Resend API key>
Sender:      The Upskilling Labs <noreply@theupskillinglabs.org>
```

The sender domain must be verified in Resend (SPF + DKIM). For local
parity, the `[auth.email.smtp]` block can be added to
[`supabase/config.toml`](../../supabase/config.toml), but local dev already
catches all auth emails in Inbucket on port 54324, so SMTP wiring locally is
unnecessary.

---

## Acceptance criteria — Issue #44

| Criterion | Status | Evidence |
|---|---|---|
| Sign in via Supabase → JWT with correct role claims | ✅ (translated) | Supabase session cookie + [`resolveUserRoles`](./roles.ts) yields `participantId`, role flags, `moderatorPodIds`, `cycleEnrollments` |
| No participants row → clear 404 message | ⚠ Deviation | We **redirect to `/register`** instead. See "404 vs redirect" below |
| JWT contains `participant_id`, `email`, role flags, moderator pods, cycle enrollments | ✅ (translated) | `UserRoles` shape; email lives on the Supabase session |
| All authenticated endpoints validate signature + read claims | ✅ | Supabase verifies the cookie; [`withAuth`/`withAdminAuth`/`withOwnerAuth`](./middleware.ts) consume `UserRoles` |
| OpenAPI spec updated for `POST /auth/google` | ⚠ N/A | No OpenAPI in repo; no `POST /auth/google` (callback is `GET /api/auth/callback`). Document here instead |

### 404 vs redirect

The spec says "no participants row → return 404, complete registration
first." The implementation instead redirects to a built-in `/register` page
(see [`app/(auth)/register/page.tsx`](../../app/(auth)/register/page.tsx))
which posts to [`/api/registrations`](../../app/api/registrations/route.ts).
This is **a deliberate deviation**:

- The spec's 404 path assumes registration happens in a separate channel
  (e.g. a Google Form). Wave 1 ships an in-app registration page anyway,
  making the 404 path dead code.
- A redirect is materially better UX: the user already authenticated; we
  know their email and avatar; we can pre-fill and welcome them.
- Privacy: the spec's 404 leaks "this email is not on the list" to anyone
  who can complete a Google login. A redirect to a registration form
  doesn't.

If the team ever needs the 404 contract back (e.g. a closed cohort with no
self-registration), the change is one branch in
[`app/api/auth/callback/route.ts:139`](../../app/api/auth/callback/route.ts):
return `NextResponse.json({error: "..."}, {status: 404})` instead of redirect.

---

## Acceptance criteria — Issue #45

| Criterion | Status | Evidence |
|---|---|---|
| Test magic-link email arrives within 60s | ⏳ Verify after deploy | Tested locally via Inbucket; production needs a real Resend send |
| Branded sender (`The Upskilling Labs <noreply@…>`) | ✅ Configurable | `RESEND_FROM_EMAIL` env var; default in [`lib/email/index.ts`](../email/index.ts) |
| Body includes magic link + expiration + "you're receiving this because…" | ✅ | [`invitation-template.ts`](../email/invitation-template.ts) — link, "expires in 7 days", footer disclosure |
| Plain-text fallback | ✅ | `invitationEmailText()` in same file |
| Resend SPF / DKIM verified | ⏳ Ops | Verify in Resend dashboard before first prod send |
| Supabase Auth SMTP via Resend | ⏳ Optional, see §Issue #45 above | One-time Studio config |

---

## Local verification

```bash
supabase start                           # boots Postgres, Auth, Inbucket on :54324
cp .env.local.example .env.local         # fill in keys; OWNER_EMAILS=you@example.com
npm run dev
```

End-to-end smoke test:

1. Apply migrations: `supabase db reset` (or `supabase db push`).
2. Seed at least one `participants` row matching your Google email — easiest
   is `supabase db reset && psql … -c "INSERT INTO participants(email, …)"`.
3. Click "Sign in with Google" on `/login`. Approve consent.
4. Confirm callback redirects to `/`. Inspect cookies: `sb-…-auth-token`
   should be set. The owner role should be in `user_roles` if your email is
   in `OWNER_EMAILS`.
5. Hit a guarded endpoint (e.g. `GET /api/cycles`) — should return 200.
6. Sign out, delete the `participants` row, sign in again — should redirect
   to `/register`.

Invitation flow:

1. As an admin, `POST /api/invitations` with `email`, `role_preset`, optional
   `cycle_id` / `pod_id`.
2. Click "Send email" in `/admin/invitations` → check Inbucket at
   `http://localhost:54324` for the rendered Resend email **(local
   Inbucket only catches Supabase-Auth emails; the Resend HTTP path goes to
   real Resend even in dev)**.
3. To test locally without sending real email, point `RESEND_API_KEY` at a
   Resend test key — Resend will accept and discard.
4. Open the magic link in an incognito window. Sign in with Google as the
   invited address. Verify `invitations.status = 'accepted'`,
   `participant_permissions` has the granted rows, and `email_sent_at` is
   populated.

---

## Open ops tasks

These cannot be completed from inside the repo:

- **Google Cloud Console:** create the OAuth 2.0 client; add Supabase
  callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`); set
  authorized JS origins for prod + preview domains. Drop the client_id /
  secret into Supabase Studio under Auth → Providers → Google.
- **Supabase Studio (production project):** Auth → URL Configuration → set
  `Site URL` and add the prod app domain to `Redirect URLs`
  (`https://app.theupskillinglabs.org/api/auth/callback`).
- **Resend:** verify `theupskillinglabs.org` (SPF + DKIM); approve the final
  sender (`noreply@…` vs `invites@…` — currently invites in env example).
- **(Optional, #45)** Configure Supabase SMTP → Resend per §Issue #45 above.

---

## Pointers

- Spec text (still references FastAPI): [`TUL_MVP_Spec.md`](../../TUL_MVP_Spec.md)
  §Authentication and §POST /auth/google
- Schema (invitations / user_roles / participant_permissions): [`SCHEMA.md`](../../SCHEMA.md)
- Permissions matrix: [`lib/auth/permissions.ts`](./permissions.ts) —
  `PERMISSIONS`, `ROLE_PRESETS`, `permissionLabel`
- Tracking issues: #44 (auth wiring), #45 (magic-link delivery), #46 (bulk
  magic-link generator — depends on this folder)
