"use client";

import { useEffect, useState } from "react";
import Orb from "@/app/components/chrome/orb";
import type { Spotlight, SpotlightTag } from "@/lib/content/spotlights";

/* Upskiller Spotlights — the client half of /stories (onboarding-proto's
   stories.html): filter chips, expand-in-place cards, #s-{slug} deep links,
   and the "Share your story" modal → POST /api/stories. The published
   spotlights are fetched server-side and passed in. */

const CATS: [string, string][] = [
  ["all", "All stories"],
  ["builder", "Builders"],
  ["mentor", "Mentors"],
  ["career_changer", "Career changers"],
];

const TAG_LABELS: Record<SpotlightTag, string> = {
  builder: "Builder",
  mentor: "Mentor",
  career_changer: "Career changer",
  other: "Story",
};

const Chevron = () => (
  <span className="chev">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  </span>
);

export default function StoriesClient({ spotlights }: { spotlights: Spotlight[] }) {
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [shareOpen, setShareOpen] = useState(false);

  // #s-{slug} deep link (from the landing story row): expand + scroll it.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#s-")) return;
    const slug = hash.slice(3);
    const target = spotlights.find((s) => s.slug === slug);
    if (!target) return;
    // Mount-time sync from the URL hash — one extra render is expected here, and
    // reading the hash in a useState initializer would break hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpanded(new Set([target.id]));
    requestAnimationFrame(() =>
      document.getElementById(`s-${slug}`)?.scrollIntoView({ block: "center" })
    );
  }, [spotlights]);

  const list = spotlights.filter((s) => filter === "all" || s.tag === filter);

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      {/* Share CTA + filter chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CATS.map(([v, label]) => (
            <button
              key={v}
              type="button"
              className={`chip${filter === v ? " active" : ""}`}
              onClick={() => setFilter(v)}
              aria-pressed={filter === v}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="btn btn-red" type="button" onClick={() => setShareOpen(true)}>
          Share your story
        </button>
      </div>

      {list.length ? (
        <div className="spot-grid">
          {list.map((s) => {
            const isOpen = expanded.has(s.id);
            return (
              <div
                key={s.id}
                id={s.slug ? `s-${s.slug}` : undefined}
                className={`card tappable${isOpen ? " expanded" : ""}`}
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                onClick={() => toggle(s.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle(s.id);
                  }
                }}
              >
                <div className={`spot-media ${s.grad || "m-teal"}`} aria-hidden="true">
                  <Orb />
                </div>
                <div className="card-body">
                  <span className="spot-tag">{s.tag_label || TAG_LABELS[s.tag]}</span>
                  {s.quote && (
                    <p className="t-body" style={{ margin: "12px 0 14px" }}>
                      &ldquo;{s.quote}&rdquo;
                    </p>
                  )}
                  <div className="t-h4">{s.name}</div>
                  {s.role && <div className="lbl" style={{ marginTop: 4 }}>{s.role}</div>}
                  {isOpen && s.story.length > 0 && (
                    <div className="spot-story">
                      {s.story.map((p, i) => (
                        <p key={i} className="t-body" style={{ marginBottom: 12 }}>
                          {p}
                        </p>
                      ))}
                    </div>
                  )}
                  {s.story.length > 0 && (
                    <span className="spot-more">
                      {isOpen ? "Show less" : "Read the full story"} <Chevron />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="lcard" style={{ padding: 40, textAlign: "center" }}>
          <div className="t-h3" style={{ marginBottom: 8 }}>
            {spotlights.length ? "No stories in this filter yet" : "The first spotlights are coming"}
          </div>
          <p className="t-body text-meta" style={{ maxWidth: "48ch", margin: "0 auto 18px" }}>
            {spotlights.length
              ? "Try another filter."
              : "Members are sharing what they built and what changed. Yours could be the first one here."}
          </p>
          <button className="btn btn-red" type="button" onClick={() => setShareOpen(true)}>
            Share your story
          </button>
        </div>
      )}

      {/* Closing CTA band */}
      <div className="grain" style={{ background: "var(--ink)", color: "#fff", borderRadius: "var(--r)", marginTop: 48, overflow: "hidden" }}>
        <div style={{ padding: 40, display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>Your turn</div>
            <h2 className="t-h2" style={{ marginBottom: 8 }}>Every spotlight started as a first week</h2>
            <p className="t-body" style={{ color: "var(--od2)" }}>
              Tell the community what you practiced, what broke, and what changed. The Labs
              team edits it with you before anything goes live.
            </p>
          </div>
          <button className="btn btn-red btn-lg" type="button" onClick={() => setShareOpen(true)}>
            Share your story
          </button>
        </div>
      </div>

      {shareOpen && <ShareModal onClose={() => setShareOpen(false)} />}
    </>
  );
}

function ShareModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [story, setStory] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    setError(null);
    if (!name.trim()) return setError("Add your name.");
    if (story.trim().length < 20) return setError("Tell us a little more — a sentence or two.");
    setBusy(true);
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), story: story.trim(), email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong — try again.");
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid var(--rule)",
    borderRadius: "var(--r)",
    padding: 14,
    font: "inherit",
    fontSize: 16,
    background: "var(--white)",
    marginBottom: 14,
  };

  return (
    <div
      className="gate-modal open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="gate-sheet"
        style={{ maxWidth: 460, maxHeight: "86dvh", overflowY: "auto" }}
        role="dialog"
        aria-modal="true"
        aria-label="Share your story"
      >
        <button className="gate-close" type="button" onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 5L17 17M17 5L5 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {done ? (
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <h3 className="t-h3" style={{ marginBottom: 8 }}>Thank you ✓</h3>
            <p className="t-small" style={{ marginBottom: 18 }}>
              The Labs team will follow up before anything goes live.
            </p>
            <button className="btn btn-ghost-teal btn-block" type="button" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <div>
            <h3 className="t-h3" style={{ marginBottom: 6, paddingRight: 32 }}>Share your story</h3>
            <p className="t-small" style={{ marginBottom: 16 }}>
              Spotlights are public once published — the Labs team edits it with you first.
            </p>
            <label className="lbl" htmlFor="share-name" style={{ display: "block", marginBottom: 6 }}>
              Your name
            </label>
            <input
              id="share-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priya Shah"
              style={inputStyle}
            />
            <label className="lbl" htmlFor="share-email" style={{ display: "block", marginBottom: 6 }}>
              Email <span style={{ color: "var(--meta)" }}>(optional — so we can follow up)</span>
            </label>
            <input
              id="share-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
            />
            <label className="lbl" htmlFor="share-story" style={{ display: "block", marginBottom: 6 }}>
              Your story
            </label>
            <textarea
              id="share-story"
              rows={5}
              value={story}
              onChange={(e) => setStory(e.target.value)}
              placeholder="What did you practice? What broke? What changed?"
              style={{ ...inputStyle, resize: "vertical", marginBottom: 16 }}
            />
            {error && (
              <p className="t-small" role="alert" style={{ color: "var(--red)", marginBottom: 12 }}>
                {error}
              </p>
            )}
            <button className="btn btn-teal btn-block" type="button" onClick={submit} disabled={busy}>
              {busy ? "Sending…" : "Send my story"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
