"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Project = { id: number; name: string; total_votes: number };

/**
 * Per-pod counterpart to FinalizeVotingButton: finalizes a pod's solution
 * voting into projects (POST /api/pods/[id]/projects/finalize). Rendered in the
 * admin Projects table for a pod that has solutions but no projects yet.
 */
export default function FinalizeProjectsButton({
  podId,
  podName,
}: {
  podId: number;
  podName: string;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ projects: Project[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function finalize() {
    if (
      !confirm(
        `Finalize solution voting for ${podName} and create its projects? Uses AI to name projects and cannot be undone.`
      )
    )
      return;

    setLoading(true);
    setError(null);
    setResult(null);

    const res = await fetch(`/api/pods/${podId}/projects/finalize`, { method: "POST" });
    setLoading(false);
    if (res.ok) {
      setResult(await res.json());
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to finalize projects");
    }
  }

  if (result) {
    return (
      <span className="text-xs text-teal-deep tabular-nums">
        {result.projects.length} project{result.projects.length !== 1 ? "s" : ""} created
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={finalize}
        disabled={loading}
        className="rounded-card bg-teal/10 px-3 py-1 text-xs font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
      >
        {loading ? "Finalizing…" : "Finalize projects"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red">
          {error}
        </span>
      )}
    </span>
  );
}
