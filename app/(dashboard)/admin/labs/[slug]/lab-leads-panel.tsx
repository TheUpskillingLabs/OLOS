"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format/date";

/**
 * The lab-lead roster for one lab: list active leads with remove, plus an
 * assign form. Mirrors the contributors-section pattern (select + action,
 * per-row remove, inline error). Both verbs hit the admin-only
 * /api/labs/[lab_id]/leads routes — this panel only renders inside the
 * requireAdmin-gated /admin tree.
 */

export type LeadRow = {
  participant_id: number;
  name: string;
  email: string;
  assigned_at: string;
};
export type ParticipantOption = { participant_id: number; name: string };

export default function LabLeadsPanel({
  labId,
  leads,
  participantOptions,
}: {
  labId: number;
  leads: LeadRow[];
  participantOptions: ParticipantOption[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const currentIds = new Set(leads.map((l) => l.participant_id));
  const addable = participantOptions.filter(
    (p) => !currentIds.has(p.participant_id)
  );

  async function assignLead(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/labs/${labId}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participant_id: parseInt(selectedId, 10) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          typeof data?.error === "string" ? data.error : "Failed to assign lead"
        );
        return;
      }
      setSelectedId("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeLead(participantId: number, name: string) {
    if (!confirm(`Remove ${name} as a lead of this lab?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/labs/${labId}/leads/${participantId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          typeof data?.error === "string" ? data.error : "Failed to remove lead"
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
      <div className="overflow-hidden rounded-card border border-ink/10 bg-white shadow-card">
        {leads.length === 0 ? (
          <p className="p-4 text-sm text-meta">No leads assigned yet.</p>
        ) : (
          <div className="divide-y divide-ink/10">
            {leads.map((l) => (
              <div
                key={l.participant_id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <span className="text-sm font-medium text-ink">{l.name}</span>
                  <span className="ml-2 text-xs text-meta">{l.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-meta tabular-nums">
                    since {formatDate(l.assigned_at)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLead(l.participant_id, l.name)}
                    disabled={busy}
                    className="rounded-card ring-1 ring-ink/10 px-3 py-1 text-xs font-semibold tracking-tight text-charcoal transition-all duration-150 hover:bg-red/10 hover:text-red hover:ring-red/30 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={assignLead} className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          aria-label="Select participant to assign as a lab lead"
          disabled={addable.length === 0}
          className="min-w-[200px] flex-1 rounded-card border border-ink/10 bg-white px-2 py-1.5 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">
            {addable.length === 0 ? "No one left to add" : "Assign a lead…"}
          </option>
          {addable.map((p) => (
            <option key={p.participant_id} value={p.participant_id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!selectedId || busy}
          className="rounded-card bg-teal/10 px-3 py-1.5 text-xs font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          {busy ? "…" : "Assign"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-2 text-xs text-red">
          {error}
        </p>
      )}
    </div>
  );
}
