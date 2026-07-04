"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/* The waitlist join CTA — the production twin of the generator lab page's
   wl-cta/wl-cta-aside pair. Signed out: a red link into the auth path
   (production's index.html?join={slug} handoff). Signed in: one tap POSTs the
   signup and the button flips to the generator's joined state — btn-ghost-teal,
   inert, "You're on the list ✓". router.refresh() re-renders the server page so
   the sibling CTA and the waiting counts pick the signup up too. */
export default function JoinButton({
  metroId,
  metroName,
  signedIn,
  joined,
}: {
  metroId: number;
  metroName: string;
  signedIn: boolean;
  joined: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "pending" | "joined">(
    joined ? "joined" : "idle"
  );

  if (!signedIn) {
    return (
      <Link className="btn btn-red btn-block" href="/login">
        Join the {metroName} waitlist
      </Link>
    );
  }

  if (state === "joined") {
    // The generator keeps the joined CTA at full opacity (it strips the href
    // and kills pointer events, no dimming) — the inline opacity overrides
    // the global .btn:disabled fade.
    return (
      <button
        className="btn btn-ghost-teal btn-block"
        disabled
        style={{ opacity: 1 }}
      >
        You’re on the list ✓
      </button>
    );
  }

  const join = async () => {
    setState("pending");
    try {
      const res = await fetch(`/api/metros/${metroId}/waitlist`, {
        method: "POST",
      });
      if (res.ok) {
        setState("joined");
        router.refresh();
        return;
      }
      if (res.status === 403) {
        const body = await res.json().catch(() => null);
        if (body?.redirect) {
          window.location.href = body.redirect;
          return;
        }
      }
      setState("idle");
    } catch {
      setState("idle");
    }
  };

  return (
    <button
      className="btn btn-red btn-block"
      onClick={join}
      disabled={state === "pending"}
    >
      Join the {metroName} waitlist
    </button>
  );
}
