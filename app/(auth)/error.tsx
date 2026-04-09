"use client";

import { useEffect } from "react";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AuthError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border border-whisper bg-[rgba(11,16,22,0.95)] p-8 text-center">
        <h2 className="mb-2 text-xl font-semibold text-cloud">
          Authentication Error
        </h2>
        <p className="mb-6 text-sm text-muted">
          Something went wrong during authentication.
        </p>
        <button
          onClick={reset}
          className="rounded bg-teal px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-shadow"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
