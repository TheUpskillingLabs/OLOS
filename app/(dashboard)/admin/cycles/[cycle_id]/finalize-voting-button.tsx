"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Pod = {
  id: number;
  name: string;
  problem_statement_id: number;
  total_votes: number;
};

export default function FinalizeVotingButton({ cycleId }: { cycleId: number }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ pods: Pod[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function finalize() {
    if (
      !confirm(
        "Finalize voting and create pods? This uses AI to name pods and cannot be undone."
      )
    )
      return;

    setLoading(true);
    setError(null);
    setResult(null);

    const res = await fetch(`/api/voting/finalize/${cycleId}`, {
      method: "POST",
    });

    setLoading(false);
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
        onClick={finalize}
        disabled={loading}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {loading ? "Finalizing…" : "Finalize Pod Voting"}
      </button>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {result && (
        <div
          className={`mt-4 rounded-lg border p-4 ${
            result.pods.length > 0
              ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
              : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
          }`}
        >
          {result.pods.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No eligible problem statements met the vote threshold.
            </p>
          ) : (
            <>
              <p className="mb-2 text-sm font-medium text-green-800 dark:text-green-200">
                {result.pods.length} pod
                {result.pods.length !== 1 ? "s" : ""} created.
              </p>
              <ul className="space-y-1">
                {result.pods.map((pod) => (
                  <li
                    key={pod.id}
                    className="text-sm text-green-700 dark:text-green-300"
                  >
                    <span className="font-medium">{pod.name}</span> &mdash;{" "}
                    {pod.total_votes} votes
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
