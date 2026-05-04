# PRD: Admin Magic Link Invitation Flow

**Status:** Ready to Build  
**Author:** Madhu  
**System:** OLOS / The Upskilling Labs (TUL)  
**Date:** 2026-05-04

---

## Overview

Admins need a way to invite people to OLOS by uploading a CSV of names or emails. The system resolves emails from names where needed, deduplicates the list, checks whether each person has already logged in, and sends Supabase magic link emails to those who haven't. Invite status is tracked in the existing `invitations` table.

---

## Problem Statement

Currently there is no way for an Admin to bulk-invite participants to the platform. Admins must manually send invites one by one or outside the system. This flow automates outreach and ensures only un-logged-in people receive invites, with clear feedback on duplicates and already-active users.

---

## User Story

> As an Admin, I want to upload a CSV of names or emails, have the system check who hasn't logged in yet, deduplicate the list, and send magic link emails to eligible people — so I can efficiently onboard new participants without manual effort.

---

## Scope

**In:**
- New dedicated admin page at `/admin/bulk-invitations`
- CSV upload (mix of names and/or emails allowed)
- Name-to-email resolution via `participants` table
- Login status check via `auth.users`
- Deduplication within the uploaded list
- Two-step UX: preview results before sending anything
- Supabase Auth magic link issuance
- Invite tracking via existing `invitations` table (with one additive column: `notes`)
- Admin feedback UI (results summary per row)
- Download results as CSV
- Automatic `accepted` status update on first login via Supabase Auth webhook

**Out:**
- Non-CSV file formats (Excel, Google Sheets, etc.)
- Registration form itself (separate scope)
- Token refresh logic
- Invitation history and resend — these remain on the existing `/admin/invitations` page
- Cycle / pod context on invites — separate functionality to be added later

---

## Workflow

### Step 1 — Admin uploads CSV

Admin navigates to **Admin → Invitations** in the OLOS admin UI and uploads a CSV file.

**Accepted CSV format:**

| Column | Required | Notes |
|--------|----------|-------|
| `first_name` | Conditional | Required if `email` is absent |
| `last_name` | Conditional | Required if `email` is absent |
| `email` | Conditional | Required if name columns are absent |

A single CSV may contain rows with names only, emails only, or both. All column headers must match exactly (case-insensitive).

---

### Step 2 — Parse & deduplicate

1. Parse all rows from the CSV.
2. For rows with `first_name` + `last_name` but no `email`, look up the email in `participants` by matching `first_name` (case-insensitive) AND `last_name` (case-insensitive).
   - If a match is found, use the resolved email.
   - If no match is found, mark the row as **Unresolved** — cannot invite.
   - If multiple rows in `participants` match the same name, mark as **Ambiguous** — cannot invite without disambiguation.
3. Normalize all emails to lowercase.
4. Deduplicate the resolved list by email — keep only the first occurrence, discard subsequent duplicates silently.
5. The result is a clean list of unique emails ready for status checking.

---

### Step 3 — Check login and invite status

For each resolved email, run two checks in order:

**Check 1 — Has this person already logged in?**
- Query Supabase Auth (`auth.users`) for a record matching `email = <resolved_email>`.
- If a record exists → mark as **Already Active** — no invite sent.

Note: checking `participants.google_id` alone is insufficient — a user could have logged in via magic link without populating `google_id`. The authoritative source is `auth.users`.

**Check 2 — Has this person already been invited?**
- Query `invitations` for the most recent row where `email = <resolved_email>` AND `status = 'pending'`.
- If a row exists → mark as **Already Invited** — no duplicate invite sent.

**Eligible for invite:** only emails that pass both checks (not in `auth.users` and no pending invite) proceed to Step 4.

---

### Step 4 — Send magic link

For each eligible email:

1. Call Supabase Auth's `signInWithOtp` (magic link) for the email address, with `redirectTo` set to `/dashboard`.
2. Supabase sends a one-time login email to the invitee.
3. On click, the magic link authenticates them via Supabase and redirects them to `/dashboard`.
4. On success, write a row to the `invitations` table (see Data Model below).

---

### Step 5 — Admin results summary

After processing, display a results table in the UI with one row per input entry:

| Input | Resolved Email | Status | Notes |
|-------|---------------|--------|-------|
| Input | Resolved Email | Status | Timestamp | Notes |
|-------|---------------|--------|-----------|-------|
| Jane Doe | jane@example.com | ✅ Invited | 2026-05-04 10:32 | Magic link sent |
| john@example.com | john@example.com | ⚠️ Already Active | 2026-05-04 10:32 | Has logged into OLOS |
| bob@example.com | bob@example.com | ⚠️ Already Invited | 2026-05-04 10:32 | Invite sent 2026-04-28 09:15, not yet logged in |
| Alex Smith | — | ❌ Unresolved | 2026-05-04 10:32 | Name not found in participants |
| Sam Lee | — | ❌ Ambiguous | 2026-05-04 10:32 | Multiple matches found |
| jane@example.com *(duplicate)* | — | ⚠️ Duplicate | 2026-05-04 10:32 | Removed from list |

Admin can download this summary as a CSV.

---

## Data Model

### Existing table: `invitations`

The existing `invitations` table is reused. No structural changes. One additive migration adds a single nullable column:

```sql
ALTER TABLE invitations ADD COLUMN notes TEXT;
```

**Column mapping for the bulk invite flow:**

| Purpose | Column | Notes |
|---------|--------|-------|
| Invitee email | `email` | Lowercased before insert |
| Who sent it | `invited_by` | Admin's `participant_id` from JWT |
| When sent | `created_at` | Auto-set on insert |
| Invite accepted | `accepted_at` | Populated via Supabase Auth webhook |
| Current state | `status` | See status values below |
| Row-level messaging | `notes` | Human-readable explanation for the admin (e.g. "Name not found in participants") |
| Pod / cycle | `pod_id`, `cycle_id` | Always `NULL` in this flow — reserved for future use |
| Permissions | `permissions`, `role_preset` | Always empty / NULL in this flow |

**Status values** (existing CHECK constraint: `'pending'`, `'accepted'`, `'expired'`, `'revoked'`):

| Status | Meaning |
|--------|---------|
| `pending` | Magic link sent, invitee has not yet logged in |
| `accepted` | Invitee logged in — set automatically via Supabase Auth webhook |
| `expired` | Magic link expired without being used |
| `revoked` | Admin cancelled the invitation |

**Resend behaviour:** clicking Resend creates a new `invitations` row for the same email. The original row is left intact. There is no `resent_at` column — each send is its own record.

### No changes to `participants` table

The `participants` table is not modified by this flow — a `participants` row is only created when the user completes registration (separate flow, out of scope).

---

## UI — Bulk Invitations Page

**Route:** `/admin/bulk-invitations`

**Access:** Requires `is_admin` or `is_owner` JWT claim. Linked from the Admin dashboard nav.

**Two-step flow:**

**Step A — Upload & preview**
1. **Upload zone** — drag-and-drop or click-to-browse CSV upload. CSV is parsed client-side and sent to `POST /api/invitations/bulk/preview`. No emails sent yet.
2. **Preview table** — shows one row per input with resolved email and status (`eligible`, `already active`, `already invited`, `unresolved`, `ambiguous`, `duplicate`). Admin reviews before proceeding.
3. **Download preview** — export preview table as CSV.

**Step B — Send**
4. **Send button** — enabled only when at least one row is `eligible`. Shows count of eligible emails. Calls `POST /api/invitations/bulk/send` with the eligible email list.
5. **Results table** — post-send summary showing `invited` or `failed` per email.
6. **Download results** — export results table as CSV.

---

## Acceptance Criteria

- [ ] Page is accessible only to users with `is_admin` or `is_owner` JWT claim
- [ ] Admin can upload a CSV with a mix of name rows and email rows
- [ ] Name-only rows are resolved to emails via `participants.first_name` + `participants.last_name` lookup (case-insensitive)
- [ ] Unresolved and ambiguous names are flagged in preview — no invite sent
- [ ] Duplicate emails within the CSV are eliminated before processing
- [ ] Persons found in `auth.users` are marked "Already Active" in preview — no invite sent
- [ ] Persons with a `pending` row in `invitations` are marked "Already Invited" in preview — no duplicate invite sent
- [ ] Preview is shown to admin before any emails are sent
- [ ] Send button is disabled when no eligible rows exist
- [ ] Magic links are sent via Supabase Auth for all eligible emails only after admin confirms
- [ ] Each sent invite creates a row in `invitations` with correct `email`, `invited_by`, `status = 'pending'`; `pod_id`, `cycle_id`, `permissions`, `role_preset` are left NULL / empty
- [ ] Admin sees a results table after send showing `invited` or `failed` per email
- [ ] Admin can download the preview table as CSV
- [ ] Admin can download the results table as CSV
- [ ] Magic link redirects invitee to `/dashboard` on click
- [ ] `invitations.status` is updated to `'accepted'` automatically via Supabase Auth webhook when invitee first logs in
- [ ] Login status check queries `auth.users` (not `participants.google_id`) to correctly catch all prior logins

---

## Decisions Log

| # | Question | Decision |
|---|----------|----------|
| 1 | Show past invitation history on this page? | **Yes** — paginated history table below the upload zone |
| 2 | Resend action for individual emails? | **Yes** — per-row Resend button in history table; creates a new `invitations` row |
| 3 | Magic link redirect URL? | **`/dashboard`** |
| 4 | Auto-update `status` to `accepted`? | **Yes** — via Supabase Auth webhook → FastAPI endpoint |
| 5 | New table or reuse existing `invitations`? | **Reuse existing** — `pod_id`, `cycle_id`, `permissions`, `role_preset` left NULL/empty for bulk invites |
| 6 | Track `resolved_from` and `raw_input`? | **No** — dropped; all row-level messaging goes into `notes` |
| 7 | Track `resent_at`? | **No** — each resend creates a new row; no dedicated timestamp column needed |
| 8 | Status values? | **Use existing constraint**: `pending` (sent), `accepted` (logged in), `expired` (link expired), `revoked` (admin cancelled) |
| 9 | Cycle / pod context on bulk invites? | **Out of scope for now** — to be added as separate functionality |
| 10 | Live on `/admin/invitations` or separate page? | **Separate page** at `/admin/bulk-invitations` — keeps existing individual invite flow untouched |
| 11 | One-step or two-step send? | **Two-step** — preview first (no emails sent), admin confirms, then send |
| 12 | Show invite history and resend on this page? | **No** — history and resend remain on `/admin/invitations` |

---

## Email Delivery

Supabase Auth sends magic link emails natively using its built-in SMTP. For production, Supabase is configured to use Resend for deliverability (see Decisions Log).

---

## Email Template

### Default template

**Subject:** You're invited to the Open Labs Operating System (OLOS)

**Body:**
> We're excited to welcome you to the Build Cycle!
>
> The Open Labs Operating System (OLOS) is your home base for everything in the cycle — tracking progress, collaborating with your pod, and staying on top of what's happening.
>
> Click the link below to access OLOS and get started:
>
> **[Access OLOS →]** *(magic link inserted here by Supabase)*
>
> See you in there!

---

### Admin-editable template

Before sending, the admin can edit both the subject line and body in the UI. The template above is the default — admins can adjust the message for a specific cohort or cycle without changing the default.

The magic link placeholder is always appended by Supabase and cannot be removed.

**Editable fields:**
- Subject line
- Body text (rich text or plain text)

**Not editable by admin:**
- Sender name (`OLOS`) and sender email (set in Supabase SMTP config)
- The magic link itself
