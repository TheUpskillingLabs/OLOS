"use client";

import { useEffect, useState } from "react";

/* The "Share your story" modal → POST /api/stories, extracted from the
   /stories client so the landing's spotlight row can open the same popup.
   Public and anonymous-friendly — the Labs team edits with the sender
   before anything is published. */

export default function ShareStoryModal({ onClose }: { onClose: () => void }) {
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
