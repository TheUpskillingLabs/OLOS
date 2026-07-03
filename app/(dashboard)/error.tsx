"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-card border border-ink/10 bg-white p-8 text-center shadow-card-lg">
        <h2 className="t-h3 mb-2 text-ink">
          Something went wrong
        </h2>
        <p className="mb-6 text-sm text-meta">
          We encountered an error loading this page.
        </p>
        <button
          onClick={reset}
          className="btn btn-teal px-4 py-2 text-sm"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
