"use client";

import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[RootError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md p-8 text-center shadow-card">
        <h2 className="t-h3 mb-2">Something went wrong</h2>
        <p className="t-small mb-6">An unexpected error occurred. Try again.</p>
        <button onClick={reset} className="btn btn-teal">
          Try again
        </button>
      </div>
    </div>
  );
}
