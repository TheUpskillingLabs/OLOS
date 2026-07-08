"use client";

import { useState } from "react";
import { moderatorNoun } from "@/lib/cycle/labels";

type Participant = {
  participant_id: number;
  name: string;
};

type Moderator = {
  participant_id: number;
  name: string;
  assigned_at: string;
};

export default function AssignModeratorButton({
  podId,
  cycleId,
  participants,
  initialModerators,
  mode,
}: {
  podId: number;
  cycleId: number;
  participants: Participant[];
  initialModerators: Moderator[];
  mode?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [moderators, setModerators] = useState<Moderator[]>(initialModerators);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentModIds = new Set(moderators.map((m) => m.participant_id));
  const available = participants.filter((p) => !currentModIds.has(p.participant_id));

  async function assign() {
    if (!selectedId) return;
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/pods/${podId}/moderators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participant_id: parseInt(selectedId, 10),
        cycle_id: cycleId,
      }),
    });

    setLoading(false);

    if (res.ok) {
      const data = await res.json();
      const p = participants.find(
        (p) => p.participant_id === parseInt(selectedId, 10)
      );
      setModerators((prev) => [
        ...prev,
        {
          participant_id: parseInt(selectedId, 10),
          name: p?.name ?? "",
          assigned_at: data.assigned_at,
        },
      ]);
      setSelectedId("");
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to assign");
    }
  }

  async function remove(participantId: number) {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/pods/${podId}/moderators/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participant_id: participantId,
        cycle_id: cycleId,
      }),
    });

    setLoading(false);

    if (res.ok) {
      setModerators((prev) =>
        prev.filter((m) => m.participant_id !== participantId)
      );
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to remove");
    }
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        {moderators.length > 0 && (
          <span className="text-xs text-slate">
            {moderators.map((m) => m.name).join(", ")}
          </span>
        )}
        <button
          onClick={() => setOpen(true)}
          className="btn btn-ghost px-2.5 py-1 text-xs"
        >
          {moderators.length > 0 ? "Manage" : `Assign ${moderatorNoun(mode).toLowerCase()}`}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-card border border-ink/10 bg-white p-3 shadow-card">
      {moderators.length > 0 && (
        <div className="space-y-1">
          {moderators.map((m) => (
            <div
              key={m.participant_id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-charcoal">{m.name}</span>
              <button
                onClick={() => remove(m.participant_id)}
                disabled={loading}
                className="text-xs font-medium text-red transition-colors duration-150 hover:text-red disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            aria-label="Select participant"
            className="flex-1 rounded-card border border-ink/10 bg-white px-2 py-1 text-base text-ink transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          >
            <option value="">Select participant...</option>
            {available.map((p) => (
              <option key={p.participant_id} value={p.participant_id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={assign}
            disabled={!selectedId || loading}
            className="rounded-card bg-teal/10 px-3 py-1 text-xs font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            {loading ? "…" : "Assign"}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-red">
          {error}
        </p>
      )}

      <button
        onClick={() => setOpen(false)}
        className="text-xs text-meta transition-colors duration-150 hover:text-charcoal"
      >
        Close
      </button>
    </div>
  );
}
