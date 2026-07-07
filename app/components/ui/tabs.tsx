"use client";

import * as React from "react";

/**
 * Underline tab bar — the styling ported from the moderator per-pod tabs
 * (moderator/pods/[pod_id]/pod-content-tabs.tsx): `border-b-2`, teal active,
 * meta inactive. Presentational and controlled — the parent owns `value` and
 * decides whether to sync it to the URL (cycle workspace) or local state.
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
}: {
  tabs: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={`flex items-center gap-1 overflow-x-auto border-b border-ink/10 ${className ?? ""}`.trim()}
    >
      {tabs
        .filter((t) => !t.hidden)
        .map((t) => {
          const active = t.value === value;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onValueChange(t.value)}
              className={`relative -mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:text-ink ${
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
