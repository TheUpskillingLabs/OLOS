import Link from "next/link";
import { ChevronRight, FolderKanban, Users } from "lucide-react";
import { StatusBadge } from "@/app/components/ui";
import { ROLE_INTENT_LABELS } from "../profile/member-profile-view";
import type {
  DirectoryPerson,
  DirectoryPod,
  DirectoryProject,
  MemberAvatar,
} from "@/lib/directory/types";

/**
 * LinkedIn-style result rows for the directory. Rows live inside one `.card`
 * container per section (`<ul className="card divide-y …">`) — separators via
 * divide, not per-row cards. Each row: thumb left, title/subtitle/meta in the
 * middle, status + avatar stack + chevron on the right.
 */

// Placeholder gradients — the teaser media gradients, picked deterministically
// by id so thumbs look varied but stable across renders (ported from the old
// directory grid).
const GRADS = ["m-teal", "m-forest", "m-navy"];

const STATUS_VARIANT: Record<string, "active" | "forming" | "inactive"> = {
  active: "active",
  forming: "forming",
  closed: "inactive",
  inactive: "inactive",
};

function normalizeImageSrc(url: string): string {
  return /^https?:\/\//.test(url) ? url : `/${url.replace(/^\//, "")}`;
}

export function ResultList({ children }: { children: React.ReactNode }) {
  return <ul className="card divide-y divide-ink/10 overflow-hidden">{children}</ul>;
}

function RowShell({
  href,
  children,
}: {
  href: string | null;
  children: React.ReactNode;
}) {
  const className =
    "flex items-center gap-3.5 px-4 py-3 transition-colors duration-150";
  return (
    <li>
      {href ? (
        <Link
          href={href}
          className={`${className} hover:bg-teal/5 focus-visible:bg-teal/5 focus-visible:outline-none`}
        >
          {children}
        </Link>
      ) : (
        <div className={className}>{children}</div>
      )}
    </li>
  );
}

function RowBody({
  title,
  subtitle,
  subtitleClass = "text-teal-deep",
  meta,
}: {
  title: string;
  subtitle: string | null;
  subtitleClass?: string;
  meta: string | null;
}) {
  return (
    <span className="min-w-0 flex-1">
      <span className="t-h4 block truncate text-ink">{title}</span>
      {subtitle && (
        <span className={`block truncate text-sm font-medium ${subtitleClass}`}>
          {subtitle}
        </span>
      )}
      {meta && (
        <span className="mt-0.5 block truncate text-xs text-meta">{meta}</span>
      )}
    </span>
  );
}

function Chevron() {
  return <ChevronRight className="h-4 w-4 shrink-0 text-meta-soft" aria-hidden />;
}

/** 48px round avatar — photo, or a brand-gradient initials tile. */
function PersonThumb({ person: p }: { person: DirectoryPerson }) {
  if (p.profile_image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={normalizeImageSrc(p.profile_image_url)}
        alt=""
        className="h-12 w-12 shrink-0 rounded-full object-cover"
      />
    );
  }
  const grad = GRADS[p.id % GRADS.length];
  return (
    <span
      className={`${grad} grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-bold tracking-tight text-white/95`}
      aria-hidden
    >
      {p.firstInitial}
      {p.lastInitial}
    </span>
  );
}

/** 48px square gradient tile for pods/projects. */
function EntityThumb({ id, kind }: { id: number; kind: "pod" | "project" }) {
  const grad = GRADS[id % GRADS.length];
  const Icon = kind === "pod" ? Users : FolderKanban;
  return (
    <span
      className={`${grad} grid h-12 w-12 shrink-0 place-items-center rounded-[10px]`}
      aria-hidden
    >
      <Icon className="h-5 w-5 text-white/90" />
    </span>
  );
}

/** Up to 3 overlapping 24px member avatars + "+N". Hidden on phones. */
function AvatarStack({
  avatars,
  total,
}: {
  avatars: MemberAvatar[];
  total: number;
}) {
  if (total === 0) return null;
  const extra = total - avatars.length;
  return (
    <span className="hidden shrink-0 items-center gap-1.5 sm:flex" aria-hidden>
      <span className="flex -space-x-2">
        {avatars.map((a) =>
          a.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={a.id}
              src={normalizeImageSrc(a.imageUrl)}
              alt=""
              title={a.name}
              className="h-6 w-6 rounded-full object-cover ring-2 ring-white"
            />
          ) : (
            <span
              key={a.id}
              title={a.name}
              className="grid h-6 w-6 place-items-center rounded-full bg-teal-deep text-[9px] font-bold text-white ring-2 ring-white"
            >
              {a.initials}
            </span>
          )
        )}
      </span>
      {extra > 0 && <span className="text-xs text-meta">+{extra}</span>}
    </span>
  );
}

const DOT = " · ";

export function PersonRow({ person: p }: { person: DirectoryPerson }) {
  const metaParts = [
    p.metroName,
    ...p.role_intents.map((r) => ROLE_INTENT_LABELS[r] ?? r),
  ].filter(Boolean);
  const subtitle = p.headline ?? p.primary_expertise;
  return (
    <RowShell href={p.handle ? `/u/${p.handle}` : null}>
      <PersonThumb person={p} />
      <RowBody
        title={p.displayName}
        subtitle={subtitle}
        subtitleClass={p.headline ? "text-teal-deep" : "text-charcoal"}
        meta={metaParts.length ? metaParts.join(DOT) : null}
      />
      {p.handle && <Chevron />}
    </RowShell>
  );
}

export function PodRow({ pod: p }: { pod: DirectoryPod }) {
  const metaParts = [
    p.cycleName,
    `${p.memberCount} ${p.memberCount === 1 ? "member" : "members"}`,
    p.moderatorNames.length ? `Mod: ${p.moderatorNames.join(", ")}` : null,
  ].filter(Boolean);
  return (
    <RowShell href={`/pods/${p.id}`}>
      <EntityThumb id={p.id} kind="pod" />
      <RowBody
        title={p.name ?? `Pod ${p.id}`}
        subtitle={p.statement}
        subtitleClass="text-charcoal"
        meta={metaParts.join(DOT)}
      />
      <AvatarStack avatars={p.avatars} total={p.memberCount} />
      <StatusBadge variant={STATUS_VARIANT[p.status] ?? "inactive"}>
        {p.status}
      </StatusBadge>
      <Chevron />
    </RowShell>
  );
}

export function ProjectRow({ project: p }: { project: DirectoryProject }) {
  const metaParts = [
    p.cycleName,
    p.podName,
    `${p.memberCount} ${p.memberCount === 1 ? "member" : "members"}`,
  ].filter(Boolean);
  return (
    <RowShell href={`/projects/${p.id}`}>
      <EntityThumb id={p.id} kind="project" />
      <RowBody
        title={p.name ?? `Project ${p.id}`}
        subtitle={p.summary}
        subtitleClass="text-charcoal"
        meta={metaParts.join(DOT)}
      />
      <AvatarStack avatars={p.avatars} total={p.memberCount} />
      <StatusBadge variant={STATUS_VARIANT[p.status] ?? "inactive"}>
        {p.status}
      </StatusBadge>
      <Chevron />
    </RowShell>
  );
}
