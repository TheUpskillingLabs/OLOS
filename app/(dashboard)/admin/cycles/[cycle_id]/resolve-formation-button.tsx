"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ResolveResult = {
  pods_dissolved: number;
  projects_dissolved: number;
  enrollments_deactivated: number;
  window: { podsResolvable: boolean; projectsResolvable: boolean };
};

export default function ResolveFormationButton({ cycleId }: { cycleId: number }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResolveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function resolve() {
    if (
      !confirm(
        "Resolve formation? Pods and projects that never reached their minimum size will be marked inactive, and affected members' enrollments reconciled. Only runs after registration windows close."
      )
    )
      return;

    setLoading(true);
    setError(null);
    setResult(null);

    const res = await fetch(`/api/admin/cycles/${cycleId}/resolve-formation`, {
      method: "POST",
    });

    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      setResult(data);
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to resolve formation");
    }
  }

  const nothingDissolved =
    result &&
    result.pods_dissolved === 0 &&
    result.projects_dissolved === 0;

  return (
    <div>
      <button
        onClick={resolve}
        disabled={loading}
        className="btn btn-teal px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Resolving…" : "Resolve formation"}
      </button>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red">
          {error}
        </p>
      )}

      {result && (
        <div
          className={`mt-4 rounded-card border p-4 ${
            nothingDissolved
              ? "border-ink/10 bg-white shadow-card"
              : "border-teal/20 bg-teal/10"
          }`}
        >
          {nothingDissolved ? (
            <p className="text-sm text-charcoal">
              Every pod and project met its minimum size. Nothing was dissolved.
            </p>
          ) : (
            <p className="text-sm text-charcoal tabular-nums">
              Dissolved{" "}
              <span className="font-semibold text-ink">
                {result.pods_dissolved}
              </span>{" "}
              pod{result.pods_dissolved !== 1 ? "s" : ""} and{" "}
              <span className="font-semibold text-ink">
                {result.projects_dissolved}
              </span>{" "}
              project{result.projects_dissolved !== 1 ? "s" : ""}; deactivated{" "}
              <span className="font-semibold text-ink">
                {result.enrollments_deactivated}
              </span>{" "}
              enrollment{result.enrollments_deactivated !== 1 ? "s" : ""}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
