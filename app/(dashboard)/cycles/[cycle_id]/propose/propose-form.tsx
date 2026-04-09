"use client";

import { useState, useEffect } from "react";

interface Submission {
  id: number;
  statement_text: string;
  created_at: string;
}

export default function ProposeForm({ cycleId }: { cycleId: number }) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/problem-statements/${cycleId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          // Filter to show only current user's submissions
          // The API returns all for the cycle; we'll show them all as context
          setSubmissions(data);
        }
      })
      .finally(() => setLoading(false));
  }, [cycleId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSubmitting(true);

    try {
      const res = await fetch("/api/problem-statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycle_id: cycleId, statement_text: text.trim() }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to submit");
        return;
      }

      const created = await res.json();
      setSuccess(true);
      setText("");
      setSubmissions((prev) => [
        ...prev,
        { id: created.id, statement_text: text.trim(), created_at: created.created_at },
      ]);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="statement_text"
            className="mb-1.5 block text-sm font-medium text-cloud/70"
          >
            Your Problem Statement
          </label>
          <textarea
            id="statement_text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            rows={5}
            required
            placeholder="Describe a problem you'd like the community to explore..."
            className="w-full rounded-md border border-whisper bg-white/[0.04] px-3 py-2 text-white placeholder:text-cloud/30 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          />
          <p className="mt-1 text-xs text-cloud/40">
            {text.length}/2000 characters
          </p>
        </div>

        {error && (
          <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        {success && (
          <p className="rounded-md bg-teal/10 px-3 py-2 text-sm text-aqua">
            Problem statement submitted successfully!
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !text.trim()}
          className="rounded-md bg-teal px-4 py-2 text-sm font-medium text-midnight transition-colors hover:bg-aqua disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Problem Statement"}
        </button>
      </form>

      {/* Existing submissions */}
      {!loading && submissions.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-cloud/40">
            Submitted Problem Statements ({submissions.length})
          </h2>
          <div className="space-y-3">
            {submissions.map((s) => (
              <div
                key={s.id}
                className="rounded-md border border-whisper bg-white/[0.02] p-4"
              >
                <p className="text-sm text-cloud/80">{s.statement_text}</p>
                <p className="mt-2 text-xs text-cloud/40">
                  {new Date(s.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
