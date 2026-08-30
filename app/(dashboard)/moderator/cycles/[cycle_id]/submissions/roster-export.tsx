"use client";

import { useState } from "react";

/* One-click sharing for the outreach roster (poderator QoL, 2026-08-30):
   poderators post status to Slack by hand today, so this renders the same
   rows the page shows into (a) a CSV download and (b) a monospace table
   copied to the clipboard inside a ``` block — Slack renders that as
   aligned columns with zero reformatting. Client-side on purpose: the data
   is already on the (moderator-gated) page, so no new API surface. The
   fuller report builder (cycle/pod/project selection, column picker) is
   deliberately out of scope — tracked in the backlog issue. */

export interface RosterExportRow {
  name: string;
  project: string | null;
  submitted: boolean;
  lastLog: string | null;
  email: string | null;
}

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "none";
}

function buildRows(rows: RosterExportRow[]): string[][] {
  return [
    ["Member", "Project", "Submitted", "Last log", "Email"],
    ...rows.map((r) => [
      r.name,
      r.project ?? "NOT REGISTERED",
      r.submitted ? "yes" : "NO",
      fmtDate(r.lastLog),
      r.email ?? "",
    ]),
  ];
}

export default function RosterExport({
  rows,
  cycleName,
}: {
  rows: RosterExportRow[];
  cycleName: string;
}) {
  const [copied, setCopied] = useState(false);

  function downloadCsv() {
    const csv = buildRows(rows)
      .map((r) => r.map(csvEscape).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cycleName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-project-roster.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyForSlack() {
    const table = buildRows(rows);
    const widths = table[0].map((_, i) =>
      Math.max(...table.map((r) => r[i].length))
    );
    const lines = table.map((r) =>
      r.map((cell, i) => cell.padEnd(widths[i])).join("  ")
    );
    const text =
      `${cycleName} — project roster (${new Date().toISOString().slice(0, 10)})\n` +
      "```\n" +
      lines.join("\n") +
      "\n```";
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={copyForSlack} className="btn btn-ghost btn-sm">
        {copied ? "Copied ✓" : "Copy for Slack"}
      </button>
      <button type="button" onClick={downloadCsv} className="btn btn-ghost btn-sm">
        Download CSV
      </button>
    </div>
  );
}
