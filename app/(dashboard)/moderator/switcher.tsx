"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

/**
 * Switcher (PRD §7.7) — top-of-page nav between All pods + each
 * assigned pod. Persists last selection via PUT /api/moderator/ui-state.
 *
 * Single-pod poderators see a switcher with one option; the All pods
 * entry is suppressed by the caller (don't pass `showAllPods=false`).
 */
export type SwitcherPod = { id: number; name: string };

export function Switcher({
  pods,
  current,
  showAllPods,
}: {
  pods: SwitcherPod[];
  current: "all_pods" | { pod_id: number };
  showAllPods: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const currentLabel =
    current === "all_pods"
      ? "All pods"
      : pods.find((p) => p.id === (current as { pod_id: number }).pod_id)?.name ??
        "Pod";

  const persist = (last_view: string) => {
    fetch("/api/moderator/ui-state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ last_view }),
    }).catch(() => {
      // best-effort persistence — UI keeps working without it
    });
  };

  const select = (last_view: string, href: string) => {
    persist(last_view);
    setOpen(false);
    router.push(href);
  };

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-card border border-ink/10 bg-white px-3 py-1.5 text-sm text-charcoal shadow-card transition-colors hover:bg-ink/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
      >
        <span className="text-xs uppercase tracking-widest text-meta">
          View
        </span>
        <span className="font-medium text-ink">{currentLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 text-meta" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-40 mt-1 min-w-[240px] overflow-hidden rounded-card border border-ink/10 bg-white py-1 shadow-card-lg"
        >
          {showAllPods && (
            <SwitcherItem
              label="All pods"
              selected={current === "all_pods"}
              onClick={() => select("all_pods", "/moderator?view=all")}
            />
          )}
          {pods.map((p) => (
            <SwitcherItem
              key={p.id}
              label={p.name}
              selected={
                current !== "all_pods" &&
                (current as { pod_id: number }).pod_id === p.id
              }
              onClick={() =>
                select(String(p.id), `/moderator/pods/${p.id}`)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SwitcherItem({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      role="option"
      aria-selected={selected}
      className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors hover:bg-ink/[0.04] ${
        selected ? "text-teal-deep" : "text-charcoal"
      }`}
    >
      <span className="truncate">{label}</span>
      {selected && <span className="ml-3 text-xs">●</span>}
    </button>
  );
}

/**
 * Fire-and-forget helper exported for non-switcher consumers (e.g.
 * roster-table.tsx) that need to persist a partial UI state update.
 */
export function persistUiState(patch: {
  last_view?: string;
  roster_filters?: Record<string, unknown>;
  roster_sort?: string;
  tooltip_seen?: string[];
  last_pod_tab?: "members" | "recent_pulses";
}) {
  fetch("/api/moderator/ui-state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).catch(() => {});
}

