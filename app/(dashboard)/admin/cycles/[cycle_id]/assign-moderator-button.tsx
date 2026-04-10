"use client";

import { useState } from "react";

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
}: {
  podId: number;
  cycleId: number;
  participants: Participant[];
  initialModerators: Moderator[];
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
          <span className="text-xs text-cloud/60">
            {moderators.map((m) => m.name).join(", ")}
          </span>
        )}
        <button
          onClick={() => setOpen(true)}
          className="rounded px-2 py-1 text-xs font-medium text-cloud/60 ring-1 ring-whisper hover:bg-white/[0.04] hover:text-cloud"
        >
          {moderators.length > 0 ? "Manage" : "Assign Moderator"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-whisper bg-white/[0.02] p-3 space-y-3">
      {moderators.length > 0 && (
        <div className="space-y-1">
          {moderators.map((m) => (
            <div
              key={m.participant_id}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-white">{m.name}</span>
              <button
                onClick={() => remove(m.participant_id)}
                disabled={loading}
                className="text-xs text-red/70 hover:text-red disabled:opacity-50"
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
            className="flex-1 rounded border border-whisper bg-transparent px-2 py-1 text-xs text-white"
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
            className="rounded bg-teal/20 px-2.5 py-1 text-xs font-medium text-aqua hover:bg-teal/30 disabled:opacity-50"
          >
            {loading ? "…" : "Assign"}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red">{error}</p>}

      <button
        onClick={() => setOpen(false)}
        className="text-xs text-cloud/40 hover:text-cloud/60"
      >
        Close
      </button>
    </div>
  );
}
