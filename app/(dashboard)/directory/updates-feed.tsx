import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { EmptyState } from "@/app/components/ui";

/**
 * Community updates — the reader that finally pays off the Learning Log's
 * "share to Discover" toggle (migration 00040's `profile_updates`). The prototype
 * ran this as Discover's "Community updates" list.
 *
 * Members-only "All" feed this phase (Following is Phase 5). We read through the
 * service client with a poster allowlist (name/handle/avatar only) rather than a
 * cookie-bound `profile_updates` SELECT + a participants join, so no PII column is
 * ever in reach — the same posture the directory grid uses.
 *
 * Two shapes:
 *   - feed:  the whole 'labs'-visibility stream (on /directory).
 *   - member: one member's shared updates (on /u/[handle] and owner /profile).
 * Owner mode gets a lightweight retract control (the RLS already permits the
 * self-DELETE); it renders as a client island passed via `retractSlot`.
 */

const PAGE = 30;

export interface UpdatesFeedProps {
  /** Scope to a single member (their shared updates). Omit for the full feed. */
  participantId?: number;
  title?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Owner mode: render a per-row retract control. */
  renderRetract?: (updateId: number) => React.ReactNode;
}

interface Poster {
  handle: string | null;
  preferred_name: string | null;
  first_name: string | null;
  last_name: string | null;
  profile_image_url: string | null;
}

interface UpdateRow {
  id: number;
  participant_id: number;
  body: string;
  created_at: string;
  participants: Poster | Poster[] | null;
}

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default async function UpdatesFeed({
  participantId,
  title = "Community updates",
  emptyTitle = "No updates yet",
  emptyDescription = "When members share a Learning Log to the community, it shows up here.",
  renderRetract,
}: UpdatesFeedProps) {
  const service = createServiceClient();
  // !inner so the poster filter (global feed) applies as a join predicate.
  let query = service
    .from("profile_updates")
    .select(
      "id, participant_id, body, created_at, participants:participant_id!inner(handle, preferred_name, first_name, last_name, profile_image_url)"
    )
    .eq("visibility", "labs")
    .order("created_at", { ascending: false })
    .limit(PAGE);

  if (participantId != null) {
    // Member-scoped (a profile's own shares) — already access-controlled by the
    // page; don't hide internal accounts here or a staff owner wouldn't see
    // their own shares.
    query = query.eq("participant_id", participantId);
  } else {
    // Global community feed — hide internal (test/staff) posters, matching the
    // directory grid.
    query = query
      .eq("participants.is_test", false)
      .eq("participants.is_staff", false);
  }

  const { data } = await query;
  const rows = (data ?? []) as unknown as UpdateRow[];

  return (
    <section>
      <h2 className="section-head mb-3">{title}</h2>
      {rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <ul className="space-y-3">
          {rows.map((u) => {
            const p = Array.isArray(u.participants)
              ? u.participants[0]
              : u.participants;
            const name =
              p?.preferred_name ||
              [p?.first_name, p?.last_name].filter(Boolean).join(" ") ||
              "A member";
            const initials =
              `${p?.first_name?.[0] ?? ""}${p?.last_name?.[0] ?? ""}`.toUpperCase() ||
              "•";
            const posterLink = p?.handle ? `/u/${p.handle}` : null;
            return (
              <li
                key={u.id}
                className="rounded-card border border-ink/10 bg-white p-4 shadow-card"
              >
                <div className="flex items-start gap-3">
                  {p?.profile_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.profile_image_url}
                      alt={name}
                      className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-ink/10"
                    />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-deep text-xs font-bold text-white">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      {posterLink ? (
                        <Link
                          href={posterLink}
                          className="text-sm font-semibold text-ink transition-colors duration-150 hover:text-teal-deep focus-visible:outline-none focus-visible:text-teal-deep"
                        >
                          {name}
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold text-ink">
                          {name}
                        </span>
                      )}
                      <span className="shrink-0 text-xs text-meta tabular-nums">
                        {relTime(u.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-charcoal">
                      {u.body}
                    </p>
                    {renderRetract && (
                      <div className="mt-2">{renderRetract(u.id)}</div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
