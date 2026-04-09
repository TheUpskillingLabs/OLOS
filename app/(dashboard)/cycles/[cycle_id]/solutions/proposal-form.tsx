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
        <div>
          <label className="mb-1.5 block text-sm font-medium text-cloud/70">
            Select Pod
          </label>
          <select
            value={selectedPodId}
            onChange={(e) => setSelectedPodId(parseInt(e.target.value, 10))}
            className="rounded-md border border-whisper bg-white/[0.04] px-3 py-2 text-white focus:border-teal focus:outline-none"
          >
            {pods.map((pod) => (
              <option key={pod.id} value={pod.id}>
                {pod.name || `Pod ${pod.id}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {pods.length === 1 && (
        <p className="text-sm text-cloud/50">
          Proposing for{" "}
          <span className="font-medium text-white">
            {pods[0].name || `Pod ${pods[0].id}`}
          </span>
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="proposal_text"
            className="mb-1.5 block text-sm font-medium text-cloud/70"
          >
            Your Solution Proposal
          </label>
          <textarea
            id="proposal_text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            rows={5}
            required
            placeholder="Describe a solution your pod could build..."
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
            Proposal submitted successfully!
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !text.trim()}
          className="rounded-md bg-teal px-4 py-2 text-sm font-medium text-midnight transition-colors hover:bg-aqua disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Proposal"}
        </button>
      </form>

      {!loading && proposals.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-cloud/40">
            Submitted Proposals ({proposals.length})
          </h2>
          <div className="space-y-3">
            {proposals.map((p) => (
              <div
                key={p.id}
                className="rounded-md border border-whisper bg-white/[0.02] p-4"
              >
                <p className="text-sm text-cloud/80">{p.proposal_text}</p>
                <p className="mt-2 text-xs text-cloud/40">
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
