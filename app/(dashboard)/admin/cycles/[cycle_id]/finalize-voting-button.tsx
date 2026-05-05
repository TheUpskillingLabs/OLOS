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
        className="rounded-md bg-teal px-4 py-2 text-sm font-semibold tracking-tight text-white shadow-[0_1px_4px_rgba(0,148,160,0.2)] transition-all duration-150 ease-spring hover:bg-teal/80 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
      >
        {loading ? "Finalizing…" : "Finalize pod voting"}
      </button>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {result && (
        <div
          className={`mt-4 rounded-md border p-4 ${
            result.pods.length > 0
              ? "border-teal/20 bg-teal/10"
              : "border-whisper bg-white/[0.02]"
          }`}
        >
          {result.pods.length === 0 ? (
            <p className="text-sm text-cloud/80">
              No eligible problem statements met the vote threshold.
            </p>
          ) : (
            <>
              <p className="mb-2 text-sm font-semibold tracking-tight text-aqua tabular-nums">
                {result.pods.length} pod
                {result.pods.length !== 1 ? "s" : ""} created.
              </p>
              <ul className="space-y-1">
                {result.pods.map((pod) => (
                  <li key={pod.id} className="text-sm text-cloud/80">
                    <span className="font-medium text-cloud">{pod.name}</span>{" "}
                    &mdash;{" "}
                    <span className="tabular-nums text-aqua">
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
