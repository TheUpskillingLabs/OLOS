"use client";

import Link from "next/link";
import { useState } from "react";
import { LabTeaser } from "@/app/components/content/teasers";
import type { MetroRow } from "@/lib/content/queries";

/* The public metro search — city first, account second (owner decision):
   browse and pick your city free; the account ask comes only when a name
   goes on a list. Results render only once typing starts (prototype rule). */
export default function MetroSearch({ metros }: { metros: MetroRow[] }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const matches = query
    ? metros.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          (m.st || "").toLowerCase() === query
      )
    : [];

  return (
    <div style={{ marginTop: 32 }}>
      <div className="t-h4" style={{ marginBottom: 4 }}>
        Not one of these?
      </div>
      <p className="t-small" style={{ marginBottom: 14 }}>
        Search your city — or be the first name on its list.
      </p>
      <div className="metro-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="search"
          placeholder="Search any city"
          aria-label="Search cities"
          autoComplete="off"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {query && (
        <p className="t-small" aria-live="polite" style={{ color: "var(--meta)", margin: "12px 0 16px" }}>
          {matches.length
            ? `${matches.length} ${matches.length === 1 ? "city matches" : "cities match"}`
            : "No list for that city yet."}
        </p>
      )}
      {query && matches.length > 0 && (
        <div className="cards">
          {matches.map((m) => (
            <LabTeaser key={m.slug} metro={m} />
          ))}
        </div>
      )}
      {query && matches.length === 0 && (
        <div className="lcard" style={{ padding: 24, display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="t-h4" style={{ marginBottom: 4 }}>
              Be the first name on the {q.trim()} list.
            </div>
            <p className="t-small">
              Every lab started as a list of names. Enough names, and we come.
            </p>
          </div>
          <Link className="btn btn-red" href="/login">
            Start the list
          </Link>
        </div>
      )}
    </div>
  );
}
