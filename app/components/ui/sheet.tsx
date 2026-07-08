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
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Close on Esc
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus management for the modal dialog: move focus into the panel on
  // open, and hand it back to whatever opened the sheet on close. Without
  // this, keyboard/screen-reader focus stays on the (now backdropped)
  // trigger and the dialog is announced but never entered.
  React.useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => {
      previouslyFocused?.focus?.();
    };
  }, [open]);

  // Trap Tab inside the panel (aria-modal promises focus can't escape).
  function trapTab(e: React.KeyboardEvent) {
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || active === panel) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last) {
      e.preventDefault();
      first.focus();
    }
  }

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
        className="absolute inset-0 bg-ink/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        onKeyDown={trapTab}
        className={`absolute right-0 top-0 flex h-full ${widthClass} flex-col border-l border-ink/10 bg-paper shadow-[-12px_0_40px_rgba(0,20,27,0.2)] focus:outline-none`}
      >
        {/* Header — only renders if a title is supplied */}
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-ink/10 bg-white px-6 py-4">
            <div className="min-w-0">
              {title && (
                <h2
                  id="sheet-title"
                  className="t-h4"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-1 text-xs text-meta">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-card p-1 text-meta transition-colors duration-150 hover:bg-ink/[0.06] hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">{children}</div>

        {/* Footer — sticky at bottom if provided */}
        {footer && (
          <div className="border-t border-ink/10 bg-white px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
