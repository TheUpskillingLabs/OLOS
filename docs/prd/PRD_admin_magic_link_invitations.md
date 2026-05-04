# PRD: Admin Magic Link Invitation Flow

**Status:** Draft — Open Questions Resolved  
**Author:** Madhu  
**System:** OLOS / The Upskilling Labs (TUL)  
**Date:** 2026-05-04

---

## Overview

Admins need a way to invite people to OLOS by uploading a CSV of names or emails. The system resolves emails from names where needed, deduplicates the list, checks whether each person has already logged in, and sends Supabase magic link emails to those who haven't. Invite status is tracked in a new `invitations` table.

---

## Problem Statement

Currently there is no way for an Admin to bulk-invite participants to the platform. Admins must manually send invites one by one or outside the system. This flow automates outreach and ensures only un-logged-in people receive invites, with clear feedback on duplicates and already-active users.

---

## User Story

> As an Admin, I want to upload a CSV of names or emails, have the system check who hasn't logged in yet, deduplicate the list, and send magic link emails to eligible people — so I can efficiently onboard new participants without manual effort.

---

## Scope

**In:**
- New admin UI page in the existing Next.js frontend
- CSV upload (mix of names and/or emails allowed)
- Name-to-email resolution via `participants` table
- Login status check (google_id populated = already logged in)
- Supabase Auth magic link issuance
- Deduplication within the uploaded list
- Invite tracking via new `invitations` table
- Admin feedback UI (results summary per row)
- Past invitation history visible on the page
- Resend action for individual invites
- Automatic `accepted` status update on first login via Supabase Auth webhook

**Out:**
- Non-CSV file formats (Excel, Google Sheets, etc.)
- Registration form itself (separate scope)
- Token refresh logic

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
- Query `invitations` for the most recent row where `email = <resolved_email>` AND `status = 'sent'`.
- If a row exists → mark as **Already Invited** — no duplicate invite sent.

**Eligible for invite:** only emails that pass both checks (not in `auth.users` and no pending `sent` invite) proceed to Step 4.

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

### New table: `invitations`

Tracks each magic link sent. One row per invite attempt per email.

```sql
CREATE TABLE invitations (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR NOT NULL,
    participant_id  INT REFERENCES participants(id) ON DELETE SET NULL,
    invited_by      INT NOT NULL REFERENCES participants(id),
    sent_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    accepted_at     TIMESTAMP,
    -- populated via Supabase Auth webhook when invitee first logs in
    resent_at       TIMESTAMP,
    -- populated when admin resends; updated on each resend
    status          VARCHAR NOT NULL DEFAULT 'sent',
    -- status values: 'sent' | 'accepted' | 'failed'
    resolved_from   VARCHAR,
    -- 'email' | 'name_lookup' — how the email was sourced
    raw_input       VARCHAR,
    -- original row from the CSV (e.g. "Jane Doe" or "jane@example.com")
    notes           TEXT
);
```

**Notes:**
- `participant_id` may be NULL if the invitee has no `participants` row yet (they haven't registered).
- `invited_by` is the Admin's `participant_id` (from JWT claims).
- `status` is updated to `'accepted'` automatically when the invitee first logs in via the magic link. This is triggered via a Supabase Auth webhook (`auth.users` insert / `last_sign_in_at` update) that calls a FastAPI endpoint to update the matching `invitations` row.

### No changes to `participants` table

Invite tracking lives entirely in `invitations`. The `participants` table is not modified by this flow — a `participants` row is only created when the user completes registration (separate flow, out of scope).

---

## UI — Admin Invitations Page

**Route:** `/admin/invitations`

**Access:** Requires `is_admin` or `is_owner` JWT claim.

**Components:**

1. **Upload zone** — drag-and-drop or click-to-browse CSV upload. Shows file name and row count on selection.
2. **Email template editor** — editable subject line and body, pre-populated with the default template. Admin can customise before sending.
3. **Preview panel** — after parse, shows the deduplicated resolved list with each row's resolved email and status before anything is sent. Admin reviews and confirms.
4. **Send button** — triggers the magic link send for all eligible emails.
5. **Results table** — post-send summary with status per row (see Step 5 above).
6. **Download summary** — export results as CSV.
7. **Invitation history** — below the upload zone, a paginated table of all past invitations showing: email, invited by, sent date, resent date (if applicable), accepted date (if applicable), and current status (`sent` / `accepted` / `failed`). Sorted by `sent_at` descending. Refreshes on page load.
8. **Resend action** — each row in the history table has a "Resend" button. Clicking it calls `signInWithOtp` again for that email and creates a new `invitations` row, leaving the original intact.

---

## Acceptance Criteria

- [ ] Admin can upload a CSV with a mix of name rows and email rows
- [ ] Name-only rows are resolved to emails via `participants.first_name` + `participants.last_name` lookup (case-insensitive)
- [ ] Unresolved and ambiguous names are flagged in results — no invite sent
- [ ] Duplicate emails within the CSV are silently eliminated before processing
- [ ] Persons found in `auth.users` are marked "Already Active" — no invite sent
- [ ] Persons with a `sent` row in `invitations` are marked "Already Invited" — no duplicate invite sent
- [ ] Magic links are sent via Supabase Auth `signInWithOtp` for all eligible emails
- [ ] Each sent invite creates a row in `invitations` with correct `email`, `invited_by`, `sent_at`, `status = 'sent'`
- [ ] Admin sees a results summary table after upload is processed
- [ ] Admin can download the results summary as a CSV
- [ ] Page is accessible only to users with `is_admin` or `is_owner` JWT claim
- [ ] Past invitation history is displayed in a paginated table, sorted by `sent_at` descending
- [ ] Resend button triggers a new magic link and creates a new `invitations` row
- [ ] Magic link redirects invitee to `/dashboard` on click
- [ ] `invitations.status` is updated to `accepted` automatically via Supabase Auth webhook when invitee first logs in
- [ ] Login status check queries `auth.users` (not `participants.google_id`) to correctly catch all prior logins
- [ ] Admin can edit the email subject and body before sending; default template is pre-populated
- [ ] Magic link placeholder is always appended by Supabase regardless of template edits

---

## Decisions Log

| # | Question | Decision |
|---|----------|----------|
| 1 | Show past invitation history on this page? | **Yes** — paginated history table below the upload zone |
| 2 | Resend action for individual emails? | **Yes** — per-row Resend button in history table; creates a new `invitations` row |
| 3 | Magic link redirect URL? | **`/dashboard`** |
| 4 | Auto-update `status` to `accepted`? | **Yes** — via Supabase Auth webhook → FastAPI endpoint |

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
