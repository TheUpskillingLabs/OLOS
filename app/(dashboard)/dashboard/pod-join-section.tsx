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
  podLimit,
}: {
  cycleId: number;
  participantId: number;
  myPodIds: number[];
  podLimit: number;
}) {
  const router = useRouter();
  const [pods, setPods] = useState<Pod[]>([]);
  const [myPodIds, setMyPodIds] = useState<Set<number>>(
    new Set(initialMyPodIds)
  );
  const [loading, setLoading] = useState(true);
  const [actionPodId, setActionPodId] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/cycles/${cycleId}/pods`)
      .then((r) => r.json())
      .then((data) => {
        const activePods = (data.pods || data || []).filter(
          (p: Pod) => p.status === "forming" || p.status === "active"
        );
        setPods(activePods);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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

  if (pods.length === 0) {
    return (
      <div className="mb-8 rounded-card border border-ink/10 bg-white p-6 shadow-card">
        <h2 className="t-h3 text-ink">
          Choose your pods
        </h2>
        <p className="mt-1 text-sm text-meta">
          No pods are available for registration yet.
        </p>
      </div>
    );
  }

  const atCap = myPodIds.size >= podLimit;

  return (
    <div className="mb-8">
      <h2 className="t-h3 mb-4 text-ink">
        Choose your pods
      </h2>
      <p className="mb-4 text-sm text-meta">
        You can join up to {podLimit} {podLimit === 1 ? "pod" : "pods"} per cycle.
        {atCap && " You've reached the limit."}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                      ? `You can join at most ${podLimit} pods per cycle`
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
