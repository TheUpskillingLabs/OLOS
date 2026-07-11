"use client";

import * as React from "react";
import { Tabs, type TabItem } from "@/app/components/ui";

/**
 * The People & Access surface's two tabs — Participants and Invitations —
 * with the same ?tab= URL sync as the cycle workspace. Panels are passed in
 * as RSC-as-props nodes from the server page.
 */
export type PeopleTab = "participants" | "invitations";

export default function PeopleWorkspace({
  initialTab,
  participantsPanel,
  invitationsPanel,
}: {
  initialTab: PeopleTab;
  participantsPanel: React.ReactNode;
  invitationsPanel: React.ReactNode;
}) {
  const [tab, setTab] = React.useState<PeopleTab>(initialTab);

  const onSelect = (value: string) => {
    const next = value as PeopleTab;
    if (next === tab) return;
    setTab(next);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (next === "participants") url.searchParams.delete("tab");
      else url.searchParams.set("tab", next);
      window.history.replaceState(null, "", url.toString());
    }
  };

  const items: TabItem[] = [
    { value: "participants", label: "Participants" },
    { value: "invitations", label: "Invitations" },
  ];

  return (
    <div>
      <Tabs tabs={items} value={tab} onValueChange={onSelect} idBase="people-ws" />
      <div
        role="tabpanel"
        id={`people-ws-panel-${tab}`}
        aria-labelledby={`people-ws-tab-${tab}`}
        tabIndex={-1}
        className="mt-8"
      >
        {tab === "participants" && participantsPanel}
        {tab === "invitations" && invitationsPanel}
      </div>
    </div>
  );
}
