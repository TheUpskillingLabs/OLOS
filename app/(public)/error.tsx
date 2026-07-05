"use client";

import { useEffect } from "react";

// Error boundary for the public content pages — keeps the public chrome (the
// root error.tsx renders chrome-less). Logs, and offers a retry.
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[PublicError]", error);
  }, [error]);

  return (
    <section className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="t-h3 mb-2 text-ink">Something went wrong</h1>
      <p className="t-small mb-6 text-meta">
        This page hit a snag. Give it another try.
      </p>
      <button onClick={reset} className="btn btn-teal">
        Try again
      </button>
    </section>
  );
}
