# `feature/magic-link-email` vs `main` — Diff Summary

**Date:** 2026-05-08
**Status:** PR #60 squash-merged. Branch content is on main as of `584af5c`. 6 follow-up commits by MJ landed directly on main after the merge.

---

## What happened (chronology)

1. MJ implemented the magic-link feature on `feature/magic-link-email` (6 commits: PRDs, migrations, Resend integration, build fix).
2. This session added 4 commits to the same branch (rebase + migration renumber + audit sub-doc + roadmap status tracker).
3. **PR #60 was opened and squash-merged to `main`** as commit `584af5c` ("Add magic link email sending for invitations (#60)") on May 7, authored by MJ. All 10 branch commits collapsed into one.
4. MJ continued working **directly on `main`** with 6 follow-up commits (bug fixes + UX polish).
5. The remote `feature/magic-link-email` branch was deleted by the merge.

The **local branch is now stale** — its content matches main as of the squash commit, but main has 6 commits ahead. It can be safely deleted (`git branch -D feature/magic-link-email`) once this review is complete.

---

## What MJ added directly on main after the merge (6 commits)

These are the changes that didn't go through PR review — landed straight to main. **This is what you wanted to audit.**

### Bug fixes (3)

#### `3fe634c` — fix: skip expired pending invites in duplicate invite check
**File:** [`app/api/invitations/route.ts`](../app/api/invitations/route.ts)
**Change:** added `.gt("expires_at", new Date().toISOString())` to the duplicate-invite check so an expired pending invite no longer blocks a new invite to the same email.

**Verdict:** ✅ Aligned. Plain bug fix — the original check was too strict.

#### `cfcf57a` — fix: derive app URL from request host for magic link
**File:** [`app/api/invitations/[invitation_id]/send/route.ts`](../app/api/invitations/[invitation_id]/send/route.ts)
**Change:** dropped the brittle env-var fallback chain (`NEXT_PUBLIC_APP_URL` → derived from Supabase URL → hardcoded `app.theupskillinglabs.org`) and now derives `appUrl` from the incoming request's `host` header.

**Verdict:** ✅ Aligned and an improvement. The previous fallback chain assumed Vercel-style domains; the new approach Just Works on any host (preview deploys, custom domains, localhost).

**Worth flagging:** the new derivation uses `_request.headers.get("host")` — relies on `_request` being passed correctly. Verify the underscore-prefix convention on the param hasn't muted any linter that would have caught a future regression.

#### `a57ccaf` — fix: scope duplicate invite check to email + cycle + role
**File:** [`app/api/invitations/route.ts`](../app/api/invitations/route.ts)
**Change:** the duplicate check now keys on `(email, cycle_id, role_preset)` rather than just `email`. So you can invite `someone@x.com` as a Moderator for cycle 5 *and* as an Observer for cycle 6 without the second invite being rejected as a duplicate.

**Verdict:** ✅ Aligned and well-scoped. Builds on `3fe634c`.

**Worth flagging:** this changes 409 semantics. Any UI surface that reports "this email already has a pending invite" should now say "this email already has a pending invite **for the same cycle and role**." The error message in the route was updated to match (`"A pending invitation already exists for this email with the same cycle and role"`), but check the admin UI doesn't paraphrase elsewhere.

### UX / polish (3)

#### `7ff5492` — fix: set from display name and update invite email subject
**Files:** [`app/api/invitations/[invitation_id]/send/route.ts`](../app/api/invitations/[invitation_id]/send/route.ts), [`lib/email/index.ts`](../lib/email/index.ts)
**Change:**
- Subject: *"You're invited to The Upskilling Labs"* → *"Invitation to Open Labs Operating System"*
- From: bare email → `Upskilling Labs <invites@theupskillinglabs.org>` (proper RFC-5322 display name)

**Verdict:** ⚠ **Subject line is potentially off-brand.** "Open Labs Operating System" expands the OLOS acronym to a name that doesn't appear in any other user-facing copy I can find — `TUL_MVP_Spec.md` calls it "OLOS" or "The Upskilling Labs"; the email body, the login page, and the brand all use "The Upskilling Labs." A recipient seeing "Open Labs Operating System" in the inbox alongside other "Upskilling Labs" comms would be confused. Worth confirming whether this rebrand is intentional.

The display-name addition is correct.

#### `b86f855` — feat: add Google login note to invitation email
**File:** [`lib/email/invitation-template.ts`](../lib/email/invitation-template.ts)
**Change:** added a footer note in both HTML and plaintext: *"Note: you can only sign in using a Google-hosted email address (Gmail or Google Workspace)."*

**Verdict:** ✅ Aligned and important. Pre-empts the "I clicked the link, signed in with my Outlook/Yahoo account, and got an error" support load. Sets expectations correctly for Google-OAuth-only sign-in (deviation from spec: spec says magic-link OTP; we say OAuth-only).

#### `09adc4d` — feat: send email on create, remove copy link, revoke accepted invites
**Files:** [`app/(dashboard)/admin/invitations/invitations-table.tsx`](../app/(dashboard)/admin/invitations/invitations-table.tsx), [`app/api/invitations/[invitation_id]/route.ts`](../app/api/invitations/[invitation_id]/route.ts)
**Changes:**
- Creating an invitation **now auto-sends the email** in the same UI action — no separate "Send email" button after creation
- "Copy link" button **removed**
- Revocation is now allowed for `accepted` invites (not just `pending`)

**Verdict:** ⚠ **Material UX shift worth flagging.** This deviates from the PRD that said "two-step UX (preview then send)" (commit `e09df76` PRD update). The team explicitly chose two-step earlier; now it's one-step. If that re-decision is intentional, document it. If not, this is a regression worth reverting or revisiting.

The "remove copy link" half is more defensible — copy-link tempted admins to share via Slack DM, defeating the email-match anti-forwarding check in `fulfillInvitation()`. Removing it pushes everyone through the proper email path.

The "revoke accepted invites" half is small but consequential. It means an admin can effectively retroactively un-grant permissions that were already accepted. Worth confirming that invalidating an accepted invite **also strips the granted permissions** (the route at [`app/api/invitations/[invitation_id]/route.ts`](../app/api/invitations/[invitation_id]/route.ts) only updates `invitations.status`, not `participant_permissions` — so this might *not* actually revoke access, just hide the audit row).

---

## Pre-merge content (now in main as `584af5c`)

For completeness, the squashed commit contains:
- MJ's PRDs (added then removed during planning)
- The `invitations.notes` and `invitations.email_sent_at` migrations (renumbered to 00013/00014 in this session)
- The Resend HTTP integration (`lib/email/{index,invitation-template}.ts`, `app/api/invitations/{[invitation_id]/send/route.ts,route.ts}`, admin UI)
- This session's `lib/auth/CLAUDE.md` sub-doc + audit additions
- This session's roadmap status tracker update

`git show 584af5c --stat` shows the full file list.

---

## Alignment with the larger vision

The 6 post-merge commits **do not introduce new architectural deviations**. They refine the existing implementation:

| Architectural choice (from `lib/auth/CLAUDE.md`) | Affected by these commits? |
|---|---|
| Direct Resend HTTP API (not Supabase SMTP) | No |
| Custom-token invitations (not Supabase magic-link OTP) | No |
| Google OAuth-only sign-in | Reinforced — `b86f855` adds explicit user-facing note |
| `@supabase/ssr` session cookie (not FastAPI JWT) | No |
| 404 → redirect to `/register` for missing-participant | No |

The two findings worth team discussion are pure UX / brand:

1. **Subject line "Invitation to Open Labs Operating System"** (commit `7ff5492`) — rebrand or accident?
2. **Auto-send on create + remove copy link** (commit `09adc4d`) — reverses an earlier PRD decision; was that intentional?

Plus one possible bug:

3. **Revoking accepted invites** (commit `09adc4d`) — does it strip granted permissions or only update the row's `status`? Verify before relying on it.

---

## Recommended next moves

1. Decide on findings 1, 2, 3 above.
2. Delete the local stale branch once you've reviewed: `git branch -D feature/magic-link-email`. Or keep it for record-keeping.
3. Move on to the open ops checklist in [`lib/auth/CLAUDE.md`](../lib/auth/CLAUDE.md) §Open ops tasks — Google Cloud OAuth client + Supabase Studio config + Resend domain verification.
