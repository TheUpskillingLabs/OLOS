"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/app/components/ui";

type Pod = {
  id: number;
  name: string;
  problem_statement_id: number;
  total_votes: number;
};

export default function FinalizeVotingButton({ cycleId }: { cycleId: number }) {
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<{ pods: Pod[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function finalize() {
    setLoading(true);
    setError(null);
    setResult(null);

    const res = await fetch(`/api/voting/finalize/${cycleId}`, {
      method: "POST",
    });

    setLoading(false);
    setConfirmOpen(false);
    if (res.ok) {
      const data = await res.json();
      setResult(data);
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to finalize voting");
    }
  }

  return (
    <div>
      <button
        onClick={() => setConfirmOpen(true)}
        disabled={loading}
        className="btn btn-teal px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Finalizing…" : "Finalize pod voting"}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={finalize}
        loading={loading}
        title="Finalize pod voting?"
        confirmLabel="Finalize"
        body="This creates pods from the winning problem statements, using AI to name them. It cannot be undone."
      />

      {error && (
        <p role="alert" className="mt-2 text-sm text-red">
          {error}
        </p>
      )}

      {result && (
        <div
          className={`mt-4 rounded-card border p-4 ${
            result.pods.length > 0
              ? "border-teal/20 bg-teal/10"
              : "border-ink/10 bg-white shadow-card"
          }`}
        >
          {result.pods.length === 0 ? (
            <p className="text-sm text-charcoal">
              No eligible problem statements met the vote threshold.
            </p>
          ) : (
            <>
              <p className="mb-2 text-sm font-semibold tracking-tight text-teal-deep tabular-nums">
                {result.pods.length} pod
                {result.pods.length !== 1 ? "s" : ""} created.
              </p>
              <ul className="space-y-1">
                {result.pods.map((pod) => (
                  <li key={pod.id} className="text-sm text-charcoal">
                    <span className="font-medium text-ink">{pod.name}</span>{" "}
                    &mdash;{" "}
                    <span className="tabular-nums text-teal-deep">
                      {pod.total_votes} votes
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
