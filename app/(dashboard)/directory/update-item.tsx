"use client";

import Link from "next/link";
import type { FeedItemView } from "@/lib/updates/feed";
import UpdateSocial from "./update-social";
import DeleteUpdateButton from "./delete-update-button";

/** The viewer identity the social bar needs (serializable, from the server shell). */
export interface FeedViewer {
  participantId: number | null;
  avatarUrl: string | null;
  initials: string;
}

/**
 * One community-feed post card. Fully driven by the serializable FeedItemView
 * (lib/updates/feed.ts) so the same card renders the server-fetched first page
 * and the client-paged follow-ups. `timeLabel` was computed at fetch time —
 * never recompute relative time here, or SSR and hydration will disagree.
 */
export default function UpdateItem({
  item,
  viewer,
  onDeleted,
}: {
  item: FeedItemView;
  viewer: FeedViewer;
  onDeleted?: (updateId: number) => void;
}) {
  const a = item.author;
  return (
    <li className="rounded-card border border-ink/10 bg-white p-4 shadow-card">
      <div className="flex items-start gap-3">
        {a.kind === "user" ? (
          a.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={a.avatarUrl}
              alt={a.name}
              className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-ink/10"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-deep text-xs font-bold text-white">
              {a.initials}
            </div>
          )
        ) : (
          // Pages get a squared tile so they read as an org, not a person.
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ink text-xs font-bold text-white">
            {a.initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0">
              {a.link ? (
                <Link
                  href={a.link}
                  className="block truncate text-sm font-semibold text-ink transition-colors duration-150 hover:text-teal-deep"
                >
                  {a.name}
                </Link>
              ) : (
                <span className="block truncate text-sm font-semibold text-ink">
                  {a.name}
                </span>
              )}
              {a.typeLabel && (
                <span className="text-[11px] font-medium uppercase tracking-wide text-meta">
                  {a.typeLabel}
                </span>
              )}
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-meta tabular-nums">
              {item.visibility === "private" && (
                <span className="rounded-full bg-ink/[0.06] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-meta">
                  Only you
                </span>
              )}
              {item.timeLabel}
            </span>
          </div>
          <p className="mt-1 whitespace-pre-line break-words [overflow-wrap:anywhere] text-sm leading-relaxed text-charcoal">
            {item.body}
          </p>
          {item.canDelete && (
            <div className="mt-2">
              <DeleteUpdateButton updateId={item.id} onDeleted={onDeleted} />
            </div>
          )}
        </div>
      </div>
      {/* Private posts are author-only — a like/comment bar would be
          dead controls no one else can ever see. */}
      {item.visibility !== "private" && (
        <UpdateSocial
          updateId={item.id}
          initialLikeCount={item.likeCount}
          initialLiked={item.likedByViewer}
          initialComments={item.comments}
          viewerParticipantId={viewer.participantId}
          viewerAvatarUrl={viewer.avatarUrl}
          viewerInitials={viewer.initials}
        />
      )}
    </li>
  );
}
