# feat(feedback): in-app feedback widget with image attachments

**Branch:** `feat/feedback-widget` → base `feat/poderator-dashboard`

## Summary

Adds a lightweight way for any signed-in user to report a problem from anywhere
in the dashboard, optionally attaching screenshots. A subtle launcher sits in the
bottom-right corner; clicking it opens a centered dialog with a category, a
description, and up to three image attachments.

## What's included

| File | Lines | Purpose |
|---|---|---|
| `supabase/migrations/00029_feedback.sql` | 77 | `feedback` + `feedback_attachments` tables, RLS, private storage bucket |
| `lib/validations/feedback.ts` | 40 | Zod schema + shared attachment limits |
| `app/api/feedback/route.ts` | 84 | `POST /api/feedback` (`withAuth`) |
| `app/components/feedback/feedback-widget.tsx` | 314 | Floating launcher + centered dialog (client) |
| `app/(dashboard)/layout.tsx` | +2 | Mount the widget once for every dashboard page |

## Behaviour

- **Launcher** — a subtle pill fixed bottom-right (`Feedback`), present on every
  dashboard page. Hidden while the dialog is open.
- **Dialog** — centered, dims the page behind it; closes on Esc, backdrop click,
  or the ✕. Fields: category (bug / suggestion / other), description (≤5000
  chars), and attachments.
- **Attachments** — up to 3 images, PNG/JPG/WebP, ≤5MB each, with thumbnail
  previews and per-image remove. Validated client-side and again in the Zod
  schema server-side.
- **Submit** — `POST /api/feedback` with the description, category, current
  `page_url`, and base64 images. Shows a success confirmation, then auto-closes.

## API

`POST /api/feedback` — wrapped in `withAuth` (any authenticated user).

1. Validates the body with `createFeedbackSchema`.
2. Inserts the `feedback` row **as the current user** via `auth.supabase`
   (RLS enforces `auth_user_id = auth.uid()`).
3. Uploads each image to the private `feedback-attachments` bucket via the
   **service client** (bypasses storage RLS), then records a
   `feedback_attachments` row. An attachment failure is logged and skipped — it
   never discards the already-saved feedback text. Response reports
   `attachments_saved`.

## Database (`00029_feedback.sql`)

- `feedback` — `auth_user_id` (FK → `auth.users`), nullable `participant_id`,
  `category` (checked), `description` (1–5000), `page_url`, `status`
  (`open`/`in_review`/`resolved`/`closed`, default `open`), `created_at`.
- `feedback_attachments` — `feedback_id` (cascade), `storage_path`, `mime_type`,
  `size_bytes`.
- **RLS** — authors read their own feedback; admins/owners read all; insert only
  as yourself; status updates are admin/owner only. Attachments are readable by
  whoever can see the parent row; inserts happen via the service client, so no
  authenticated insert policy is granted.
- Creates the private `feedback-attachments` storage bucket (idempotent).
- Reuses existing helpers `is_admin_or_owner()` and `current_participant_id()`.
- Forward-only with a commented `-- DOWN` rollback block, per repo convention.

## Testing

- `npx tsc --noEmit` — passes, no errors.
- `eslint` on all new files — clean (the one `avatarUrl` warning in the layout is
  pre-existing and unrelated).
- Manual: `npm run dev` → open any dashboard page → launcher opens the dialog →
  submit with and without images → confirm rows in dev Studio.

## Migration / deploy notes

- **Dev:** `npx supabase db push` applies `00029` to the linked dev project
  (`cethihabtddiujzayaxe`); dev and local share that DB.
- **Prod (manual):** per the project's manual-migration workflow, `00029` and the
  storage bucket must be applied by hand to prod (`cdbgkgkjnomjnpicaxqe`) before
  merge to main. Bucket privacy must match (`public = false`).
- `00029` is the next free migration number (latest on disk is `00028`).

## Out of scope

- Admin review UI for triaging submitted feedback (read list, change status,
  view attachments via signed URLs) — follow-up PR.
- Email/Slack notification on new submissions.

## Diff — `app/(dashboard)/layout.tsx`

```diff
@@ import LogoutButton from "./components/logout-button";
+import FeedbackWidget from "@/app/components/feedback/feedback-widget";
 import { copy as pulseCopy } from "./pulse-check/copy";
@@ <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
         {children}
       </main>
+      <FeedbackWidget />
     </div>
```
