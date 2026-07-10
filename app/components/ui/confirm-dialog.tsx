"use client";

import * as React from "react";

/**
 * Centered confirmation modal — the in-app replacement for the browser's
 * native confirm(). Reuses the Sheet's backdrop / Esc / body-scroll-lock
 * mechanics but presents as a small centered card rather than a side drawer,
 * which reads better for a yes/no decision.
 *
 * Controlled: the parent owns `open`. `onConfirm` may be async — while it is
 * pending the confirm button shows a busy state and both actions are locked
 * (the parent should keep the dialog open until the action resolves, then
 * close it). `destructive` swaps the confirm button to the red treatment.
 */
export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  loading = false,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: React.ReactNode;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
}) {
  // Close on Esc (ignored while the action is running)
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel, loading]);

  // Lock body scroll while open
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/60 backdrop-blur-sm transition-opacity"
        onClick={() => !loading && onCancel()}
        aria-hidden
      />

      {/* Card */}
      <div className="relative w-full max-w-md rounded-card border border-ink/10 bg-paper p-6 shadow-[0_24px_60px_rgba(0,20,27,0.28)]">
        <h2 id="confirm-dialog-title" className="t-h4 text-ink">
          {title}
        </h2>
        {body && <div className="mt-2 text-sm text-charcoal">{body}</div>}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-card px-4 py-2 text-sm font-semibold tracking-tight text-charcoal ring-1 ring-ink/10 transition-all duration-150 hover:bg-ink/[0.04] hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-card px-4 py-2 text-sm font-semibold tracking-tight transition-all duration-150 ease-spring active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal ${
              destructive
                ? "bg-red/10 text-red hover:bg-red/20"
                : "bg-teal/10 text-teal-deep hover:bg-teal/20"
            }`}
          >
            {loading ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
