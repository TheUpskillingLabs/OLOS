"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The feed composer — a LinkedIn-style "Share an update" box at the top of the
 * community feed. A post is a freeform entry that is either Public (→ the
 * members-wide community feed) or Private (saved, only you). POSTs to
 * /api/posts, then refreshes so the new post appears in the feed below.
 */
export default function PostComposer({
  avatarUrl,
  initials,
}: {
  avatarUrl: string | null;
  initials: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
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
        body: JSON.stringify({ body: text, visibility }),
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
    <section className="rounded-card border border-ink/10 bg-white p-4 shadow-card">
      <div className="flex items-start gap-3">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-ink/10"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-deep text-sm font-bold text-white">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share an update…"
            rows={body ? 3 : 1}
            maxLength={3000}
            className="w-full resize-none rounded-card border border-ink/15 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-meta-soft transition-[border-color,box-shadow] duration-150 focus:border-teal focus:outline-none focus:ring-[3px] focus:ring-teal/15"
          />
          {error && (
            <p className="mt-1 text-xs text-red" role="alert">
              {error}
            </p>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-xs text-meta">
              <span className="sr-only">Audience</span>
              <select
                value={visibility}
                onChange={(e) =>
                  setVisibility(e.target.value as "public" | "private")
                }
                className="rounded-card border border-ink/15 bg-white px-2 py-1.5 text-xs text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                <option value="public">Public · everyone at The Labs</option>
                <option value="private">Private · only you</option>
              </select>
            </label>
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
      </div>
    </section>
  );
}
