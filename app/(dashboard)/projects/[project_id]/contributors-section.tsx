"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/app/components/ui";

/**
 * The DRI/contributor ladder for a project (SECTOR_MODEL §5/§7). Read-only
 * list for everyone; the add form + per-row remove only render for a
 * DRI-or-admin viewer (`canManage`, computed server-side in page.tsx).
 */

export type ContributorRow = {
  participant_id: number;
  name: string;
  role: "dri" | "contributor";
  created_at: string;
};
export type ParticipantOption = { participant_id: number; name: string };

export default function ContributorsSection({
  projectId,
  contributors,
  followerCount,
  canManage,
  participantOptions,
}: {
  projectId: number;
  contributors: ContributorRow[];
  followerCount: number;
  canManage: boolean;
  participantOptions: ParticipantOption[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = React.useState("");
  const [role, setRole] = React.useState<"dri" | "contributor">("contributor");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const currentIds = new Set(contributors.map((c) => c.participant_id));
  const addable = participantOptions.filter(
    (p) => !currentIds.has(p.participant_id)
  );

  async function addContributor(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/contributors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participant_id: parseInt(selectedId, 10),
          role,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          typeof data?.error === "string"
            ? data.error
            : "Failed to add contributor"
        );
        return;
      }
      setSelectedId("");
      setRole("contributor");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeContributor(participantId: number, name: string) {
    if (!confirm(`Remove ${name} from this project?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/contributors/${participantId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          typeof data?.error === "string"
            ? data.error
            : "Failed to remove contributor"
        );
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="t-h3 mb-1 text-ink">
        Contributors ({contributors.length})
      </h2>
      <p className="mb-3 text-sm text-meta">{followerCount} following</p>

      <div className="overflow-hidden rounded-card border border-ink/10 bg-white shadow-card">
        {contributors.length === 0 ? (
          <p className="p-4 text-sm text-meta">No contributors yet.</p>
        ) : (
          <div className="divide-y divide-ink/10">
            {contributors.map((c) => (
              <div
                key={c.participant_id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="text-sm text-charcoal">{c.name}</span>
                <div className="flex items-center gap-3">
                  <StatusBadge variant={c.role === "dri" ? "active" : "inactive"}>
                    {c.role === "dri" ? "DRI" : "Contributor"}
                  </StatusBadge>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => removeContributor(c.participant_id, c.name)}
                      disabled={busy}
                      aria-label={`Remove ${c.name}`}
                      className="text-sm font-medium text-red transition-colors duration-150 hover:text-red disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:text-red"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {canManage && (
        <form
          onSubmit={addContributor}
          className="mt-3 flex flex-wrap items-center gap-2"
        >
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            aria-label="Select participant to add as a contributor"
            disabled={addable.length === 0}
            className="min-w-[160px] flex-1 rounded-card border border-ink/10 bg-white px-2 py-1.5 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">
              {addable.length === 0 ? "No one left to add" : "Add contributor…"}
            </option>
            {addable.map((p) => (
              <option key={p.participant_id} value={p.participant_id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "dri" | "contributor")}
            aria-label="Role"
            className="rounded-card border border-ink/10 bg-white px-2 py-1.5 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          >
            <option value="contributor">Contributor</option>
            <option value="dri">DRI</option>
          </select>
          <button
            type="submit"
            disabled={!selectedId || busy}
            className="rounded-card bg-teal/10 px-3 py-1.5 text-xs font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            {busy ? "…" : "Add"}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-red">
          {error}
        </p>
      )}
    </div>
  );
}
