# Announcements: schedule go-live, auto-expire, and archive

| | |
|---|---|
| **Date** | 2026-10-09 |
| **Ran by** | AMG (+ Claude Code, https://claude.ai/code/session_01NC3YRJduLLJAZtQ9N8mfxg) |
| **Branch / PR** | `claude/zealous-sagan-0zbjco` · #490 |
| **Asked** | "A way for an admin to archive announcements, schedule announcements (set a go-live date/time), and an expiration date that auto-archives announcements (auto-set to two weeks from creation, but configurable)." |

## What was done

- **Migration `00108_announcement_schedule_expiry.sql`.**
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
- 2026-10-12: `00108` applied to the dev database by hand (per `docs/environments.md`), plus ledger row `00108`. Verified afterwards: column + default, index, the new select rule, and the one existing row still has no expiry. The read rule went in via `ALTER POLICY` because the Supabase connector timed out on `DROP` statements; the result is the same.
- Not verified by me: the UI in a browser. AMG is testing on the preview; the manual steps are in the #490 body.

## Decisions made → where they live

| Decision | Recorded in |
|---|---|
| Go-live reuses `published_at` (no new status or column) | `00108` header; `SCHEMA.md` |
| Visibility enforced at read time; the cron is bookkeeping only | `00108` header; cron route comment |
| Legacy rows get no expiry | `00108` header |
| A scheduled post's untouched default expiry is go-live + 14 days, not creation + 14 days | #490 body (awaiting AMG's confirmation) |

## Follow-ups during review

- First test on the preview hit "An internal error occurred": `00104` hadn't been applied to the dev database, so the `expires_at` write failed. Fixed by applying it (above).
- The meta line showed dates in UTC, date only, which read as if scheduling ran on UTC. It now shows local date + time with the zone, and the form names the timezone. The inputs were already local.
- Renumbered `00104` → `00108`: `dev` gained `00104`–`00106` (ambassadors), and the hand-off brief reserves `00107` for #470. The brief's reservations for lanes S, C and P (`00104`–`00106`) are now taken by the ambassador migrations, so those lanes need new numbers.

## Open questions / needs from others

- AMG: confirm the go-live + 14 days default for scheduled posts.
- AMG: confirm that legacy posts should never expire.
- AMG: confirm that UTC dates in the admin meta line are acceptable.

## Next

- Review and merge #490 into `dev`.
- A maintainer applies `00108` to prod after `dev → main`.
