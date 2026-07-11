"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, Textarea } from "@/app/components/ui";

/**
 * Compact, inline owner actions for a single entity row in the generalized owner
 * console (app/(dashboard)/admin/owner/[entity]). Unlike the page-footer Danger Zone
 * (owner-lifecycle.tsx), this renders small buttons suited to a table row, with
 * generic per-action copy driven by the entity's label. Destructive actions (reset,
 * delete) require typing the entity's name. POSTs/DELETEs the generalized owner API
 * and refreshes on success. The console gates rendering on the owner already.
 */

type Action = "archive" | "reset" | "delete";

const META: Record<Action, { verb: string; typed: boolean; variant: "destructive" | "primary"; blurb: (label: string, name: string) => string }> = {
  archive: {
    verb: "Archive",
    typed: false,
    variant: "primary",
    blurb: (label, name) => `Archive ${label.toLowerCase()} “${name}”? It is hidden / deactivated. Reversible — no data is deleted.`,
  },
  reset: {
    verb: "Reset",
    typed: true,
    variant: "destructive",
    blurb: (label, name) => `Reset ${label.toLowerCase()} “${name}”? Its dependents are wiped and it returns to its default state. This cannot be undone.`,
  },
  delete: {
    verb: "Delete",
    typed: true,
    variant: "destructive",
    blurb: (label, name) => `Permanently delete ${label.toLowerCase()} “${name}” and everything about it? This is irreversible.`,
  },
};

export default function OwnerEntityActions({
  entity,
  id,
  name,
  label,
  actions,
}: {
  entity: string;
  id: number;
  name: string;
  label: string;
  actions: Action[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function start(action: Action) {
    setError(null);
    setReason("");
    setOpen(action);
  }
  function close() {
    if (busy) return;
    setOpen(null);
    setError(null);
  }

  async function run() {
    if (!open || busy) return;
    setBusy(true);
    setError(null);
    const action = open;
    try {
      const isDelete = action === "delete";
      const payload: Record<string, unknown> = { reason: reason.trim() || undefined };
      if (!isDelete) payload.action = action;
      if (META[action].typed) payload.confirm = name;

      const res = await fetch(`/api/owner/${entity}/${id}`, {
        method: isDelete ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setBusy(false);
      setOpen(null);
      router.refresh();
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {actions.map((a) => (
        <Button
          key={a}
          variant={a === "archive" ? "secondary" : "destructive"}
          size="sm"
          onClick={() => start(a)}
        >
          {META[a].verb}
        </Button>
      ))}

      <ConfirmDialog
        open={open !== null}
        onClose={close}
        onConfirm={run}
        title={open ? `${META[open].verb} ${label.toLowerCase()}` : ""}
        description={name}
        confirmLabel={open ? META[open].verb : "Confirm"}
        variant={open ? META[open].variant : "destructive"}
        requireTypedConfirm={open && META[open].typed ? name : undefined}
        busy={busy}
        error={error}
      >
        {open && <p className="text-sm text-charcoal">{META[open].blurb(label, name)}</p>}
        <div>
          <label className="mb-1 block text-xs text-meta">Reason (optional, logged)</label>
          <Textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
            placeholder="Why are you doing this?"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
