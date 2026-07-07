"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * A LinkedIn-style filter dropdown: a `.chip` trigger that opens a small
 * radio menu. Interaction contract (outside-click close, Escape, ArrowUp/Down
 * cycling, menuitemradio semantics) copied from the app-nav avatar menu; the
 * panel reuses the global `.menu-item` look via the same classes.
 */

export interface FilterOption {
  value: string;
  label: string;
}

export function FilterDropdown({
  label,
  value,
  options,
  onChange,
  anyLabel,
}: {
  /** The filter's name, e.g. "Location" — shown on the chip. */
  label: string;
  /** Currently selected option value, or null for "any". */
  value: string | null;
  options: FilterOption[];
  onChange: (value: string | null) => void;
  /** Label of the clearing first option, e.g. "Any location". */
  anyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        wrapRef.current?.querySelector("button")?.focus();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = Array.from(
          wrapRef.current?.querySelectorAll<HTMLElement>("[role=menuitemradio]") ?? []
        );
        const i = items.indexOf(document.activeElement as HTMLElement);
        items[
          (e.key === "ArrowDown" ? i + 1 : i - 1 + items.length) % items.length
        ]?.focus();
      }
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value) ?? null;

  const pick = (v: string | null) => {
    onChange(v);
    setOpen(false);
  };

  const radioDot = (checked: boolean) => (
    <span
      aria-hidden
      style={{
        width: 16,
        height: 16,
        borderRadius: "50%",
        flexShrink: 0,
        border: `2px solid ${checked ? "var(--teal)" : "var(--meta-soft)"}`,
        background: checked
          ? "radial-gradient(circle at center, var(--teal) 0 4px, transparent 5px)"
          : "none",
      }}
    />
  );

  return (
    <span className="relative inline-flex" ref={wrapRef}>
      <button
        type="button"
        className={`chip inline-flex items-center gap-1.5${selected ? " active" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {selected ? `${label}: ${selected.label}` : label}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={`Filter by ${label.toLowerCase()}`}
          className="absolute left-0 top-[calc(100%+8px)] z-[210] max-h-72 min-w-56 overflow-y-auto rounded-card border border-ink/10 bg-white p-2 shadow-lg"
        >
          <button
            type="button"
            className="menu-item"
            role="menuitemradio"
            aria-checked={!selected}
            onClick={() => pick(null)}
          >
            {radioDot(!selected)}
            {anyLabel}
          </button>
          {options.map((o) => (
            <button
              type="button"
              key={o.value}
              className="menu-item"
              role="menuitemradio"
              aria-checked={o.value === value}
              onClick={() => pick(o.value)}
            >
              {radioDot(o.value === value)}
              {o.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
