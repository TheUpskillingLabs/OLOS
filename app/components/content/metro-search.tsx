"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LabTeaser } from "@/app/components/content/teasers";
import type { MetroRow } from "@/lib/content/queries";

/** Split a free-text search into city + optional 2-letter state
    ("Austin, TX" → {city:"Austin", st:"TX"}; "Austin" → {city:"Austin"}). */
function parseCityState(input: string): { city: string; st?: string } {
  const m = input.match(/^(.+?),\s*([A-Za-z]{2})$/);
  if (m) return { city: m[1].trim(), st: m[2].toUpperCase() };
  return { city: input };
}

/* The public metro search — city first, account second (owner decision):
   browse and pick your city free; the account ask comes only when a name
   goes on a list. The search bar leads the section (owner ask, July 2026):
   the `initial` cards show until typing starts, then live matches take
   their place — or the start-a-list card when no city matches. Used by the
   landing's Local labs section (top 4 cities) and /local-labs (all). */
export default function MetroSearch({
  metros,
  initial = [],
  signedIn = false,
}: {
  metros: MetroRow[];
  initial?: MetroRow[];
  signedIn?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [starting, setStarting] = useState(false);
  const query = q.trim().toLowerCase();

  // "Start the list" (docs/LOCAL_LABS.md): signed-in members create/join the
  // waitlist lab for the typed city and land on its page; signed-out visitors
  // take the /login handoff.
  const startList = async () => {
    setStarting(true);
    try {
      const res = await fetch("/api/labs/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parseCityState(q.trim())),
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.lab?.slug) {
        router.push(`/local-labs/${body.lab.slug}`);
        return;
      }
      if (res.status === 401 || res.status === 403) {
        window.location.href = body?.redirect ?? "/login";
        return;
      }
      setStarting(false);
    } catch {
      setStarting(false);
    }
  };
  const matches = query
    ? metros.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          (m.st || "").toLowerCase() === query
      )
    : [];

  return (
    <div>
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
      <p className="t-small" aria-live="polite" style={{ margin: "-8px 0 20px" }}>
        {query
          ? matches.length
            ? `${matches.length} ${matches.length === 1 ? "city matches" : "cities match"}`
            : "No list for that city yet."
          : "Search your city — or be the first name on its list."}
      </p>
      {!query && initial.length > 0 && (
        <div className="cards">
          {initial.map((m) => (
            <LabTeaser key={m.slug} metro={m} />
          ))}
        </div>
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
          {signedIn ? (
            <button
              className="btn btn-red"
              onClick={startList}
              disabled={starting}
            >
              Start the list
            </button>
          ) : (
            <Link className="btn btn-red" href="/login?intent=join">
              Start the list
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
