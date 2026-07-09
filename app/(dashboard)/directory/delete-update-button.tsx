"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Delete your own feed post (or a page post you admin). Two-tap: first tap asks
 * "Delete?", second confirms — no modal. DELETEs /api/updates/[id] (author /
 * page-admin authorized server-side) and refreshes so the row disappears.
 */
export default function DeleteUpdateButton({ updateId }: { updateId: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function destroy() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/updates/${updateId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs text-meta transition-colors duration-150 hover:text-red"
      >
        Delete
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-xs">
      <button
        type="button"
        onClick={destroy}
        disabled={busy}
        className="font-semibold text-red hover:underline"
      >
        {busy ? "Deleting…" : "Delete?"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={busy}
        className="text-meta hover:text-charcoal"
      >
        Cancel
      </button>
    </span>
  );
}
