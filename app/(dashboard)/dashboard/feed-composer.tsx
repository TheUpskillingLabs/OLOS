"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LearningLogCard, { type MilestoneContext } from "./learning-log-card";
import { type BaselineConfig } from "./baseline-section";
import type { PageRef } from "@/lib/pages/authz";

/**
 * The feed composer — one LinkedIn-style card at the top of the community feed
 * holding two options in a single card:
 *   - Update:       a freeform post, Public (→ the members-wide feed) or
 *                   Private (saved, only you). POSTs to /api/posts.
 *   - Learning Log: the weekly ritual / journal (the LearningLogCard, rendered
 *                   chrome-less via `embedded`).
 * Clicking either tab opens its inputs in this same card — nothing navigates
 * away. When the weekly gate is active the Learning Log tab opens by default and
 * the card border goes red, so a locked member (bounced here by the layout gate)
 * lands straight on the form. The card owns the `#learning-log` anchor, so the
 * checklist row and the cycle-page deep links still scroll here — and open the
 * Learning Log tab.
 */
type Tab = "update" | "log";

export default function FeedComposer({
  avatarUrl,
  initials,
  gateActive,
  milestone = null,
  journal = false,
  logCycles = [],
  pendingCycleIds = [],
  postAsPages = [],
  baseline = null,
}: {
  avatarUrl: string | null;
  initials: string;
  gateActive: boolean;
  milestone?: MilestoneContext | null;
  journal?: boolean;
  logCycles?: { id: number; name: string; mode: string }[];
  pendingCycleIds?: number[];
  /** Pages this member can post AS (they admin them). Empty → just "You". */
  postAsPages?: PageRef[];
  /** When set, the Learning Log tab hosts the one-time Baseline Learning Log
      for this cycle and opens by default. */
  baseline?: BaselineConfig | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(
    gateActive || !!baseline ? "log" : "update"
  );
  // "self" or a "type:id" key into postAsPages.
  const [postAs, setPostAs] = useState("self");
  const selectedPage =
    postAs === "self"
      ? null
      : postAsPages.find((p) => `${p.type}:${p.id}` === postAs) ?? null;

  // Deep links to #learning-log (the checklist row, the cycle pages, the
  // top-of-page "log is due" banner) open the Learning Log tab — whether the
  // hash is present on load or set by an in-page click.
  useEffect(() => {
    const openLogOnHash = () => {
      if (window.location.hash === "#learning-log") setTab("log");
    };
    openLogOnHash();
    window.addEventListener("hashchange", openLogOnHash);
    return () => window.removeEventListener("hashchange", openLogOnHash);
  }, []);

  // Freeform post ("Update") state.
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitPost() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const payload = selectedPage
        ? { body: text, as: { type: selectedPage.type, id: selectedPage.id } }
        : { body: text, visibility };
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  const tabClass = (on: boolean) =>
    `min-h-11 flex-1 rounded-card border px-3 py-2 text-sm font-semibold transition-colors duration-150 ${
      on
        ? "border-teal-deep bg-teal-deep text-white"
        : "border-ink/15 bg-white text-charcoal hover:border-teal"
    }`;

  return (
    <section
      id="learning-log"
      className={`scroll-mt-24 rounded-card border bg-white shadow-card ${
        gateActive ? "border-red" : "border-ink/10"
      }`}
    >
      {/* Header — the speaking identity + the two options as a segmented
          control. Posting as a page swaps the avatar for the page's squared
          tile (matching the feed), so it's visible who's talking. */}
      <div className="flex items-center gap-3 border-b border-ink/10 p-4">
        {tab === "update" && selectedPage ? (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-ink text-sm font-bold text-white"
            title={`Posting as ${selectedPage.name}`}
          >
            {selectedPage.name.slice(0, 2).toUpperCase()}
          </div>
        ) : avatarUrl ? (
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
        <div className="flex flex-1 gap-2" role="tablist" aria-label="Composer">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "update"}
            onClick={() => setTab("update")}
            className={tabClass(tab === "update")}
          >
            Update
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "log"}
            onClick={() => setTab("log")}
            className={tabClass(tab === "log")}
          >
            Learning Log
            {gateActive && (
              <span
                className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red align-middle"
                aria-hidden
              />
            )}
          </button>
        </div>
      </div>

      <div className="p-4">
        {tab === "update" ? (
          <div>
            {postAsPages.length > 0 && (
              <label className="mb-2 flex items-center gap-1.5 text-xs text-meta">
                <span className="shrink-0">Post as</span>
                <select
                  value={postAs}
                  onChange={(e) => setPostAs(e.target.value)}
                  className="min-h-11 min-w-0 flex-1 rounded-card border border-ink/15 bg-white px-2 py-2.5 text-xs font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                >
                  <option value="self">You</option>
                  {postAsPages.map((p) => (
                    <option key={`${p.type}:${p.id}`} value={`${p.type}:${p.id}`}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                selectedPage ? `Share an update as ${selectedPage.name}…` : "Share an update…"
              }
              rows={3}
              maxLength={3000}
              className="w-full resize-none rounded-card border border-ink/15 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-meta-soft transition-[border-color,box-shadow] duration-150 focus:border-teal focus:outline-none focus:ring-[3px] focus:ring-teal/15"
            />
            {error && (
              <p className="mt-1 text-xs text-red" role="alert">
                {error}
              </p>
            )}
            <div className="mt-2 flex items-center justify-between gap-2">
              {selectedPage ? (
                <span className="text-xs text-meta">
                  Public · from this page
                </span>
              ) : (
                <label className="flex items-center gap-1.5 text-xs text-meta">
                  <span className="sr-only">Audience</span>
                  <select
                    value={visibility}
                    onChange={(e) =>
                      setVisibility(e.target.value as "public" | "private")
                    }
                    className="min-h-11 rounded-card border border-ink/15 bg-white px-2 py-2.5 text-xs text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                  >
                    <option value="public">Public · everyone at The Labs</option>
                    <option value="private">Private · only you</option>
                  </select>
                </label>
              )}
              <button
                type="button"
                className="btn btn-teal min-h-11 px-4 py-2 text-sm"
                disabled={busy || !body.trim()}
                onClick={submitPost}
              >
                {busy ? "Posting…" : "Post"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* No extra "log is due" alert here — the red border, the tab's red
                dot, and the dashboard's jump-link banner already carry it. */}
            <LearningLogCard
              embedded
              gateActive={gateActive}
              milestone={milestone}
              journal={journal}
              logCycles={logCycles}
              pendingCycleIds={pendingCycleIds}
              baseline={baseline}
            />
          </div>
        )}
      </div>
    </section>
  );
}
