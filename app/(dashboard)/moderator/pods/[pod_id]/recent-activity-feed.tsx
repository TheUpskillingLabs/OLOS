"use client";

import * as React from "react";
import { RecentPulsesFeed } from "./recent-pulses-feed";
import { RecentLogsFeed } from "./recent-logs-feed";

/**
 * The "Recent activity" tab body. Deterministic, no switch (owner
 * decision, 2026-07-22): a pod with pulse checks is a legacy pod (the
 * weekly log gate replaced the pulse system, so new cycles never
 * generate pulses) and shows the pulse feed; every other pod shows
 * Learning Logs. Test logs saved into a legacy cycle don't flip it.
 */

export function RecentActivityFeed({
  podId,
  hasPulses = false,
}: {
  podId: number;
  hasLogs?: boolean;
  hasPulses?: boolean;
}) {
  return hasPulses ? (
    <RecentPulsesFeed podId={podId} />
  ) : (
    <RecentLogsFeed podId={podId} />
  );
}
