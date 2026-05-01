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
      <div className="w-full max-w-md rounded-lg border border-whisper bg-ink p-8 text-center shadow-2xl">
        <h2 className="mb-2 text-xl font-semibold tracking-tight text-white">
          Something went wrong
        </h2>
        <p className="mb-6 text-sm text-cloud/60">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="rounded-md bg-teal px-4 py-2 text-sm font-semibold tracking-tight text-white transition-all duration-150 ease-spring hover:bg-teal/80 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
