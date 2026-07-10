"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/app/components/ui";

/**
 * Inline rename + force-activate for a pod or project, used in the admin cycle
 * tables. Rename hits PATCH /api/{entity}s/{id}/name; force-activate hits
 * PATCH /api/admin/{entity}s/{id} { status:"active" } (shown only when forming).
 */
export default function EntityAdminActions({
  entity,
  entityId,
  currentName,
  status,
}: {
  entity: "pod" | "project";
  entityId: number;
  currentName: string;
  status: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [activateConfirmOpen, setActivateConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveName() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/${entity}s/${entityId}/name`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setLoading(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      setError((await res.json().catch(() => ({}))).error ?? "Failed to rename");
    }
  }

  async function activate() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/${entity}s/${entityId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    setLoading(false);
    setActivateConfirmOpen(false);
    if (res.ok) {
      router.refresh();
    } else {
      setError((await res.json().catch(() => ({}))).error ?? "Failed to activate");
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-40 rounded-card border border-ink/10 bg-white px-2 py-1 text-sm text-ink focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
        />
        <button
          onClick={saveName}
          disabled={loading || !name.trim()}
          className="rounded-card bg-teal/10 px-2.5 py-1 text-xs font-semibold text-teal-deep disabled:opacity-50"
        >
          {loading ? "…" : "Save"}
        </button>
        <button onClick={() => { setEditing(false); setName(currentName); }} className="text-xs text-meta">
          Cancel
        </button>
        {error && <span role="alert" className="text-xs text-red">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => setEditing(true)} className="btn btn-ghost px-2.5 py-1 text-xs">
        Rename
      </button>
      {status === "forming" && (
        <button
          onClick={() => setActivateConfirmOpen(true)}
          disabled={loading}
          className="rounded-card bg-teal/10 px-2.5 py-1 text-xs font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] disabled:opacity-50"
        >
          Activate
        </button>
      )}
      {error && <span role="alert" className="text-xs text-red">{error}</span>}

      <ConfirmDialog
        open={activateConfirmOpen}
        onCancel={() => setActivateConfirmOpen(false)}
        onConfirm={activate}
        loading={loading}
        title={`Activate this ${entity}?`}
        confirmLabel="Activate"
        body={`This activates the ${entity} now, even if it hasn't reached its minimum size.`}
      />
    </div>
  );
}
