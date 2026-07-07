"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EntityType } from "@/lib/validations/showcase";

/**
 * Follow / unfollow toggle for any user / pod / project / cycle. Posts to
 * /api/follows (session identity) and reflects the authoritative follower count
 * from the response. Same client-mutation shape as the profile editor: local
 * state for instant feedback, then router.refresh() so any sibling server-
 * rendered counts re-read. Initial state is resolved server-side (no flash).
 */

interface Props {
  targetType: EntityType;
  targetId: number;
  initialFollowing: boolean;
  initialCount: number;
  /** Show the follower count beside the button. */
  showCount?: boolean;
  size?: "sm" | "default";
}

export default function FollowButton({
  targetType,
  targetId,
  initialFollowing,
  initialCount,
  showCount = false,
  size = "default",
}: Props) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function toggle() {
    if (pending) return;
    setPending(true);
    setError(false);
    try {
      const res = await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: targetType, target_id: targetId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(true);
        return;
      }
      setFollowing(!!data.following);
      if (typeof data.followerCount === "number") setCount(data.followerCount);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  const pad = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";

  return (
    <div className="inline-flex items-center gap-2.5">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={following}
        className={`btn ${following ? "btn-ghost" : "btn-teal"} ${pad}`}
      >
        {pending ? "…" : following ? "Following" : "Follow"}
      </button>
      {showCount && (
        <span className="text-sm text-meta tabular-nums">
          {count} {count === 1 ? "follower" : "followers"}
        </span>
      )}
      {error && <span className="text-xs text-red">Try again</span>}
    </div>
  );
}
