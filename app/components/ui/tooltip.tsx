"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";

/**
 * Tooltip primitive — hover/focus reveal.
 *
 * Two usage modes:
 *
 * 1. Wrap content with a trigger:
 *
 *      <Tooltip content="Explains the badge">
 *        <StatusBadge variant="active">Active</StatusBadge>
 *      </Tooltip>
 *
 * 2. Standalone "?" icon:
 *
 *      <TooltipIcon content="Explains the metric" />
 *
 * Auto-suppress wiring (PRD §7.8) — read the prop `autoShow` and pair
 * with `onAutoShown` to persist "seen" state to moderator_ui_state.
 * Without those props, the tooltip is hover-only.
 *
 * Positioning is intentionally minimal (top, centered). For the dashboard
 * scope, the rendering containers have enough room — if a tooltip ever
 * gets clipped, switch the consumer to a different `placement`.
 */

type Placement = "top" | "bottom";

export function Tooltip({
  content,
  children,
  placement = "top",
  autoShow = false,
  onAutoShown,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  placement?: Placement;
  /** When true and the tooltip hasn't been auto-shown yet, reveal on mount briefly. */
  autoShow?: boolean;
  /** Called once the auto-show flashes (so the parent can persist "seen"). */
  onAutoShown?: () => void;
}) {
  const [hovered, setHovered] = React.useState(false);
  const [autoVisible, setAutoVisible] = React.useState(false);
  const autoNotified = React.useRef(false);

  React.useEffect(() => {
    if (!autoShow) return;
    // Deferred so the auto-show isn't a synchronous setState in the effect
    // body (react-hooks/set-state-in-effect); the flash still starts this tick.
    queueMicrotask(() => setAutoVisible(true));
    const t = setTimeout(() => {
      setAutoVisible(false);
      if (!autoNotified.current) {
        autoNotified.current = true;
        onAutoShown?.();
      }
    }, 4000);
    return () => clearTimeout(t);
  }, [autoShow, onAutoShown]);

  const visible = hovered || autoVisible;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute left-1/2 z-[70] w-max max-w-xs -translate-x-1/2 rounded-card bg-ink px-2.5 py-1.5 text-xs text-white shadow-card-lg ${
            placement === "top" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {content}
        </span>
      )}
    </span>
  );
}

/**
 * Standalone "?" icon with a tooltip. Use when there's no natural anchor
 * element to wrap — e.g. next to a section header or band label.
 */
export function TooltipIcon({
  content,
  placement,
  className,
  autoShow,
  onAutoShown,
}: {
  content: React.ReactNode;
  placement?: Placement;
  className?: string;
  autoShow?: boolean;
  onAutoShown?: () => void;
}) {
  return (
    <Tooltip
      content={content}
      placement={placement}
      autoShow={autoShow}
      onAutoShown={onAutoShown}
    >
      <span
        className={`inline-flex items-center text-meta transition-colors duration-150 hover:text-teal-deep ${className ?? ""}`}
        aria-label="More info"
        role="img"
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden />
      </span>
    </Tooltip>
  );
}
