import { formatDate } from "@/lib/format/date";
import {
  fetchAnnouncements,
  announcementScopeLabel,
} from "@/lib/announcements/data";

/**
 * The right-rail org-news reader (async RSC). Shows published announcements the
 * member can see — global plus their own lab — pinned first, newest first. A
 * compact card list sized for the narrow 1/7 rail.
 */
export default async function AnnouncementsPanel({
  labId,
  labName,
}: {
  labId: number | null;
  labName?: string | null;
}) {
  const items = await fetchAnnouncements({ labId });

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
              <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-charcoal line-clamp-5">
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
