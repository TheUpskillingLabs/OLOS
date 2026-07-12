"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, Textarea } from "@/app/components/ui";

/**
 * Owner-only "Danger Zone" for cycles, pods, and projects: Archive (reversible
 * deactivation) and Reset (wipe dependents + re-seed the shell to defaults). Renders
 * only for owners (the caller gates on `isOwner`); a non-null `locked` reason shows a
 * note instead of the buttons. Mirrors the participant Danger Zone
 * (app/(dashboard)/admin/people/owner-danger-zone.tsx) but for the big entities, which
 * are never hard-deleted (owner decision).
 *
 * Reset requires typing the entity's name to confirm; archive does not. Mutations hit
 * the generalized owner API (/api/owner/{entity}/{id}) and refresh on success. No toast
 * system exists, so feedback is the inline error + the refresh.
 */

type Action = "archive" | "reset";
type EntityKey = "cycles" | "pods" | "projects";

const COPY: Record<EntityKey, Record<Action, { title: string; blurb: string; confirmLabel: string; typed: boolean; variant: "destructive" | "primary" }>> = {
  cycles: {
    archive: {
      title: "Archive this cycle",
      blurb:
        "Sets the cycle to archived and closes it out: its pods dissolve, memberships and moderator assignments close, and projects graduate to their sector. Reversible governance flip — no data is deleted.",
      confirmLabel: "Archive cycle",
      typed: false,
      variant: "primary",
    },
    reset: {
      title: "Reset this cycle",
      blurb:
        "Wipes the cohort back to a pristine draft: removes every enrollment, pod, project, submission, vote, and engagement log, and resets the config to defaults. Field-survey research and the revocation audit log are kept. This cannot be undone.",
      confirmLabel: "Reset cycle",
      typed: true,
      variant: "destructive",
    },
  },
  pods: {
    archive: {
      title: "Archive this pod",
      blurb:
        "Dissolves the pod and closes its memberships and moderator assignments. Reversible — no data is deleted.",
      confirmLabel: "Archive pod",
      typed: false,
      variant: "primary",
    },
    reset: {
      title: "Reset this pod",
      blurb:
        "Removes the pod's projects, solution proposals, project votes, and members, returning it to 'forming'. This cannot be undone.",
      confirmLabel: "Reset pod",
      typed: true,
      variant: "destructive",
    },
  },
  projects: {
    archive: {
      title: "Archive this project",
      blurb: "Marks the project inactive. Reversible — no data is deleted.",
      confirmLabel: "Archive project",
      typed: false,
      variant: "primary",
    },
    reset: {
      title: "Reset this project",
      blurb:
        "Removes the project's members and promoted roles, returning it to 'forming'. This cannot be undone.",
      confirmLabel: "Reset project",
      typed: true,
      variant: "destructive",
    },
  },
};

export default function OwnerLifecycle({
  entity,
  id,
  name,
  locked,
}: {
  entity: EntityKey;
  id: number;
  /** Display name (with a fallback like "Pod 5"); also the type-to-confirm token. */
  name: string;
  /** Non-null reason renders a locked note instead of the actions. */
  locked?: string | null;
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
      const payload: Record<string, unknown> = { action, reason: reason.trim() || undefined };
      if (COPY[entity][action].typed) payload.confirm = name;

      const res = await fetch(`/api/owner/${entity}/${id}`, {
        method: "POST",
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
    <section className="mt-8 rounded-card border border-red/30 bg-red/[0.03] p-5">
      <h2 className="t-h4 text-red">Danger zone</h2>
      <p className="mt-1 text-xs text-meta">Owner-only lifecycle actions for this {entity.slice(0, -1)}.</p>

      {locked ? (
        <p className="mt-4 text-sm text-charcoal">{locked}</p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="secondary" size="sm" onClick={() => start("archive")}>
            Archive
          </Button>
          <Button variant="destructive" size="sm" onClick={() => start("reset")}>
            Reset
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={open !== null}
        onClose={close}
        onConfirm={run}
        title={open ? COPY[entity][open].title : ""}
        description={name}
        confirmLabel={open ? COPY[entity][open].confirmLabel : "Confirm"}
        variant={open ? COPY[entity][open].variant : "destructive"}
        requireTypedConfirm={open && COPY[entity][open].typed ? name : undefined}
        busy={busy}
        error={error}
      >
        {open && <p className="text-sm text-charcoal">{COPY[entity][open].blurb}</p>}
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
    </section>
  );
}
