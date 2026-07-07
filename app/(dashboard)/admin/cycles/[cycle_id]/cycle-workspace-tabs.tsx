"use client";

import * as React from "react";
import { Tabs, type TabItem } from "@/app/components/ui";

/**
 * The per-cycle workspace — replaces the old 8-section vertical scroll with
 * tabs. Each panel is a Server Component rendered in the page and passed in as
 * a prop (RSC-as-props); this client shell only decides which one is visible.
 *
 * The active tab syncs to `?tab=` via history.replaceState (no server
 * round-trip), so it survives reload and is deep-linkable. Client state also
 * survives router.refresh(), so saving a form keeps you on the same tab.
 */

export type CycleTab =
  | "overview"
  | "configuration"
  | "formation"
  | "people"
  | "dev";

const VALID_TABS: CycleTab[] = [
  "overview",
  "configuration",
  "formation",
  "people",
  "dev",
];

/** Normalize an untrusted ?tab= value, honoring the dev-tab permission gate. */
export function resolveInitialTab(
  raw: string | undefined,
  showDev: boolean,
): CycleTab {
  const tab = VALID_TABS.includes(raw as CycleTab) ? (raw as CycleTab) : "overview";
  return tab === "dev" && !showDev ? "overview" : tab;
}

export default function CycleWorkspaceTabs({
  initialTab,
  showDev,
  overview,
  configuration,
  formation,
  people,
  dev,
}: {
  initialTab: CycleTab;
  showDev: boolean;
  overview: React.ReactNode;
  configuration: React.ReactNode;
  formation: React.ReactNode;
  people: React.ReactNode;
  dev: React.ReactNode;
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
    { value: "overview", label: "Overview" },
    { value: "configuration", label: "Configuration" },
    { value: "formation", label: "Formation" },
    { value: "people", label: "People" },
    { value: "dev", label: "Dev · Testing", hidden: !showDev },
  ];

  return (
    <div>
      <Tabs tabs={items} value={tab} onValueChange={onSelect} />
      <div className="mt-8">
        {tab === "overview" && overview}
        {tab === "configuration" && configuration}
        {tab === "formation" && formation}
        {tab === "people" && people}
        {tab === "dev" && showDev && dev}
      </div>
    </div>
  );
}
