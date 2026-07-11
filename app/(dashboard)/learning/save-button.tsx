"use client";

import { useState } from "react";

/* The bookmark on a Learning card (onboarding-proto's toggleHeart). It sits inside
   the teaser's <Link>, so the click must NOT navigate — preventDefault +
   stopPropagation keep the save local. Optimistic: flip on click, reconcile
   from the server, roll back on failure. Toggle endpoint: POST /api/saved. */

export default function SaveButton({
  itemType,
  slug,
  initialSaved,
}: {
  itemType: "event" | "resource";
  slug: string;
  initialSaved: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const optimistic = !saved;
    setSaved(optimistic);
    try {
      const res = await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_type: itemType, slug }),
      });
      if (!res.ok) throw new Error("save failed");
      const data = (await res.json()) as { saved: boolean };
      setSaved(data.saved);
    } catch {
      setSaved(!optimistic); // roll back
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save"}
      title={saved ? "Saved" : "Save"}
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        zIndex: 2,
        display: "grid",
        placeItems: "center",
        width: 34,
        height: 34,
        borderRadius: 10,
        border: "none",
        cursor: busy ? "default" : "pointer",
        background: saved ? "var(--teal)" : "rgba(255,255,255,.92)",
        color: saved ? "#fff" : "var(--teal-deep)",
        boxShadow: "0 1px 3px rgba(0,0,0,.18)",
        transition: "background .12s ease, color .12s ease",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        aria-hidden="true"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
      </svg>
    </button>
  );
}
