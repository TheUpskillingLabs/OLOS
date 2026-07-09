"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PageType } from "@/lib/pages/authz";

/**
 * Post an update AS a page, from the page's own detail view. Shown only to the
 * page's admins (the server gates it). POSTs to /api/posts with `as:{type,id}`;
 * the route re-authorizes. On success refreshes so the new post appears in the
 * page's feed below (and in followers' feeds).
 */
export default function PageUpdateComposer({
  pageType,
  pageId,
  pageName,
}: {
  pageType: PageType;
  pageId: number;
  pageName: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, as: { type: pageType, id: pageId } }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Couldn't post — try again.");
      }
      setBody("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-card border border-ink/10 bg-white p-4 shadow-card">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={`Post an update as ${pageName}…`}
        rows={2}
        maxLength={3000}
        className="w-full resize-none rounded-card border border-ink/15 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-meta-soft transition-[border-color,box-shadow] duration-150 focus:border-teal focus:outline-none focus:ring-[3px] focus:ring-teal/15"
      />
      {error && (
        <p className="mt-1 text-xs text-red" role="alert">
          {error}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-meta">Goes to everyone who follows this page</span>
        <button
          type="button"
          className="btn btn-teal px-4 py-2 text-sm"
          disabled={busy || !body.trim()}
          onClick={submit}
        >
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}
