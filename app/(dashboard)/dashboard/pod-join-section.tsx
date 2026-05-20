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
}: {
  cycleId: number;
  participantId: number;
  myPodIds: number[];
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
      <div className="mb-8 rounded-md border border-whisper bg-white/[0.02] p-6">
        <p className="text-sm text-cloud/60">Loading pods...</p>
      </div>
    );
  }

  if (pods.length === 0) {
    return (
      <div className="mb-8 rounded-md border border-whisper bg-white/[0.02] p-6">
        <h2 className="text-lg font-semibold tracking-tight text-white">
          Choose your pods
        </h2>
        <p className="mt-1 text-sm text-cloud/60">
          No pods are available for registration yet.
        </p>
      </div>
    );
  }

  const atCap = myPodIds.size >= 2;

  return (
    <div className="mb-8">
      <h2 className="mb-4 text-lg font-semibold tracking-tight text-white">
        Choose your pods
      </h2>
      <p className="mb-4 text-sm text-cloud/60">
        You can join up to 2 pods per cycle.
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
              className={`rounded-md border p-4 transition-colors duration-150 ${
                isJoined
                  ? "border-teal/30 bg-teal/[0.04]"
                  : "border-whisper bg-white/[0.02]"
              }`}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="font-semibold tracking-tight text-white">
                  {pod.name}
                </h3>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                    pod.status === "active"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-yellow-500/10 text-yellow-300"
                  }`}
                >
                  {pod.status}
                </span>
              </div>

              {isJoined ? (
                <button
                  onClick={() => handleWithdraw(pod.id)}
                  disabled={isActing}
                  className="w-full rounded-md border border-white/[0.10] bg-white/[0.04] px-4 py-2 text-sm font-medium text-cloud transition-colors duration-150 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isActing ? "Withdrawing..." : "Withdraw"}
                </button>
              ) : (
                <button
                  onClick={() => handleJoin(pod.id)}
                  disabled={!canJoin || isActing}
                  title={
                    atCap
                      ? "You can join at most 2 pods per cycle"
                      : undefined
                  }
                  className="w-full rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-teal/80 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight disabled:cursor-not-allowed disabled:opacity-50"
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
