"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/app/components/ui";

/**
 * Cycle-level convenience: finalize solution voting for every pod that still
 * has solutions but no projects, in one action. Loops the eligible pod IDs
 * computed on the server (solutions > 0, projects == 0), calling the same
 * per-pod route FinalizeProjectsButton uses. The route 409s a pod that was
 * already finalized, so a partially-finalized cycle is safe to re-run — those
 * are surfaced as skips rather than errors.
 */
export default function FinalizeAllProjectsButton({
  eligiblePodIds,
}: {
  eligiblePodIds: number[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [summary, setSummary] = useState<
    { created: number; skipped: number; failed: number } | null
  >(null);

  async function finalizeAll() {
    setLoading(true);
    setSummary(null);

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const podId of eligiblePodIds) {
      try {
        const res = await fetch(`/api/pods/${podId}/projects/finalize`, {
          method: "POST",
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          created += Array.isArray(data.projects) ? data.projects.length : 0;
        } else if (res.status === 409) {
          skipped += 1;
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
    }

    setLoading(false);
    setConfirmOpen(false);
    setSummary({ created, skipped, failed });
    router.refresh();
  }

  if (eligiblePodIds.length === 0) {
    return (
      <p className="text-xs text-meta">
        No pods are waiting to be finalized into projects.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={() => setConfirmOpen(true)}
        disabled={loading}
        className="btn btn-teal px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? "Finalizing…"
          : `Finalize all pods (${eligiblePodIds.length})`}
      </button>

      {summary && (
        <span className="text-sm text-charcoal tabular-nums">
          {summary.created} project{summary.created !== 1 ? "s" : ""} created
          {summary.skipped > 0 && `, ${summary.skipped} already done`}
          {summary.failed > 0 && (
            <span className="text-red">, {summary.failed} failed</span>
          )}
          .
        </span>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={finalizeAll}
        loading={loading}
        title="Finalize all pods?"
        confirmLabel="Finalize all"
        body={
          <>
            Creates projects for the{" "}
            <span className="font-medium">{eligiblePodIds.length}</span> pod
            {eligiblePodIds.length !== 1 ? "s" : ""} that have solutions but no
            projects yet, using AI to name them. It cannot be undone.
          </>
        }
      />
    </div>
  );
}
