"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import NominateButton from "./nominate-button";
import { ROLE_INTENT_LABELS } from "../profile/member-profile-view";
import type { DirectoryMember } from "./page";

/**
 * The member directory grid — chip filter (All / Builders / Mentors /
 * Volunteers, from role_intents) + a name/metro search box, modeled on
 * participants-global-table + metro-search. Cards are `.card.tappable` teasers
 * linking to /u/[handle]; the Nominate ghost button stops the tap from
 * following the card link.
 */

const FILTERS: { key: string; label: string; intent?: string }[] = [
  { key: "all", label: "All" },
  { key: "cycle", label: "Builders", intent: "cycle" },
  { key: "mentor", label: "Mentors", intent: "mentor" },
  { key: "volunteer", label: "Volunteers", intent: "volunteer" },
];

export default function DirectoryGrid({
  members,
}: {
  members: DirectoryMember[];
}) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      const matchesFilter =
        filter === "all" || (m.role_intents ?? []).includes(filter);
      if (!matchesFilter) return false;
      if (!q) return true;
      return (
        m.displayName.toLowerCase().includes(q) ||
        (m.metroName?.toLowerCase().includes(q) ?? false) ||
        (m.headline?.toLowerCase().includes(q) ?? false) ||
        (m.primary_expertise?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [members, filter, search]);

  return (
    <div>
      {/* Controls */}
      <div className="mb-5 space-y-3">
        <input
          type="text"
          placeholder="Search by name, city, or expertise…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search the directory"
          className="w-full max-w-md rounded-card border border-ink/10 bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-meta-soft focus:border-teal focus:outline-none focus:ring-[3px] focus:ring-teal/15 transition-[border-color,box-shadow] duration-150"
        />
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`chip${filter === f.key ? " active" : ""}`}
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
          <span className="ml-1 text-sm text-meta tabular-nums">
            {filtered.length} {filtered.length === 1 ? "member" : "members"}
          </span>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-card border border-dashed border-meta-soft p-10 text-center">
          <p className="t-small">No members match your search.</p>
        </div>
      ) : (
        <div className="cards dense all">
          {filtered.map((m) => (
            <MemberCard key={m.id} member={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberCard({ member: m }: { member: DirectoryMember }) {
  const href = m.handle ? `/u/${m.handle}` : null;
  return (
    // Stretched-link pattern: the whole card is tappable via an absolutely-
    // positioned overlay <Link>, while the Nominate <button> sits above it
    // (relative z-10). This keeps the button OUT of the anchor — React 19
    // rejects a <button> nested inside an <a> as invalid nesting.
    <div className="card tappable relative">
      <div className="card-body">
        <div className="flex items-start gap-3">
          {m.profile_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={m.profile_image_url}
              alt={m.displayName}
              className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-ink/10"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-deep text-sm font-bold text-white">
              {m.firstInitial}
              {m.lastInitial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="t-h4 truncate text-ink">{m.displayName}</p>
            {m.headline ? (
              <p className="truncate text-sm font-medium text-teal-deep">
                {m.headline}
              </p>
            ) : m.primary_expertise ? (
              <p className="truncate text-sm text-charcoal">
                {m.primary_expertise}
              </p>
            ) : null}
            {m.metroName && (
              <p className="mt-0.5 truncate text-xs text-meta">{m.metroName}</p>
            )}
          </div>
        </div>

        {(m.role_intents?.length ?? 0) > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {m.role_intents.map((r) => (
              <span
                key={r}
                className="inline-flex items-center rounded-sm bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal-deep"
              >
                {ROLE_INTENT_LABELS[r] ?? r}
              </span>
            ))}
          </div>
        )}

        {/* Above the overlay link so it stays independently clickable. */}
        <div className="relative z-10 mt-3 inline-flex">
          <NominateButton nomineeName={m.displayName} />
        </div>
      </div>

      {href && (
        <Link
          href={href}
          className="absolute inset-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          aria-label={`View ${m.displayName}'s profile`}
        />
      )}
    </div>
  );
}
