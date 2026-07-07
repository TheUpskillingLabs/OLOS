"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/app/components/ui";
import { ROLE_INTENT_LABELS } from "../profile/member-profile-view";
import type { DirectoryMember, DirectoryEntity } from "./page";

/**
 * The directory grid — People / Pods / Projects tabs (chips), a name/tagline
 * search box, the People role filter, and a "Following" toggle backed by the
 * viewer's follow-set (resolved server-side, passed as "type:id" keys). All
 * filtering is in-memory over the server-provided lists, as before. Cards are
 * `.card.tappable` teasers linking to the profile / showcase page.
 */

type Tab = "people" | "pods" | "projects";

const ROLE_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "cycle", label: "Builders" },
  { key: "mentor", label: "Mentors" },
  { key: "volunteer", label: "Volunteers" },
];

// Placeholder gradients — reuse the teaser media gradients so an item without a
// photo reads like the rest of the app's thumbnails. Picked deterministically
// by id so the grid looks varied but stable across renders.
const GRADS = ["m-teal", "m-forest", "m-navy"];

const ENTITY_STATUS_VARIANT: Record<string, "active" | "forming" | "inactive"> = {
  active: "active",
  forming: "forming",
  closed: "inactive",
  inactive: "inactive",
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "•";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function DirectoryGrid({
  members,
  pods,
  projects,
  followedKeys,
}: {
  members: DirectoryMember[];
  pods: DirectoryEntity[];
  projects: DirectoryEntity[];
  followedKeys: string[];
}) {
  const [tab, setTab] = useState<Tab>("people");
  const [roleFilter, setRoleFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [followingOnly, setFollowingOnly] = useState(false);

  const followed = useMemo(() => new Set(followedKeys), [followedKeys]);
  const hasFollows = followedKeys.length > 0;
  const q = search.trim().toLowerCase();

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (followingOnly && !followed.has(`participant:${m.id}`)) return false;
      const matchesRole =
        roleFilter === "all" || (m.role_intents ?? []).includes(roleFilter);
      if (!matchesRole) return false;
      if (!q) return true;
      return (
        m.displayName.toLowerCase().includes(q) ||
        (m.metroName?.toLowerCase().includes(q) ?? false) ||
        (m.headline?.toLowerCase().includes(q) ?? false) ||
        (m.primary_expertise?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [members, roleFilter, q, followingOnly, followed]);

  const filteredPods = useMemo(
    () => filterEntities(pods, q, followingOnly, followed),
    [pods, q, followingOnly, followed]
  );
  const filteredProjects = useMemo(
    () => filterEntities(projects, q, followingOnly, followed),
    [projects, q, followingOnly, followed]
  );

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "people", label: "People", count: members.length },
    { key: "pods", label: "Pods", count: pods.length },
    { key: "projects", label: "Projects", count: projects.length },
  ];

  const activeCount =
    tab === "people"
      ? filteredMembers.length
      : tab === "pods"
        ? filteredPods.length
        : filteredProjects.length;
  const noun = tab === "people" ? "member" : tab === "pods" ? "pod" : "project";

  return (
    <div>
      {/* Tabs */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`chip${tab === t.key ? " active" : ""}`}
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}{" "}
            <span className="tabular-nums opacity-70">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="mb-5 space-y-3">
        <input
          type="text"
          placeholder={
            tab === "people"
              ? "Search by name, city, or expertise…"
              : "Search by name or tagline…"
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search the directory"
          className="w-full max-w-md rounded-card border border-ink/10 bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-meta-soft focus:border-teal focus:outline-none focus:ring-[3px] focus:ring-teal/15 transition-[border-color,box-shadow] duration-150"
        />
        <div className="flex flex-wrap items-center gap-2">
          {tab === "people" &&
            ROLE_FILTERS.map((f) => (
              <button
                key={f.key}
                className={`chip${roleFilter === f.key ? " active" : ""}`}
                aria-pressed={roleFilter === f.key}
                onClick={() => setRoleFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          {hasFollows && (
            <button
              className={`chip${followingOnly ? " active" : ""}`}
              aria-pressed={followingOnly}
              onClick={() => setFollowingOnly((v) => !v)}
            >
              Following
            </button>
          )}
          <span className="ml-1 text-sm text-meta tabular-nums">
            {activeCount} {activeCount === 1 ? noun : `${noun}s`}
          </span>
        </div>
      </div>

      {/* Grid */}
      {tab === "people" ? (
        filteredMembers.length === 0 ? (
          <Empty label="members" />
        ) : (
          <div className="cards dense all">
            {filteredMembers.map((m) => (
              <MemberCard key={m.id} member={m} />
            ))}
          </div>
        )
      ) : (tab === "pods" ? filteredPods : filteredProjects).length === 0 ? (
        <Empty label={tab} />
      ) : (
        <div className="cards dense all">
          {(tab === "pods" ? filteredPods : filteredProjects).map((e) => (
            <EntityCard key={`${e.kind}:${e.id}`} entity={e} />
          ))}
        </div>
      )}
    </div>
  );
}

function filterEntities(
  list: DirectoryEntity[],
  q: string,
  followingOnly: boolean,
  followed: Set<string>
) {
  return list.filter((e) => {
    if (followingOnly && !followed.has(`${e.kind}:${e.id}`)) return false;
    if (!q) return true;
    return (
      e.name.toLowerCase().includes(q) ||
      (e.tagline?.toLowerCase().includes(q) ?? false)
    );
  });
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-card border border-dashed border-meta-soft p-10 text-center">
      <p className="t-small">No {label} match your search.</p>
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

function EntityCard({ entity: e }: { entity: DirectoryEntity }) {
  const href = e.kind === "pod" ? `/pods/${e.id}` : `/projects/${e.id}`;
  const variant = ENTITY_STATUS_VARIANT[e.status] ?? "inactive";
  return (
    <Link className="card tappable" href={href}>
      <EntityThumb entity={e} />
      <div className="card-body">
        <div className="t-h4 truncate text-ink">{e.name}</div>
        {e.tagline && (
          <p className="mt-0.5 truncate text-sm font-medium text-teal-deep">
            {e.tagline}
          </p>
        )}
        <div className="mt-2">
          <StatusBadge variant={variant}>{e.status}</StatusBadge>
        </div>
      </div>
    </Link>
  );
}

function EntityThumb({ entity: e }: { entity: DirectoryEntity }) {
  if (e.logo_url) {
    return (
      <div className="media sq">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={e.logo_url}
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
  const grad = GRADS[e.id % GRADS.length];
  return (
    <div
      className={`media sq ${grad} flex items-center justify-center`}
      aria-hidden
    >
      <span className="text-3xl font-bold tracking-tight text-white/95">
        {initialsOf(e.name)}
      </span>
    </div>
  );
}
