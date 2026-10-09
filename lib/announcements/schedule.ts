/**
 * Announcement scheduling — go-live and expiry (00104).
 *
 * The stored lifecycle is still draft → published → archived (00070). Two
 * timestamps layer time on top of 'published':
 *   - published_at = go-live. A published row whose published_at is in the
 *     future is SCHEDULED; it isn't shown until then.
 *   - expires_at   = auto-archive. Once passed, the row drops out of the feed
 *     immediately (read-time filter) and the hourly cron flips it to
 *     'archived'. NULL = never expires.
 *
 * Pure helpers only, so the admin client, the routes and tests share one
 * definition of "live".
 */

/** Default lifetime of a new announcement: two weeks. */
export const DEFAULT_EXPIRY_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export type AnnouncementPhase =
  | "draft"
  | "scheduled"
  | "live"
  | "expired"
  | "archived";

/** The default expiration: DEFAULT_EXPIRY_DAYS after `from` (creation). */
export function defaultExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + DEFAULT_EXPIRY_DAYS * DAY_MS);
}

/**
 * Where a row sits right now. 'expired' is a published row past its
 * expires_at that the cron hasn't swept to 'archived' yet — members already
 * can't see it, so the admin UI groups it with Archived.
 */
export function announcementPhase(
  row: {
    status: "draft" | "published" | "archived";
    published_at: string | null;
    expires_at: string | null;
  },
  now: Date = new Date()
): AnnouncementPhase {
  if (row.status === "draft") return "draft";
  if (row.status === "archived") return "archived";
  const t = now.getTime();
  if (row.expires_at && new Date(row.expires_at).getTime() <= t) {
    return "expired";
  }
  if (row.published_at && new Date(row.published_at).getTime() > t) {
    return "scheduled";
  }
  return "live";
}

/**
 * Cross-field check shared by the create and edit routes. Returns an error
 * message, or null when the window is valid. `goLive` defaults to now when
 * the post goes out immediately.
 */
export function scheduleError(opts: {
  publishing: boolean;
  goLive: string | null;
  expiresAt: string | null;
  now?: Date;
}): string | null {
  const now = (opts.now ?? new Date()).getTime();
  if (!opts.expiresAt) return null;
  const exp = new Date(opts.expiresAt).getTime();
  const start = opts.goLive ? new Date(opts.goLive).getTime() : now;
  if (exp <= start) return "Expiration must be after the go-live time.";
  if (opts.publishing && exp <= now) {
    return "Expiration is in the past — pick a later date to publish.";
  }
  return null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * ISO → the value a <input type="datetime-local"> expects
 * ("YYYY-MM-DDTHH:mm"), in the browser's local time. Client-side only — on
 * the server this would render in the container's timezone.
 */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** A datetime-local value (browser local time) → ISO, or null when empty. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
