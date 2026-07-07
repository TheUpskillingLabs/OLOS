import Link from "next/link";
import { Pencil } from "lucide-react";
import { StatusBadge } from "@/app/components/ui";
import FollowButton from "@/app/components/follow-button";
import { PlatformIcon, PLATFORM_LABELS } from "./platform-icon";
import type { EntityLink } from "@/lib/showcase/links";

/**
 * The LinkedIn-style header shared by pod & project showcase pages: a cover
 * band, an overlapping logo, name + tagline + status, a follow button with the
 * follower count, a social-link icon row, and a curator-only "Edit page" action.
 * Presentational — the page resolves data + follow state and passes them in;
 * FollowButton is the only client island.
 */

type Status = "active" | "forming" | "closed" | "inactive";
const STATUS_VARIANT: Record<Status, "active" | "forming" | "inactive"> = {
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

interface Props {
  entityType: "pod" | "project";
  entityId: number;
  name: string;
  tagline: string | null;
  status: string;
  logoUrl: string | null;
  coverUrl: string | null;
  memberCount: number;
  githubRepoUrl: string | null;
  links: EntityLink[];
  following: boolean;
  followerCount: number;
  breadcrumb?: React.ReactNode;
  canEdit: boolean;
  editHref: string;
}

export default function ShowcaseHeader({
  entityType,
  entityId,
  name,
  tagline,
  status,
  logoUrl,
  coverUrl,
  memberCount,
  githubRepoUrl,
  links,
  following,
  followerCount,
  breadcrumb,
  canEdit,
  editHref,
}: Props) {
  const variant = STATUS_VARIANT[status as Status] ?? "inactive";
  const initials = initialsOf(name);
  const hasLinks = !!githubRepoUrl || links.length > 0;

  return (
    <section className="mb-8">
      {breadcrumb && <div className="mb-3">{breadcrumb}</div>}

      <div className="overflow-hidden rounded-card border border-ink/10 bg-white shadow-card">
        {/* Cover band */}
        <div className="relative h-28 w-full sm:h-40">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-teal-deep to-navy" />
          )}
        </div>

        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          {/* Logo overlapping the cover, plus the actions */}
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={name}
                className="h-20 w-20 rounded-card object-cover ring-4 ring-white"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-card bg-teal-deep text-2xl font-bold text-white ring-4 ring-white">
                {initials}
              </div>
            )}
            <div className="flex items-center gap-2 pb-1">
              <FollowButton
                targetType={entityType}
                targetId={entityId}
                initialFollowing={following}
                initialCount={followerCount}
                showCount
              />
              {canEdit && (
                <Link
                  href={editHref}
                  className="btn btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Edit page
                </Link>
              )}
            </div>
          </div>

          {/* Identity */}
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="t-h1 text-ink">{name}</h1>
              <StatusBadge variant={variant}>{status}</StatusBadge>
            </div>
            {tagline && (
              <p className="mt-1 text-sm font-medium text-teal-deep">{tagline}</p>
            )}
            <p className="mt-1 text-xs text-meta tabular-nums">
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </p>

            {hasLinks && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {githubRepoUrl && (
                  <IconLink
                    href={githubRepoUrl}
                    title="Code repository"
                    platform="github"
                  />
                )}
                {links.map((l) => (
                  <IconLink
                    key={l.platform}
                    href={l.url}
                    title={l.label || PLATFORM_LABELS[l.platform]}
                    platform={l.platform}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function IconLink({
  href,
  title,
  platform,
}: {
  href: string;
  title: string;
  platform: EntityLink["platform"];
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      aria-label={title}
      className="inline-flex h-9 w-9 items-center justify-center rounded-card border border-ink/10 text-charcoal transition-colors duration-150 hover:border-teal/40 hover:text-teal-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
    >
      <PlatformIcon platform={platform} className="h-4 w-4" />
    </a>
  );
}
