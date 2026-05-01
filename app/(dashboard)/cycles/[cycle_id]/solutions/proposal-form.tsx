"use client";

import { useState, useEffect } from "react";

interface Proposal {
  id: number;
  proposal_text: string;
  created_at: string;
}

export default function ProposalForm({
  pods,
}: {
  pods: { id: number; name: string | null }[];
}) {
  const [selectedPodId, setSelectedPodId] = useState(pods[0]?.id ?? 0);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedPodId) return;
    setLoading(true);
    fetch(`/api/pods/${selectedPodId}/solution-proposals`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProposals(data);
      })
      .finally(() => setLoading(false));
  }, [selectedPodId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSubmitting(true);

    try {
      const res = await fetch(
        `/api/pods/${selectedPodId}/solution-proposals`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposal_text: text.trim() }),
        }
      );

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to submit");
        return;
      }

      const created = await res.json();
      setSuccess(true);
      setText("");
      setProposals((prev) => [
        ...prev,
        {
          id: created.id,
          proposal_text: text.trim(),
          created_at: created.created_at,
        },
      ]);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {pods.length > 1 && (
        <div className="space-y-1.5">
          <label
            htmlFor="select-pod"
            className="block text-sm font-medium text-cloud"
          >
            Select pod
          </label>
          <div className="relative">
            <select
              id="select-pod"
              value={selectedPodId}
              onChange={(e) => setSelectedPodId(parseInt(e.target.value, 10))}
              className="block w-full appearance-none rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 pr-9 text-sm text-white transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            >
              {pods.map((pod) => (
                <option key={pod.id} value={pod.id}>
                  {pod.name || `Pod ${pod.id}`}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cloud/60"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden
            >
              <path
                d="M6 8l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      )}

      {pods.length === 1 && (
        <p className="text-sm text-cloud/80">
          Proposing for{" "}
          <span className="font-semibold text-white">
            {pods[0].name || `Pod ${pods[0].id}`}
          </span>
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="proposal_text"
            className="block text-sm font-medium text-cloud"
          >
            Your solution proposal
          </label>
          <textarea
            id="proposal_text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            rows={5}
            required
            placeholder="Describe a solution your pod could build..."
            className="block w-full resize-none rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-cloud/40 transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          />
          <p className="text-right text-xs text-cloud/50 tabular-nums">
            {text.length}/2000
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-red/20 bg-red/10 px-3 py-2 text-sm text-red-300"
          >
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-md border border-teal/20 bg-teal/10 px-3 py-2 text-sm text-aqua">
            Proposal submitted.
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !text.trim()}
          className="rounded-md bg-teal px-4 py-2 text-sm font-semibold tracking-tight text-white shadow-[0_1px_4px_rgba(0,148,160,0.2)] transition-all duration-150 ease-spring hover:bg-teal/80 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
        >
          {submitting ? "Submitting..." : "Submit proposal"}
        </button>
      </form>

      {!loading && proposals.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-cloud/60 tabular-nums">
            Submitted proposals ({proposals.length})
          </h2>
          <div className="space-y-3">
            {proposals.map((p) => (
              <div
                key={p.id}
                className="rounded-md border border-whisper bg-white/[0.02] p-4"
              >
                <p className="text-sm text-cloud/80">{p.proposal_text}</p>
                <p className="mt-2 text-xs text-cloud/60 tabular-nums">
                  {new Date(p.created_at).toLocaleDateString("en-US", {
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
