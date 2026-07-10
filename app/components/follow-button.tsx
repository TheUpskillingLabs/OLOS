"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FollowType } from "@/lib/follows/data";

/**
 * Follow / unfollow toggle for a member or an org page. Optimistic; posts the
 * desired state to /api/follows. `refreshOnChange` re-renders the server tree
 * after a change (used where the follow reshapes what's shown, e.g. so a fresh
 * follow's updates flow into the feed on the next paint).
 */
export default function FollowButton({
  type,
  id,
  initialFollowing,
  size = "md",
  refreshOnChange = false,
}: {
  type: FollowType;
  id: number;
  initialFollowing: boolean;
  size?: "sm" | "md";
  refreshOnChange?: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    const next = !following;
    setFollowing(next);
    setBusy(true);
    try {
      const res = await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, following: next }),
      });
      if (!res.ok) throw new Error();
      if (refreshOnChange) router.refresh();
    } catch {
      setFollowing(!next);
    } finally {
      setBusy(false);
    }
  }

  // Both sizes keep a 44px minimum height (tap-target rule); "sm" only tightens
  // the horizontal footprint + type.
  const pad =
    size === "sm" ? "min-h-11 px-3 py-1.5 text-xs" : "min-h-11 px-4 py-2 text-sm";
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={following}
      className={`btn ${following ? "btn-ghost" : "btn-teal"} ${pad}`}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
