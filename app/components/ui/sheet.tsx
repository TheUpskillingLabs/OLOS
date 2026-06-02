"use client";

import * as React from "react";
import { X } from "lucide-react";

/**
 * Right-side drawer (a.k.a. sheet) used by the pulse review side panel
 * (PRD §7.4) and any future drill-in surface that shouldn't navigate
 * away from the underlying page.
 *
 * Controlled component: parent owns `open` and `onClose`. Closes on
 * Esc, on backdrop click, and via the explicit close button in the
 * header (if a title is provided) or rendered by the caller.
 *
 * Width defaults to a comfortable reading column; override via
 * `widthClass` for wider/narrower content.
 */

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  widthClass = "w-full sm:w-[560px]",
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  widthClass?: string;
  footer?: React.ReactNode;
}) {
  // Close on Esc
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "sheet-title" : undefined}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        className={`absolute right-0 top-0 flex h-full ${widthClass} flex-col border-l border-whisper bg-[rgba(42,49,66,0.98)] shadow-[-12px_0_32px_rgba(0,0,0,0.5)]`}
      >
        {/* Header — only renders if a title is supplied */}
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-whisper px-6 py-4">
            <div className="min-w-0">
              {title && (
                <h2
                  id="sheet-title"
                  className="text-base font-semibold tracking-tight text-white"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-1 text-xs text-cloud/60">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1 text-cloud/60 transition-colors duration-150 hover:bg-white/[0.04] hover:text-cloud focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">{children}</div>

        {/* Footer — sticky at bottom if provided */}
        {footer && (
          <div className="border-t border-whisper bg-[rgba(42,49,66,0.98)] px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
