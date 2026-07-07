"use client";

import { useState, useEffect } from "react";

interface Pod {
  id: number;
  name: string | null;
  status: string;
  registrantCount: number;
  problemStatement: string | null;
  registered: boolean;
}

export default function PodRegistration({
  cycleId,
  initialMyPodIds,
  podLimit = 1,
}: {
  cycleId: number;
  initialMyPodIds: number[];
  /** Per-cycle pods-per-member ceiling (cycle_config.pod_limit; default 1). */
  podLimit?: number;
}) {
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionPodId, setActionPodId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    fetch(`/api/cycles/${cycleId}/pods`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setPods(
            data.map(
              (p: {
                id: number;
                name: string | null;
                status: string;
                registrant_count: number;
                problem_statement_title: string | null;
              }) => ({
                id: p.id,
                name: p.name,
                status: p.status,
                registrantCount: p.registrant_count,
                problemStatement: p.problem_statement_title,
                registered: initialMyPodIds.includes(p.id),
              })
            )
          );
        }
      })
      .finally(() => setLoading(false));
  }, [cycleId, initialMyPodIds]);

  const registeredCount = pods.filter((p) => p.registered).length;

  async function registerForPod(podId: number) {
    setError("");
    setSuccessMsg("");
    setActionPodId(podId);

    try {
      const res = await fetch(`/api/pods/${podId}/register`, {
        method: "POST",
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to register");
        return;
      }

      setSuccessMsg("Registered successfully!");
      setPods((prev) =>
        prev.map((p) =>
          p.id === podId
            ? { ...p, registered: true, registrantCount: p.registrantCount + 1 }
            : p
        )
      );
    } catch {
      setError("Network error. Try again.");
    } finally {
      setActionPodId(null);
    }
  }

  async function unregisterFromPod(podId: number) {
    setError("");
    setSuccessMsg("");
    setActionPodId(podId);

    try {
      const res = await fetch(`/api/pods/${podId}/register`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to unregister");
        return;
      }

      setSuccessMsg("Unregistered successfully.");
      setPods((prev) =>
        prev.map((p) =>
          p.id === podId
            ? {
                ...p,
                registered: false,
                registrantCount: Math.max(0, p.registrantCount - 1),
              }
            : p
        )
      );
    } catch {
      setError("Network error. Try again.");
    } finally {
      setActionPodId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-meta" aria-busy="true">
        <span
          role="status"
          aria-label="Loading"
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink/10 border-t-teal"
        />
        Loading pods...
      </div>
    );
  }

  if (pods.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-meta-soft bg-white p-12">
        <p className="text-sm text-meta">
          No pods available for registration yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-card border border-ink/10 bg-white p-4 shadow-card">
        <p className="lbl">{podLimit === 1 ? "Your pod" : "Registered pods"}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-teal-deep">
          {registeredCount}
        </p>
        <p className="text-xs text-meta tabular-nums">
          {podLimit === 1 ? "one per cycle" : `of ${podLimit} maximum`}
        </p>
      </div>

      {podLimit === 1 && registeredCount >= 1 && (
        <p className="text-xs text-meta">
          You&apos;re in one pod per cycle — leave your current pod to switch.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-card border border-red/20 bg-red/10 px-3 py-2 text-sm text-red"
        >
          {error}
        </p>
      )}
      {successMsg && (
        <p className="rounded-card border border-teal/30 bg-teal/10 px-3 py-2 text-sm text-teal-deep">
          {successMsg}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {pods.map((pod) => (
          <div
            key={pod.id}
            className={`rounded-card border bg-white p-4 transition-colors duration-150 ${
              pod.registered
                ? "border-teal shadow-[inset_0_0_0_1px_var(--teal)]"
                : "border-ink/10 shadow-card hover:border-ink/20"
            }`}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold tracking-tight text-ink">
                  {pod.name || `Pod ${pod.id}`}
                </p>
                <p className="mt-0.5 text-xs text-meta tabular-nums">
                  {pod.registrantCount} member
                  {pod.registrantCount !== 1 ? "s" : ""} &middot; {pod.status}
                </p>
              </div>
              {pod.registered ? (
                <button
                  onClick={() => unregisterFromPod(pod.id)}
                  disabled={actionPodId !== null}
                  className="rounded-card ring-1 ring-ink/10 px-3 py-2 text-xs font-semibold tracking-tight text-charcoal transition-all duration-150 ease-spring hover:bg-ink/[0.04] hover:text-ink hover:ring-ink/20 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                >
                  {actionPodId === pod.id ? "..." : "Leave"}
                </button>
              ) : (
                <button
                  onClick={() => registerForPod(pod.id)}
                  disabled={actionPodId !== null || registeredCount >= podLimit}
                  className="rounded-card bg-teal/10 px-3 py-2 text-xs font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                >
                  {actionPodId === pod.id ? "..." : "Join"}
                </button>
              )}
            </div>
            {pod.problemStatement && (
              <p className="text-xs text-slate">{pod.problemStatement}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
