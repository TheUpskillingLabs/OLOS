# Announcements: schedule go-live, auto-expire, and archive

| | |
|---|---|
| **Date** | 2026-10-09 |
| **Ran by** | AMG (+ Claude Code, https://claude.ai/code/session_01NC3YRJduLLJAZtQ9N8mfxg) |
| **Branch / PR** | `claude/zealous-sagan-0zbjco` · #490 |
| **Asked** | "A way for an admin to archive announcements, schedule announcements (set a go-live date/time), and an expiration date that auto-archives announcements (auto-set to two weeks from creation, but configurable)." |

## What was done

- **Migration `00104_announcement_schedule_expiry.sql`.**
  - Adds `announcements.expires_at`. Legacy rows stay NULL, which means they never expire.
  - New inserts default to `now() + 14 days`.
  - The member select policy now admits only live rows: published, past go-live, not expired.
- **Go-live reuses `published_at`.** A future value on a published row means the post is scheduled.
- **`lib/announcements/schedule.ts`** (tested in `schedule.test.ts`) holds the shared helpers:
  - `announcementPhase()` (draft / scheduled / live / expired / archived);
  - `defaultExpiry()`;
  - `scheduleError()`, the window validation;
  - datetime-local conversion.
- **API** (`app/api/admin/announcements/route.ts`, `[id]/route.ts`):
  - accepts `published_at` / `expires_at` (`lib/validations/announcement.ts`);
  - validates the window;
  - defaults expiry to two weeks from creation.
- **Feed** (`lib/announcements/data.ts`) filters on go-live and expiry at read time.
- **Expiry sweep:** `app/api/cron/announcement-expiry/route.ts` runs hourly (`vercel.json`) and flips expired rows to `archived`.
- **Admin UI** (`app/(dashboard)/admin/announcements/announcements-admin.tsx`, also used by `/lab/[slug]`):
  - posts grouped as Live / Scheduled / Drafts / Archived;
  - Go live and Expires fields, plus "Never expires";
  - Schedule / Publish now / Archive / Restore to draft buttons.
- **Docs:** `SCHEMA.md`, `docs/ARCHITECTURE.md` (cron count), `docs/roadmap/2026-09-audit.md` §4.2, `CHANGELOG.md`.

## What was verified

- `npm run test`: 660 passed.
- `npm run lint`: 0 errors. The 8 warnings are in untouched files.
- `npm run build`, `npm run check:docs` and `npm run check:migrations` pass.
- Not verified: the migration was only static-checked (it has not been applied to a database), and the UI was not exercised in a browser. The manual test steps are in the #490 body.

## Decisions made → where they live

| Decision | Recorded in |
|---|---|
| Go-live reuses `published_at` (no new status or column) | `00104` header; `SCHEMA.md` |
| Visibility enforced at read time; the cron is bookkeeping only | `00104` header; cron route comment |
| Legacy rows get no expiry | `00104` header |
| A scheduled post's untouched default expiry is go-live + 14 days, not creation + 14 days | #490 body (awaiting AMG's confirmation) |

## Open questions / needs from others

- AMG: confirm the go-live + 14 days default for scheduled posts.
- AMG: confirm that legacy posts should never expire.
- AMG: confirm that UTC dates in the admin meta line are acceptable.

## Next

- Review and merge #490 into `dev`.
- A maintainer applies `00104` to prod after `dev → main`.
