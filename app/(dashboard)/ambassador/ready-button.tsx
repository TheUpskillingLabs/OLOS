"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** "Tell your coordinator you're ready" — all five steps are done. */
export default function ReadyButton({ label }: { label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/ambassadors/ready", { method: "POST" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const json = res ? await res.json().catch(() => null) : null;
      setError(json?.error ?? "Couldn't send that. Try again.");
      return;
    }
    router.refresh();
  };

  return (
    <>
      <button type="button" className="btn btn-teal btn-block btn-lg" onClick={onClick} disabled={busy}>
        {label} →
      </button>
      {error && <p className="amb-error" role="alert">{error}</p>}
    </>
  );
}
