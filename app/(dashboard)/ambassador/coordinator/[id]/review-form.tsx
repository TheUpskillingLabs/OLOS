"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReviewDecision } from "@/lib/ambassador/review";

/** One reviewer's decision on an ambassador application (PATCH action
 *  "review"). The note is for the other reviewers; the applicant never sees it. */
export function ReviewForm({ id, tiebreak }: { id: number; tiebreak: boolean }) {
  const router = useRouter();
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision) return setError("Pick approve or decline.");
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/ambassadors/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "review", decision, note: note.trim() || undefined }),
    }).catch(() => null);
    const json = res ? ((await res.json().catch(() => null)) as { error?: string } | null) : null;
    setBusy(false);
    if (!res?.ok) return setError(json?.error ?? "Couldn't save your review.");
    router.refresh();
  };

  return (
    <form className="amb-panel" style={{ marginTop: 16 }} onSubmit={submit}>
      <h3 className="t-h3">{tiebreak ? "Break the tie" : "Your review"}</h3>
      <p className="t-small">
        {tiebreak
          ? "The two reviews disagree. Yours decides."
          : "Decide on your own. You'll see the other review after you record yours."}
      </p>
      <fieldset style={{ display: "flex", gap: 16, marginTop: 12, border: 0, padding: 0 }}>
        <legend className="sr-only">Decision</legend>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="radio" name="decision" value="approve" checked={decision === "approve"} onChange={() => setDecision("approve")} />
          Approve
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="radio" name="decision" value="decline" checked={decision === "decline"} onChange={() => setDecision("decline")} />
          Decline
        </label>
      </fieldset>
      <label className="t-small" htmlFor={`rv-note-${id}`} style={{ display: "block", marginTop: 12 }}>
        A note for the other reviewers (optional)
      </label>
      <textarea
        id={`rv-note-${id}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={1000}
        rows={3}
        style={{ width: "100%", border: "1px solid var(--rule)", borderRadius: "var(--r)", padding: "10px 14px", fontSize: 16, marginTop: 6 }}
      />
      <div style={{ marginTop: 12 }}>
        <button type="submit" className="btn btn-teal" disabled={busy || !decision}>
          {busy ? "Saving…" : "Record my review"}
        </button>
      </div>
      {error && <p className="amb-error" role="alert">{error}</p>}
    </form>
  );
}
