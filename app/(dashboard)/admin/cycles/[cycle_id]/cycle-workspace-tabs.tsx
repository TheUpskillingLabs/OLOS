"use client";

import * as React from "react";
import { Tabs, type TabItem } from "@/app/components/ui";
import type { CycleTab } from "./cycle-tabs";

/**
 * The per-cycle workspace — replaces the old 8-section vertical scroll with
 * tabs. Each panel is a Server Component rendered in the page and passed in as
 * a prop (RSC-as-props); this client shell only decides which one is visible.
 *
 * The active tab syncs to `?tab=` via history.replaceState (no server
 * round-trip), so it survives reload and is deep-linkable. Client state also
 * survives router.refresh(), so saving a form keeps you on the same tab.
 */

export default function CycleWorkspaceTabs({
  initialTab,
  showDev,
  overview,
  configuration,
  formation,
  people,
  dev,
  labels,
}: {
  initialTab: CycleTab;
  showDev: boolean;
  overview: React.ReactNode;
  configuration: React.ReactNode;
  formation: React.ReactNode;
  people: React.ReactNode;
  dev: React.ReactNode;
  /** Per-mode overrides for tab labels (e.g. org cycles: "Workstreams",
      "Staff"). Tab VALUES are untouched — only the displayed label changes,
      so deep links and cycle-tabs.ts stay stable. */
  labels?: Partial<Record<CycleTab, string>>;
}) {
  const [tab, setTab] = React.useState<CycleTab>(initialTab);

  const onSelect = (value: string) => {
    const next = value as CycleTab;
    if (next === tab) return;
    setTab(next);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (next === "overview") url.searchParams.delete("tab");
      else url.searchParams.set("tab", next);
      window.history.replaceState(null, "", url.toString());
    }
  };

  const items: TabItem[] = [
    { value: "overview", label: labels?.overview ?? "Overview" },
    { value: "configuration", label: labels?.configuration ?? "Configuration" },
    { value: "formation", label: labels?.formation ?? "Formation" },
    { value: "people", label: labels?.people ?? "People" },
    { value: "dev", label: labels?.dev ?? "Dev · Testing", hidden: !showDev },
  ];

  return (
    <div>
      <Tabs tabs={items} value={tab} onValueChange={onSelect} idBase="cycle-ws" />
      <div
        role="tabpanel"
        id={`cycle-ws-panel-${tab}`}
        aria-labelledby={`cycle-ws-tab-${tab}`}
        tabIndex={-1}
        className="mt-8"
      >
        {tab === "overview" && overview}
        {tab === "configuration" && configuration}
        {tab === "formation" && formation}
        {tab === "people" && people}
        {tab === "dev" && showDev && dev}
      </div>
    </div>
  );
}
