import * as React from "react";
import { TooltipStateProvider } from "./tooltip-state";

/**
 * Moderator dashboard layout — wraps all routes under /moderator with
 * the TooltipStateProvider so tooltip auto-suppression (PRD §7.8)
 * works across the All pods view, per-pod view, and any future
 * dashboard surfaces.
 *
 * The (dashboard) parent layout still owns the global nav shell.
 */
export default function ModeratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TooltipStateProvider>{children}</TooltipStateProvider>;
}
