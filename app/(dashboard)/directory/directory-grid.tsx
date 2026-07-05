"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ROLE_INTENT_LABELS } from "../profile/member-profile-view";
import type { DirectoryMember } from "./page";

/**
 * The member directory grid — chip filter (All / Builders / Mentors /
 * Volunteers, from role_intents) + a name/metro search box, modeled on
 * participants-global-table + metro-search. Cards are `.card.tappable` teasers
 * (the same shape as the Luma event/resource cards): a square media thumbnail
 * on top, then the body. Whole card links to /u/[handle].
 */

const FILTERS: { key: string; label: string; intent?: string }[] = [
  { key: "all", label: "All" },
  { key: "cycle", label: "Builders", intent: "cycle" },
  { key: "mentor", label: "Mentors", intent: "mentor" },
  { key: "volunteer", label: "Volunteers", intent: "volunteer" },
];

// Placeholder gradients — reuse the teaser media gradients so a member without
// a photo reads like the rest of the app's thumbnails. Picked deterministically
// by id so the grid looks varied but stable across renders.
const GRADS = ["m-teal", "m-forest", "m-navy"];

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
  const href = m.handle ? `/u/${m.handle}` : "#";
  return (
    <Link className="card tappable" href={href}>
      <MemberThumb member={m} />
      <div className="card-body">
        <div className="t-h4 truncate text-ink">{m.displayName}</div>
        {m.headline ? (
          <p className="mt-0.5 truncate text-sm font-medium text-teal-deep">
            {m.headline}
          </p>
        ) : m.primary_expertise ? (
          <p className="mt-0.5 truncate text-sm text-charcoal">
            {m.primary_expertise}
          </p>
        ) : null}
        {m.metroName && (
          <p className="mt-0.5 truncate text-xs text-meta">{m.metroName}</p>
        )}
        {(m.role_intents?.length ?? 0) > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
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
      </div>
    </Link>
  );
}

/**
 * Square member thumbnail — the Luma teaser `MediaFrame` treatment: a cover
 * photo when there's a profile image, otherwise a brand-gradient tile with the
 * member's initials as the placeholder.
 */
function MemberThumb({ member: m }: { member: DirectoryMember }) {
  if (m.profile_image_url) {
    const src = /^https?:\/\//.test(m.profile_image_url)
      ? m.profile_image_url
      : `/${m.profile_image_url.replace(/^\//, "")}`;
    return (
      <div className="media sq">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>
    );
  }
  const grad = GRADS[m.id % GRADS.length];
  return (
    <div
      className={`media sq ${grad} flex items-center justify-center`}
      aria-hidden
    >
      <span className="text-3xl font-bold tracking-tight text-white/95">
        {m.firstInitial}
        {m.lastInitial}
      </span>
    </div>
  );
}
