"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Org run pods (docs/ORG_CYCLES.md §2/§5) let co-leads charter a project
 * directly on the pod — no solution-proposal ballot. Collapsed button →
 * inline form → POST /api/pods/[pod_id]/projects, mirroring
 * workstreams-panel.tsx's new-workstream form.
 */
export default function CharterProjectForm({ podId }: { podId: number }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [githubRepoUrl, setGithubRepoUrl] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function charterProject(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/pods/${podId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          github_repo_url: githubRepoUrl || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          typeof data?.error === "string"
            ? data.error
            : "Failed to charter project"
        );
        return;
      }
      setName("");
      setGithubRepoUrl("");
      setFormOpen(false);
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  if (!formOpen) {
    return (
      <button
        type="button"
        onClick={() => setFormOpen(true)}
        className="btn btn-teal px-3 py-1 text-xs"
      >
        + Charter project
      </button>
    );
  }

  return (
    <form
      onSubmit={charterProject}
      className="flex flex-wrap items-start gap-3 rounded-card border border-ink/10 bg-ink/[0.02] p-3"
    >
      <div className="flex flex-col gap-1.5">
        <label
          className="text-xs font-medium text-charcoal"
          htmlFor="charter-project-name"
        >
          Name
        </label>
        <input
          id="charter-project-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="e.g. Mentor matching redesign"
          className="rounded-card border border-ink/10 bg-white px-3 py-1.5 text-base text-ink placeholder:text-meta transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <label
          className="text-xs font-medium text-charcoal"
          htmlFor="charter-project-repo"
        >
          GitHub repo URL (optional)
        </label>
        <input
          id="charter-project-repo"
          value={githubRepoUrl}
          onChange={(e) => setGithubRepoUrl(e.target.value)}
          placeholder="https://github.com/…"
          className="rounded-card border border-ink/10 bg-white px-3 py-1.5 text-base text-ink placeholder:text-meta transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
        />
      </div>
      <div className="flex items-center gap-2 pt-5">
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="btn btn-teal px-4 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating ? "Chartering…" : "Charter"}
        </button>
        <button
          type="button"
          onClick={() => {
            setFormOpen(false);
            setError(null);
            setName("");
            setGithubRepoUrl("");
          }}
          className="text-sm text-meta transition-colors duration-150 hover:text-charcoal"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="w-full text-xs text-red">
          {error}
        </p>
      )}
    </form>
  );
}
