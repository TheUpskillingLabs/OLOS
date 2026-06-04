"use client";

import * as React from "react";
import { persistUiState } from "./switcher";

/**
 * Tooltip auto-suppression state (PRD §7.8).
 *
 * Loads `tooltip_seen` from /api/moderator/ui-state on mount and
 * exposes a hook for tooltip consumers to decide whether to auto-show
 * and to mark a key as seen when they do.
 *
 * Each key auto-shows once (PRD says "1–2 views"; we pick 1 for v1).
 * The "?" icon remains visible so the poderator can re-trigger on
 * demand even after suppression.
 */

type Ctx = {
  ready: boolean;
  seen: Set<string>;
  markSeen: (key: string) => void;
};

const TooltipCtx = React.createContext<Ctx>({
  ready: false,
  seen: new Set(),
  markSeen: () => {},
});

export function TooltipStateProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);
  const [seen, setSeen] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/moderator/ui-state")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const keys = (data?.tooltip_seen as string[] | null | undefined) ?? [];
        setSeen(new Set(keys));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const markSeen = React.useCallback((key: string) => {
    setSeen((current) => {
      if (current.has(key)) return current;
      const next = new Set(current);
      next.add(key);
      persistUiState({ tooltip_seen: Array.from(next) });
      return next;
    });
  }, []);

  const value = React.useMemo<Ctx>(
    () => ({ ready, seen, markSeen }),
    [ready, seen, markSeen]
  );

  return <TooltipCtx.Provider value={value}>{children}</TooltipCtx.Provider>;
}

export function useTooltipKey(key: string): {
  autoShow: boolean;
  markSeen: () => void;
} {
  const ctx = React.useContext(TooltipCtx);
  const autoShow = ctx.ready && !ctx.seen.has(key);
  const markSeen = React.useCallback(() => ctx.markSeen(key), [ctx, key]);
  return { autoShow, markSeen };
}

/**
 * Drop-in wrapper combining a tooltip-key with the existing Tooltip
 * primitive. Consumers pass `tooltipKey` + the underlying tooltip
 * `content` + children to wrap.
 */
import { Tooltip } from "@/app/components/ui";

export function ManagedTooltip({
  tooltipKey,
  content,
  children,
  placement,
}: {
  tooltipKey: string;
  content: React.ReactNode;
  children: React.ReactNode;
  placement?: "top" | "bottom";
}) {
  const { autoShow, markSeen } = useTooltipKey(tooltipKey);
  return (
    <Tooltip
      content={content}
      placement={placement}
      autoShow={autoShow}
      onAutoShown={markSeen}
    >
      {children}
    </Tooltip>
  );
}
