"use client";

import { useState } from "react";
import Link from "next/link";
import { ThumbsUp, MessageCircle } from "lucide-react";
import type { CommentView } from "@/lib/updates/social";

/**
 * The social bar under a community feed update (profile_updates): a Like toggle
 * and a Comment thread, LinkedIn-style. Seeded with server-fetched state and
 * driven optimistically against /api/updates/[id]/like and .../comments — the
 * feed stays a server component; this island owns the interactivity.
 *
 * A signed-in participant (canInteract) can like, comment, and retract their own
 * comment. A viewer without a participant profile still sees counts + comments,
 * but the controls are inert.
 */

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function Avatar({
  avatarUrl,
  initials,
  name,
  size = "h-8 w-8",
}: {
  avatarUrl: string | null;
  initials: string;
  name?: string;
  size?: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name ?? ""}
        referrerPolicy="no-referrer"
        className={`${size} shrink-0 rounded-full object-cover ring-1 ring-ink/10`}
      />
    );
  }
  return (
    <div
      className={`${size} flex shrink-0 items-center justify-center rounded-full bg-teal-deep text-xs font-bold text-white`}
    >
      {initials}
    </div>
  );
}

export default function UpdateSocial({
  updateId,
  initialLikeCount,
  initialLiked,
  initialComments,
  viewerParticipantId,
  viewerAvatarUrl,
  viewerInitials,
}: {
  updateId: number;
  initialLikeCount: number;
  initialLiked: boolean;
  initialComments: CommentView[];
  viewerParticipantId: number | null;
  viewerAvatarUrl: string | null;
  viewerInitials: string;
}) {
  const canInteract = viewerParticipantId != null;

  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [likeBusy, setLikeBusy] = useState(false);

  const [comments, setComments] = useState<CommentView[]>(initialComments);
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleLike() {
    if (!canInteract || likeBusy) return;
    const next = !liked;
    // Optimistic — reconcile with the server's authoritative count on return.
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    setLikeBusy(true);
    try {
      const res = await fetch(`/api/updates/${updateId}/like`, {
        method: next ? "POST" : "DELETE",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLiked(!!data.liked);
      setLikeCount(typeof data.count === "number" ? data.count : likeCount);
    } catch {
      // Revert on failure.
      setLiked(!next);
      setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
    } finally {
      setLikeBusy(false);
    }
  }

  async function submitComment() {
    const text = draft.trim();
    if (!text || commentBusy) return;
    setCommentBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/updates/${updateId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Couldn't post your comment — try again.");
      }
      const created: CommentView = await res.json();
      setComments((cs) => [...cs, created]);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setCommentBusy(false);
    }
  }

  async function deleteComment(id: number) {
    const prev = comments;
    setComments((cs) => cs.filter((c) => c.id !== id));
    try {
      const res = await fetch(`/api/updates/${updateId}/comments/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
    } catch {
      setComments(prev);
    }
  }

  const commentBtn = (
    <button
      type="button"
      onClick={() => setShowComments((v) => !v)}
      className="flex flex-1 items-center justify-center gap-2 rounded-card px-3 py-2 text-sm font-semibold text-meta transition-colors duration-150 hover:bg-ink/[0.03] hover:text-charcoal"
      aria-expanded={showComments}
    >
      <MessageCircle className="h-4 w-4" aria-hidden />
      Comment
    </button>
  );

  return (
    <div className="mt-3 border-t border-ink/10 pt-2">
      {/* Tallies — only when there's something to count. */}
      {(likeCount > 0 || comments.length > 0) && (
        <div className="flex items-center justify-between px-1 pb-1.5 text-xs text-meta">
          <span>
            {likeCount > 0
              ? `${likeCount} ${likeCount === 1 ? "like" : "likes"}`
              : ""}
          </span>
          {comments.length > 0 && (
            <button
              type="button"
              onClick={() => setShowComments((v) => !v)}
              className="transition-colors duration-150 hover:text-charcoal"
            >
              {comments.length} {comments.length === 1 ? "comment" : "comments"}
            </button>
          )}
        </div>
      )}

      {/* Action bar. */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={toggleLike}
          disabled={!canInteract || likeBusy}
          aria-pressed={liked}
          className={`flex flex-1 items-center justify-center gap-2 rounded-card px-3 py-2 text-sm font-semibold transition-colors duration-150 disabled:cursor-default ${
            liked
              ? "text-teal-deep"
              : "text-meta hover:bg-ink/[0.03] hover:text-charcoal"
          } ${!canInteract ? "opacity-50" : ""}`}
        >
          <ThumbsUp
            className="h-4 w-4"
            fill={liked ? "currentColor" : "none"}
            aria-hidden
          />
          Like
        </button>
        {commentBtn}
      </div>

      {/* Comment thread. */}
      {showComments && (
        <div className="mt-2 space-y-3">
          {canInteract && (
            <div className="flex items-start gap-2">
              <Avatar avatarUrl={viewerAvatarUrl} initials={viewerInitials} />
              <div className="min-w-0 flex-1">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Add a comment…"
                  rows={draft ? 2 : 1}
                  maxLength={1500}
                  className="w-full resize-none rounded-card border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-meta-soft transition-[border-color,box-shadow] duration-150 focus:border-teal focus:outline-none focus:ring-[3px] focus:ring-teal/15"
                />
                {error && (
                  <p className="mt-1 text-xs text-red" role="alert">
                    {error}
                  </p>
                )}
                {draft.trim() && (
                  <div className="mt-1.5 flex justify-end">
                    <button
                      type="button"
                      onClick={submitComment}
                      disabled={commentBusy}
                      className="btn btn-teal px-3 py-1.5 text-xs"
                    >
                      {commentBusy ? "Posting…" : "Comment"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {comments.map((c) => {
            const nameEl = c.handle ? (
              <Link
                href={`/u/${c.handle}`}
                className="text-sm font-semibold text-ink transition-colors duration-150 hover:text-teal-deep"
              >
                {c.name}
              </Link>
            ) : (
              <span className="text-sm font-semibold text-ink">{c.name}</span>
            );
            const avatarEl = (
              <Avatar avatarUrl={c.avatarUrl} initials={c.initials} name={c.name} />
            );
            return (
              <div key={c.id} className="flex items-start gap-2">
                {c.handle ? (
                  <Link href={`/u/${c.handle}`} className="shrink-0">
                    {avatarEl}
                  </Link>
                ) : (
                  avatarEl
                )}
                <div className="min-w-0 flex-1 rounded-card bg-ink/[0.03] px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    {nameEl}
                    <span className="shrink-0 text-xs text-meta tabular-nums">
                      {relTime(c.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-charcoal">
                    {c.body}
                  </p>
                  {c.participantId === viewerParticipantId && (
                    <button
                      type="button"
                      onClick={() => deleteComment(c.id)}
                      className="mt-1 text-xs text-meta transition-colors duration-150 hover:text-red"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
