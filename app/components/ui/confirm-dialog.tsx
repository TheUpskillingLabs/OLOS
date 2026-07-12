"use client";

import * as React from "react";
import { Sheet } from "./sheet";
import { Button } from "./button";
import { Input } from "./form";

/**
 * Confirmation dialog for destructive / irreversible actions, built on `Sheet`.
 *
 * The app has no toast system and no prior confirm-dialog primitive (destructive
 * confirmation was ad-hoc `window.confirm` or a two-tap inline button). This is the
 * reusable version: a controlled drawer with optional type-to-confirm gating and
 * inline error/busy states. The parent owns the mutation — it sets `busy` while its
 * request is in flight and `error` on failure, and calls `onClose` on success.
 *
 * When `requireTypedConfirm` is set, the confirm button stays disabled until the
 * user types that exact string (e.g. the entity's name/email).
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "destructive",
  requireTypedConfirm,
  busy = false,
  error = null,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  variant?: "destructive" | "primary";
  requireTypedConfirm?: string;
  busy?: boolean;
  error?: string | null;
  children?: React.ReactNode;
}) {
  const [typed, setTyped] = React.useState("");

  // Reset the typed confirmation whenever the dialog toggles open/closed. Done by
  // tracking the previous `open` and adjusting during render (React's recommended
  // alternative to a setState-in-effect) so switching actions starts clean.
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    setTyped("");
  }

  const typedOk = !requireTypedConfirm || typed === requireTypedConfirm;
  const canConfirm = !busy && typedOk;

  return (
    <Sheet
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      description={description}
      widthClass="w-full sm:w-[440px]"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={variant}
            size="sm"
            onClick={onConfirm}
            disabled={!canConfirm}
            aria-disabled={!canConfirm}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 px-6 py-5">
        {children}
        {requireTypedConfirm && (
          <div>
            <label className="mb-1 block text-xs text-meta">
              Type{" "}
              <span className="font-semibold text-ink">{requireTypedConfirm}</span>{" "}
              to confirm
            </label>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
              aria-label={`Type ${requireTypedConfirm} to confirm`}
            />
          </div>
        )}
        {error && <p className="text-sm text-red">{error}</p>}
      </div>
    </Sheet>
  );
}
