"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/app/components/ui";

type Participant = { participant_id: number; name: string };
type Member = { participant_id: number; name: string };

/**
 * Inline add/remove members panel for a pod or project, generalized from
 * AssignModeratorButton. Hits the admin membership routes:
 *   add    → POST   /api/admin/{entity}s/{id}/memberships { participant_id }
 *   remove → DELETE /api/admin/{entity}s/{id}/memberships/{participant_id}
 */
export default function ManageMembersButton({
  entity,
  entityId,
  participants,
  initialMembers,
}: {
  entity: "pod" | "project";
  entityId: number;
  participants: Participant[];
  initialMembers: Member[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<Member | null>(null);
  const [error, setError] = useState<string | null>(null);

  const base = `/api/admin/${entity}s/${entityId}/memberships`;
  const currentIds = new Set(members.map((m) => m.participant_id));
  const available = participants.filter((p) => !currentIds.has(p.participant_id));

  async function add() {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    const res = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participant_id: parseInt(selectedId, 10) }),
    });
    setLoading(false);
    if (res.ok) {
      const p = participants.find((p) => p.participant_id === parseInt(selectedId, 10));
      setMembers((prev) => [...prev, { participant_id: parseInt(selectedId, 10), name: p?.name ?? "" }]);
      setSelectedId("");
      router.refresh();
    } else {
      setError((await res.json().catch(() => ({}))).error ?? "Failed to add");
    }
  }

  async function remove(participantId: number) {
    setLoading(true);
    setError(null);
    const res = await fetch(`${base}/${participantId}`, { method: "DELETE" });
    setLoading(false);
    setPendingRemoval(null);
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.participant_id !== participantId));
      router.refresh();
    } else {
      setError((await res.json().catch(() => ({}))).error ?? "Failed to remove");
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-ghost px-2.5 py-1 text-xs">
        Members
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-card border border-ink/10 bg-white p-3 shadow-card">
      {members.length > 0 ? (
        <div className="space-y-1">
          {members.map((m) => (
            <div key={m.participant_id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-charcoal">{m.name || `#${m.participant_id}`}</span>
              <button
                onClick={() => setPendingRemoval(m)}
                disabled={loading}
                className="text-xs font-medium text-red transition-colors duration-150 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-meta">No members yet.</p>
      )}

      {available.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            aria-label="Select participant"
            className="flex-1 rounded-card border border-ink/10 bg-white px-2 py-1 text-base text-ink focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          >
            <option value="">Add participant…</option>
            {available.map((p) => (
              <option key={p.participant_id} value={p.participant_id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={add}
            disabled={!selectedId || loading}
            className="rounded-card bg-teal/10 px-3 py-1 text-xs font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] disabled:opacity-50"
          >
            {loading ? "…" : "Add"}
          </button>
        </div>
      )}

      {error && <p role="alert" className="text-xs text-red">{error}</p>}

      <button
        onClick={() => setOpen(false)}
        className="text-xs text-meta transition-colors duration-150 hover:text-charcoal"
      >
        Close
      </button>

      <ConfirmDialog
        open={pendingRemoval !== null}
        onCancel={() => setPendingRemoval(null)}
        onConfirm={() => pendingRemoval && remove(pendingRemoval.participant_id)}
        loading={loading}
        destructive
        title={`Remove ${entity} member?`}
        confirmLabel="Remove"
        body={
          <>
            Remove{" "}
            <span className="font-medium">
              {pendingRemoval?.name || `#${pendingRemoval?.participant_id}`}
            </span>{" "}
            from this {entity}? They can be added back afterward.
          </>
        }
      />
    </div>
  );
}
