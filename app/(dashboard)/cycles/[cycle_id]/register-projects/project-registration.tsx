"use client";

import { useState } from "react";

interface Project {
  id: number;
  name: string | null;
  status: string;
  pod_id: number;
  member_count: number;
}

export default function ProjectRegistration({
  pods,
  projects,
  initialCurrentProjectId,
}: {
  pods: { id: number; name: string | null }[];
  projects: Project[];
  initialCurrentProjectId: number | null;
}) {
  const [currentProjectId, setCurrentProjectId] = useState(
    initialCurrentProjectId
  );
  const [projectCounts, setProjectCounts] = useState<Record<number, number>>(
    () => {
      const counts: Record<number, number> = {};
      for (const p of projects) counts[p.id] = p.member_count;
      return counts;
    }
  );
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  function getPodName(podId: number): string {
    return pods.find((p) => p.id === podId)?.name || `Pod ${podId}`;
  }

  async function registerForProject(projectId: number) {
    setError("");
    setSuccessMsg("");
    setActionId(projectId);

    try {
      const res = await fetch(`/api/projects/${projectId}/register`, {
        method: "POST",
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to register");
        return;
      }

      setCurrentProjectId(projectId);
      setProjectCounts((prev) => ({
        ...prev,
        [projectId]: (prev[projectId] || 0) + 1,
      }));
      setSuccessMsg("Registered for project!");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setActionId(null);
    }
  }

  async function withdrawFromProject(projectId: number) {
    setError("");
    setSuccessMsg("");
    setActionId(projectId);

    try {
      const res = await fetch(`/api/projects/${projectId}/register`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to withdraw");
        return;
      }

      setCurrentProjectId(null);
      setProjectCounts((prev) => ({
        ...prev,
        [projectId]: Math.max(0, (prev[projectId] || 0) - 1),
      }));
      setSuccessMsg("Withdrawn from project.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setActionId(null);
    }
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-md border border-whisper bg-white/[0.02] p-6 text-center">
        <p className="text-cloud/60">
          No projects available for registration yet.
        </p>
      </div>
    );
  }

  // Group projects by pod
  const byPod: Record<number, Project[]> = {};
  for (const p of projects) {
    if (!byPod[p.pod_id]) byPod[p.pod_id] = [];
    byPod[p.pod_id].push(p);
  }

  return (
    <div className="space-y-6">
      {currentProjectId && (
        <div className="rounded-md border border-teal/20 bg-teal/[0.04] p-4">
          <p className="text-sm text-cloud/60">Currently registered for</p>
          <p className="font-medium text-white">
            {projects.find((p) => p.id === currentProjectId)?.name ||
              `Project ${currentProjectId}`}
          </p>
          <p className="mt-1 text-xs text-cloud/40">
            You can only be in one project per cycle. Withdraw to switch.
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}
      {successMsg && (
        <p className="rounded-md bg-teal/10 px-3 py-2 text-sm text-aqua">
          {successMsg}
        </p>
      )}

      {Object.entries(byPod).map(([podIdStr, podProjects]) => {
        const podId = parseInt(podIdStr, 10);
        return (
          <div key={podId}>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-cloud/40">
              {getPodName(podId)}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {podProjects.map((project) => {
                const isRegistered = currentProjectId === project.id;
                return (
                  <div
                    key={project.id}
                    className={`rounded-md border p-4 ${
                      isRegistered
                        ? "border-teal/30 bg-teal/[0.04]"
                        : "border-whisper bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-white">
                          {project.name || `Project ${project.id}`}
                        </p>
                        <p className="mt-0.5 text-xs text-cloud/40">
                          {projectCounts[project.id] || 0} member
                          {(projectCounts[project.id] || 0) !== 1
                            ? "s"
                            : ""}{" "}
                          &middot; {project.status}
                        </p>
                      </div>
                      {isRegistered ? (
                        <button
                          onClick={() => withdrawFromProject(project.id)}
                          disabled={actionId !== null}
                          className="rounded bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-40"
                        >
                          {actionId === project.id ? "..." : "Withdraw"}
                        </button>
                      ) : (
                        <button
                          onClick={() => registerForProject(project.id)}
                          disabled={
                            actionId !== null || currentProjectId !== null
                          }
                          className="rounded bg-teal/20 px-3 py-1 text-xs font-medium text-aqua transition-colors hover:bg-teal/30 disabled:opacity-40"
                        >
                          {actionId === project.id ? "..." : "Join"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
