"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, Textarea } from "@/app/components/ui";

/**
 * Owner-only "Danger Zone" for a user profile: ban (lock them out), archive
 * (deactivate), reset (wipe journey, keep identity), or permanently delete.
 * Rendered only for owners, and only when the target is neither the acting owner
 * nor the primary owner (`locked`).
 *
 * Each action opens a ConfirmDialog; the deliberate ones (ban, reset, delete)
 * require typing the profile's email. Mutations hit /api/owner/participants/[id]
 * (owner-gated) and refresh — or, on delete, navigate away since the profile is
 * gone. No toast system exists, so feedback is the inline error + the page refresh.
 *
 * When the person is already banned, the ban button becomes "Lift ban" and the
 * other actions stay available — a ban is not a mode, it is a lock.
 */

type Action = "archive" | "reset" | "delete" | "ban" | "unban";

const COPY: Record<
  Action,
  { title: string; blurb: string; confirmLabel: string; typed: boolean; variant: "destructive" | "primary" }
> = {
  ban: {
    title: "Ban this person",
    blurb:
      "Locks them out of the app. Everything archive does (roles and enrollments revoked, pod memberships and moderator assignments closed, profile hidden), plus their email is added to the blocklist and their sign-in is disabled. They cannot log back in and cannot re-register with this address. A live session ends at its next refresh, usually within the hour. Reversible, but lifting a ban does not restore their roles.",
    confirmLabel: "Ban this person",
    typed: true,
    variant: "destructive",
  },
  unban: {
    title: "Lift this ban",
    blurb:
      "Removes the block on their email and re-enables sign-in, and un-hides the profile. Their roles, enrollments and pod memberships are NOT restored — re-grant those above if they should have them back. The ban stays in the audit log.",
    confirmLabel: "Lift ban",
    typed: false,
    variant: "primary",
  },
  archive: {
    title: "Archive this profile",
    blurb:
      "Deactivates the profile: it is hidden, all roles and cycle enrollments are revoked, and pod memberships / moderator assignments are closed. Reversible — you can re-activate and re-grant access later.",
    confirmLabel: "Archive profile",
    typed: false,
    variant: "primary",
  },
  reset: {
    title: "Reset this profile",
    blurb:
      "Clears the person's participation history — enrollments, pod/project memberships, moderator work, votes, pulse checks, and logs — and returns them to a clean, active state. Their identity, login, roles, and authored content are kept. This cannot be undone.",
    confirmLabel: "Reset profile",
    typed: true,
    variant: "destructive",
  },
  delete: {
    title: "Delete this profile",
    blurb:
      "Permanently erases the user and everything about them, including their sign-in. Authored community content is detached, not deleted. This is irreversible.",
    confirmLabel: "Delete permanently",
    typed: true,
    variant: "destructive",
  },
};

export default function OwnerDangerZone({
  participantId,
  email,
  displayName,
  locked,
  banned = false,
}: {
  participantId: number;
  email: string;
  displayName: string;
  /** True when an active participant_bans row exists for this email (00102). */
  banned?: boolean;
  /** Non-null reason renders a locked note instead of the actions (self / primary owner). */
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
      const isDelete = action === "delete";
      const payload: Record<string, unknown> = { reason: reason.trim() || undefined };
      if (!isDelete) payload.action = action;
      if (COPY[action].typed) payload.confirm = email;

      const res = await fetch(`/api/owner/participants/${participantId}`, {
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
      if (isDelete) {
        router.push("/admin/people");
      } else {
        router.refresh();
      }
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  return (
    <section className="mt-10 rounded-card border border-red/30 bg-red/[0.03] p-5">
      <h2 className="t-h4 text-red">Danger zone</h2>
      <p className="mt-1 text-xs text-meta">Owner-only lifecycle actions for this profile.</p>

      {banned && !locked && (
        <p className="mt-3 inline-flex items-center rounded-sm bg-red/10 px-2.5 py-0.5 text-xs font-medium text-red">
          Banned — this person cannot sign in or re-register
        </p>
      )}

      {locked ? (
        <p className="mt-4 text-sm text-charcoal">{locked}</p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          {banned ? (
            <Button variant="secondary" size="sm" onClick={() => start("unban")}>
              Lift ban
            </Button>
          ) : (
            <Button variant="destructive" size="sm" onClick={() => start("ban")}>
              Ban
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => start("archive")}>
            Archive
          </Button>
          <Button variant="secondary" size="sm" onClick={() => start("reset")}>
            Reset
          </Button>
          <Button variant="destructive" size="sm" onClick={() => start("delete")}>
            Delete
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={open !== null}
        onClose={close}
        onConfirm={run}
        title={open ? COPY[open].title : ""}
        description={displayName}
        confirmLabel={open ? COPY[open].confirmLabel : "Confirm"}
        variant={open ? COPY[open].variant : "destructive"}
        requireTypedConfirm={open && COPY[open].typed ? email : undefined}
        busy={busy}
        error={error}
      >
        {open && <p className="text-sm text-charcoal">{COPY[open].blurb}</p>}
        <div>
          <label className="mb-1 block text-xs text-meta">Reason (optional, logged)</label>
          <Textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
            placeholder="e.g. duplicate account, GDPR request…"
          />
        </div>
      </ConfirmDialog>
    </section>
  );
}
