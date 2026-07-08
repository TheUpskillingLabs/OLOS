"use client";

import * as React from "react";
import { nextTabValue } from "@/lib/ui/tabs-keys";

/**
 * Underline tab bar — the styling ported from the moderator per-pod tabs
 * (moderator/pods/[pod_id]/pod-content-tabs.tsx): `border-b-2`, teal active,
 * meta inactive. Presentational and controlled — the parent owns `value` and
 * decides whether to sync it to the URL (cycle workspace) or local state.
 *
 * Implements the WAI-ARIA tabs pattern with automatic activation: roving
 * tabindex (only the selected tab is in the Tab order), ArrowLeft/Right
 * with wrap-around, Home/End. When `idBase` is set, tabs get stable ids and
 * the selected tab points at its panel via aria-controls — selected-only,
 * because consumers mount just the active panel, and aria-controls must not
 * reference an id that isn't in the document. The consumer is responsible
 * for giving its panel wrapper `role="tabpanel"`, `id={`${idBase}-panel-...`}`
 * and `aria-labelledby={`${idBase}-tab-...`}`.
 */

export type TabItem = {
  value: string;
  label: React.ReactNode;
  /** Optional trailing element, e.g. a count badge. */
  badge?: React.ReactNode;
  /** When true, the tab is not rendered (e.g. a permission-gated tab). */
  hidden?: boolean;
};

export function Tabs({
  tabs,
  value,
  onValueChange,
  className,
  idBase,
}: {
  tabs: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  /** Prefix for tab/panel id wiring (`${idBase}-tab-x` / `${idBase}-panel-x`). */
  idBase?: string;
}) {
  const visible = tabs.filter((t) => !t.hidden);
  const values = visible.map((t) => t.value);
  const refs = React.useRef(new Map<string, HTMLButtonElement>());
  // If `value` somehow isn't among the visible tabs, the first tab keeps
  // tabIndex=0 so the tablist never drops out of the keyboard Tab order.
  const valueVisible = values.includes(value);

  function onKeyDown(e: React.KeyboardEvent) {
    const next = nextTabValue(values, value, e.key);
    if (next == null) return;
    e.preventDefault();
    onValueChange(next);
    refs.current.get(next)?.focus();
  }

  return (
    <div
      role="tablist"
      onKeyDown={onKeyDown}
      className={`flex items-center gap-1 overflow-x-auto border-b border-ink/10 ${className ?? ""}`.trim()}
    >
      {visible.map((t, i) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              if (el) refs.current.set(t.value, el);
              else refs.current.delete(t.value);
            }}
            type="button"
            role="tab"
            id={idBase ? `${idBase}-tab-${t.value}` : undefined}
            aria-selected={active}
            aria-controls={
              idBase && active ? `${idBase}-panel-${t.value}` : undefined
            }
            tabIndex={active || (!valueVisible && i === 0) ? 0 : -1}
            onClick={() => onValueChange(t.value)}
            className={`relative -mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${
              active
                ? "border-teal text-ink"
                : "border-transparent text-meta hover:text-ink"
            }`}
          >
            {t.label}
            {t.badge != null && t.badge}
          </button>
        );
      })}
    </div>
  );
}
