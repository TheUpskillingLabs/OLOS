"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/* The active-lab "Join this lab" CTA (docs/LOCAL_LABS.md — the membership
   spine). Signed out: a link into the auth path. Signed in: one tap POSTs
   /api/labs/[id]/join, sets participants.metro_id, and flips to the joined
   state. router.refresh() re-renders the server page so member-aware chrome
   picks it up. Mirrors join-button.tsx (the waitlist twin). */
export default function JoinActiveButton({
  labId,
  labName,
  signedIn,
  joined,
  className = "btn btn-white",
}: {
  labId: number;
  labName: string;
  signedIn: boolean;
  joined: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "pending" | "joined">(
    joined ? "joined" : "idle"
  );

  if (!signedIn) {
    return (
      <Link className={className} href="/login">
        Join this lab
      </Link>
    );
  }

  if (state === "joined") {
    return (
      <button className={className} disabled style={{ opacity: 1 }}>
        You’re in {labName} ✓
      </button>
    );
  }

  const join = async () => {
    setState("pending");
    try {
      const res = await fetch(`/api/labs/${labId}/join`, { method: "POST" });
      if (res.ok) {
        setState("joined");
        router.refresh();
        return;
      }
      const body = await res.json().catch(() => null);
      if (body?.redirect) {
        window.location.href = body.redirect;
        return;
      }
      setState("idle");
    } catch {
      setState("idle");
    }
  };

  return (
    <button
      className={className}
      onClick={join}
      disabled={state === "pending"}
    >
      Join this lab
    </button>
  );
}
