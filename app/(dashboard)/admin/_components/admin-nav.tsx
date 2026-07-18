"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Building2,
  MapPin,
  Users,
  KeyRound,
  FileText,
  Megaphone,
  CalendarDays,
  ClipboardList,
  MessageSquare,
  Database,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

/**
 * The persistent admin section nav — a left rail on desktop, a horizontal
 * scroll row on mobile. Lives inside the admin layout's <main>; the top AppNav
 * already owns the "Admin" persona pill + "Exit to member view".
 *
 * Active-state matching mirrors AppNav's isActive(pathname, prefix) helper. The
 * Data (Entity Explorer) item only renders when the feature flag is on — the
 * flag is server-only, so the layout resolves it and passes `showData` in.
 *
 * The item set is transitional: Participants + Invitations consolidate into a
 * single "People & Access" section, and Content settles at /admin/content, as
 * those phases land.
 */

type NavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
  match: (pathname: string) => boolean;
};

const BASE_ITEMS: NavItem[] = [
  {
    href: "/admin",
    label: "Cycles",
    Icon: LayoutGrid,
    match: (p) => p === "/admin" || p.startsWith("/admin/cycles"),
  },
  {
    href: "/admin/org",
    label: "Organization",
    Icon: Building2,
    match: (p) => p.startsWith("/admin/org"),
  },
  {
    href: "/admin/labs",
    label: "Local Labs",
    Icon: MapPin,
    match: (p) => p.startsWith("/admin/labs"),
  },
  {
    href: "/admin/people",
    label: "People & Access",
    Icon: Users,
    match: (p) =>
      p.startsWith("/admin/people") ||
      p.startsWith("/admin/participants") ||
      p.startsWith("/admin/invitations"),
  },
  {
    href: "/admin/access",
    label: "Access",
    Icon: KeyRound,
    match: (p) => p.startsWith("/admin/access"),
  },
  {
    href: "/admin/content",
    label: "Content",
    Icon: FileText,
    match: (p) => p.startsWith("/admin/content") || p.startsWith("/admin/stories"),
  },
  {
    href: "/admin/announcements",
    label: "Announcements",
    Icon: Megaphone,
    match: (p) => p.startsWith("/admin/announcements"),
  },
  {
    href: "/admin/weekly-messages",
    label: "Weekly messages",
    Icon: CalendarDays,
    match: (p) => p.startsWith("/admin/weekly-messages"),
  },
  {
    href: "/admin/surveys",
    label: "Surveys",
    Icon: ClipboardList,
    match: (p) => p.startsWith("/admin/surveys"),
  },
  {
    href: "/admin/feedback",
    label: "Feedback",
    Icon: MessageSquare,
    match: (p) => p.startsWith("/admin/feedback"),
  },
];

const DATA_ITEM: NavItem = {
  href: "/admin/explore",
  label: "Data",
  Icon: Database,
  match: (p) => p.startsWith("/admin/explore") || p.startsWith("/admin/data"),
};

// Owner-only lifecycle console (archive/reset/delete any entity). Flag-gated and
// owner-gated — the layout only sets showOwner when both hold.
const OWNER_ITEM: NavItem = {
  href: "/admin/owner",
  label: "Owner",
  Icon: ShieldAlert,
  match: (p) => p.startsWith("/admin/owner"),
};

export default function AdminNav({
  showData,
  showOwner = false,
}: {
  showData: boolean;
  showOwner?: boolean;
}) {
  const pathname = usePathname() || "";
  const items = [
    ...BASE_ITEMS,
    ...(showData ? [DATA_ITEM] : []),
    ...(showOwner ? [OWNER_ITEM] : []),
  ];

  return (
    <nav
      aria-label="Admin sections"
      className="-mx-1 flex shrink-0 gap-1 overflow-x-auto px-1 pb-1 md:mx-0 md:w-52 md:flex-col md:overflow-visible md:px-0 md:pb-0"
    >
      {items.map(({ href, label, Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-card px-3 py-2 text-sm font-medium tracking-tight transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal ${
              active
                ? "bg-teal/10 text-teal-deep"
                : "text-charcoal hover:bg-ink/[0.04] hover:text-ink"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
