"use client";

import { useState, useEffect } from "react";
import { EmptyState } from "@/app/components/ui";
import FormationMeter from "@/app/components/cycle/formation-meter";

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
  projectMax,
  projectMin,
}: {
  pods: { id: number; name: string | null }[];
  projects: Project[];
  initialCurrentProjectId: number | null;
  projectMax: number;
  projectMin: number;
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

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(""), 4000);
    return () => clearTimeout(t);
  }, [successMsg]);

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
      setError("Network error. Try again.");
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
      setError("Network error. Try again.");
    } finally {
      setActionId(null);
    }
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        title="No projects to join yet"
        description="Projects are created after solution voting. Once they're shortlisted, they'll appear here to register for."
      />
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
        <div className="rounded-card border border-teal bg-white p-4 shadow-[inset_0_0_0_1px_var(--teal)]">
          <p className="lbl">
            Currently registered for
          </p>
          <p className="mt-1 font-semibold tracking-tight text-ink">
            {projects.find((p) => p.id === currentProjectId)?.name ||
              `Project ${currentProjectId}`}
          </p>
          <p className="mt-1 text-xs text-meta">
            You can only be in one project per cycle. Withdraw to switch.
          </p>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-card border border-red/20 bg-red/10 px-3 py-2 text-sm text-red"
        >
          {error}
        </p>
      )}
      <p role="status" aria-live="polite">
        {successMsg && (
          <span className="block rounded-card border border-teal/30 bg-teal/10 px-3 py-2 text-sm text-teal-deep">
            {successMsg}
          </span>
        )}
      </p>

      {Object.entries(byPod).map(([podIdStr, podProjects]) => {
        const podId = parseInt(podIdStr, 10);
        return (
          <div key={podId}>
            <h2 className="lbl mb-3">
              {getPodName(podId)}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {podProjects.map((project) => {
                const isRegistered = currentProjectId === project.id;
                const memberCount = projectCounts[project.id] || 0;
                const isFull = memberCount >= projectMax;
                return (
                  <div
                    key={project.id}
                    className={`rounded-card border bg-white p-4 transition-colors duration-150 ${
                      isRegistered
                        ? "border-teal shadow-[inset_0_0_0_1px_var(--teal)]"
                        : "border-ink/10 shadow-card hover:border-ink/20"
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold tracking-tight text-ink">
                          {project.name || `Project ${project.id}`}
                        </p>
                        <span className={`status ${project.status === "active" ? "active" : "forming"} mt-0.5`}>
                          {project.status === "active" ? "Active" : "Forming"}
                        </span>
                      </div>
                      {isRegistered ? (
                        <button
                          onClick={() => withdrawFromProject(project.id)}
                          disabled={actionId !== null}
                          className="flex-shrink-0 rounded-card ring-1 ring-ink/10 px-3 py-2 text-xs font-semibold tracking-tight text-charcoal transition-all duration-150 ease-spring hover:bg-ink/[0.04] hover:text-ink hover:ring-ink/20 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                        >
                          {actionId === project.id ? "…" : "Withdraw"}
                        </button>
                      ) : isFull ? (
                        <span className="flex-shrink-0 rounded-card bg-ink/[0.04] px-3 py-2 text-xs font-medium tracking-tight text-meta">
                          Project full
                        </span>
                      ) : (
                        <button
                          onClick={() => registerForProject(project.id)}
                          disabled={actionId !== null || currentProjectId !== null}
                          title={
                            currentProjectId !== null
                              ? "You're already in a project — withdraw to switch"
                              : undefined
                          }
                          className="flex-shrink-0 rounded-card bg-teal/10 px-3 py-2 text-xs font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                        >
                          {actionId === project.id
                            ? "…"
                            : currentProjectId !== null
                              ? "In another project"
                              : "Join"}
                        </button>
                      )}
                    </div>
                    <FormationMeter count={memberCount} min={projectMin} className="mb-1" />
                    <p className="text-xs text-meta-soft tabular-nums">
                      {memberCount} / {projectMax} max
                    </p>
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
