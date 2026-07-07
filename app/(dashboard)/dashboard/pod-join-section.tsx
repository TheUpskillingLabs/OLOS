"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Pod {
  id: number;
  name: string;
  status: string;
  problem_statement_id: number | null;
  member_count?: number;
}

export default function PodJoinSection({
  cycleId,
  participantId,
  myPodIds: initialMyPodIds,
  podLimit = 1,
}: {
  cycleId: number;
  participantId: number;
  myPodIds: number[];
  /** Per-cycle pods-per-member ceiling (cycle_config.pod_limit; default 1). */
  podLimit?: number;
}) {
  const router = useRouter();
  const [pods, setPods] = useState<Pod[]>([]);
  const [myPodIds, setMyPodIds] = useState<Set<number>>(
    new Set(initialMyPodIds)
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionPodId, setActionPodId] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/cycles/${cycleId}/pods`)
      .then((r) => r.json())
      .then((data) => {
        const activePods = (data.pods || data || []).filter(
          (p: Pod) => p.status === "forming" || p.status === "active"
        );
        setPods(activePods);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [cycleId]);

  const handleJoin = async (podId: number) => {
    setActionPodId(podId);
    const res = await fetch(`/api/pods/${podId}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      setMyPodIds((prev) => new Set([...prev, podId]));
      router.refresh();
    }
    setActionPodId(null);
  };

  const handleWithdraw = async (podId: number) => {
    setActionPodId(podId);
    const res = await fetch(`/api/pods/${podId}/register`, {
      method: "DELETE",
    });

    if (res.ok) {
      setMyPodIds((prev) => {
        const next = new Set(prev);
        next.delete(podId);
        return next;
      });
      router.refresh();
    }
    setActionPodId(null);
  };

  if (loading) {
    return (
      <div className="mb-8 rounded-card border border-ink/10 bg-white p-6 shadow-card">
        <p className="text-sm text-meta">Loading pods...</p>
      </div>
    );
  }

  const single = podLimit === 1;

  if (pods.length === 0) {
    return (
      <div className="mb-8 rounded-card border border-ink/10 bg-white p-6 shadow-card">
        <h2 className="t-h3 text-ink">
          {single ? "Choose your pod" : "Choose your pods"}
        </h2>
        <p className="mt-1 text-sm text-meta">
          {loadError
            ? "We couldn't load the pods just now. Refresh to try again."
            : "Pods are being formed from the winning problem statements — check back soon."}
        </p>
      </div>
    );
  }

  const atCap = myPodIds.size >= podLimit;

  return (
    <div className="mb-8">
      <h2 className="t-h3 mb-4 text-ink">
        {single ? "Choose your pod" : "Choose your pods"}
      </h2>
      <p className="mb-4 text-sm text-meta">
        {single
          ? "You join one pod per cycle — pick the problem you want to work on."
          : `You can join up to ${podLimit} pods per cycle.`}
        {atCap && !single && " You've reached the limit."}
      </p>
      <div className="autogrid">
        {pods.map((pod) => {
          const isJoined = myPodIds.has(pod.id);
          const isActing = actionPodId === pod.id;
          const canJoin = !isJoined && !atCap;

          return (
            <div
              key={pod.id}
              className={`rounded-card border bg-white p-4 shadow-card transition-colors duration-150 ${
                isJoined
                  ? "border-teal/40"
                  : "border-ink/10"
              }`}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="t-h4 text-ink">
                  {pod.name}
                </h3>
                <span
                  className={`status ${
                    pod.status === "active" ? "active" : "forming"
                  }`}
                >
                  {pod.status}
                </span>
              </div>

              {isJoined ? (
                <button
                  onClick={() => handleWithdraw(pod.id)}
                  disabled={isActing}
                  className="btn btn-ghost btn-block px-4 py-2 text-sm"
                >
                  {isActing ? "Withdrawing..." : "Withdraw"}
                </button>
              ) : (
                <button
                  onClick={() => handleJoin(pod.id)}
                  disabled={!canJoin || isActing}
                  title={
                    atCap
                      ? single
                        ? "You're already in a pod for this cycle"
                        : `You can join at most ${podLimit} pods per cycle`
                      : undefined
                  }
                  className="btn btn-teal btn-block px-4 py-2 text-sm"
                >
                  {isActing
                    ? "Joining..."
                    : atCap
                      ? "Limit reached"
                      : "Join"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
