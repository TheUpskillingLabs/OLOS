import { formatDate } from "@/lib/format/date";
import {
  fetchAnnouncements,
  announcementScopeLabel,
} from "@/lib/announcements/data";

/**
 * The org-news reader (async RSC). Shows published announcements the member can
 * see — global plus their own lab — pinned first, newest first. Two shapes:
 *   - full (right rail, tablet/desktop): titles + clamped bodies + meta.
 *   - compact (phones, above the feed): fewer items, title + one body line —
 *     the condensed strip that keeps org news off the very bottom of a long
 *     single-column page.
 */
export default async function AnnouncementsPanel({
  labId,
  labName,
  limit,
  compact = false,
}: {
  labId: number | null;
  labName?: string | null;
  /** Cap the number of announcements shown (compact strip passes 2). */
  limit?: number;
  /** Condensed phone rendering: title + one-line body. */
  compact?: boolean;
}) {
  const items = await fetchAnnouncements({ labId, limit });

  if (compact) {
    if (items.length === 0) return null;
    return (
      <section className="rounded-card border border-ink/10 bg-white p-4 shadow-card">
        <h2 className="lbl lbl-teal mb-2">Org news</h2>
        <ul className="space-y-2.5">
          {items.map((a) => (
            <li key={a.id} className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-ink">
                {a.pinned && (
                  <span className="mr-1.5 rounded-full bg-teal/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-deep">
                    Pinned
                  </span>
                )}
                {a.title}
              </h3>
              <p className="mt-0.5 truncate text-xs text-charcoal">{a.body}</p>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="rounded-card border border-ink/10 bg-white p-5 shadow-card">
      <h2 className="lbl lbl-teal mb-3">Org news</h2>
      {items.length === 0 ? (
        <p className="text-sm text-meta">No announcements yet.</p>
      ) : (
        <ul className="space-y-4">
          {items.map((a) => (
            <li
              key={a.id}
              className="border-b border-ink/[0.06] pb-4 last:border-0 last:pb-0"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold leading-snug text-ink">
                  {a.title}
                </h3>
                {a.pinned && (
                  <span className="shrink-0 rounded-full bg-teal/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-deep">
                    Pinned
                  </span>
                )}
              </div>
              <p className="mt-1 whitespace-pre-line break-words text-xs leading-relaxed text-charcoal line-clamp-5">
                {a.body}
              </p>
              <p className="mt-1.5 text-[11px] text-meta">
                {a.publishedAt ? formatDate(a.publishedAt) : "Draft"}
                {" · "}
                {announcementScopeLabel(
                  a.labId,
                  a.labId != null ? labName ?? null : null
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
