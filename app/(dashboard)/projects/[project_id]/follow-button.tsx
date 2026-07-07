"use client";

import * as React from "react";

/**
 * Self-serve follow/unfollow (SECTOR_MODEL §5's IC ladder — following is the
 * zero-friction entry point below project_roles). Optimistic toggle with
 * revert on failure; POST/DELETE /api/projects/[id]/follow own the
 * project_subscriptions row server-side.
 */
export default function FollowButton({
  projectId,
  following: initialFollowing,
}: {
  projectId: number;
  following: boolean;
}) {
  const [following, setFollowing] = React.useState(initialFollowing);
  const [busy, setBusy] = React.useState(false);

  async function toggle() {
    const next = !following;
    setFollowing(next);
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/follow`, {
        method: next ? "POST" : "DELETE",
      });
      if (!res.ok) {
        setFollowing(!next);
      }
    } catch {
      setFollowing(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={
        following
          ? "btn btn-ghost-teal px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          : "btn btn-teal px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
      }
    >
      {following ? "Following ✓" : "Follow"}
    </button>
  );
}
