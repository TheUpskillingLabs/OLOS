import { CalendarDays, FolderKanban, MapPin, RefreshCw, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SearchResult, SearchResultType } from "@/lib/search/types";

/**
 * Result thumb for the global search — shared by the nav dropdown (sm, 28px)
 * and the /search page rows (lg, 48px). People get their photo or an
 * initials disc; every other entity gets a navy icon tile (the dropdown's
 * established identity).
 */

const TYPE_ICONS: Record<Exclude<SearchResultType, "person">, LucideIcon> = {
  pod: Users,
  project: FolderKanban,
  event: CalendarDays,
  lab: MapPin,
  cycle: RefreshCw,
};

const SIZES = {
  sm: {
    disc: "h-7 w-7 text-[10px]",
    tile: "h-7 w-7 rounded-[8px]",
    icon: "h-3.5 w-3.5",
  },
  lg: {
    disc: "h-12 w-12 text-sm",
    tile: "h-12 w-12 rounded-[10px]",
    icon: "h-5 w-5",
  },
} as const;

export default function SearchThumb({
  result: r,
  size = "sm",
}: {
  result: SearchResult;
  size?: keyof typeof SIZES;
}) {
  const s = SIZES[size];
  if (r.type === "person") {
    if (r.imageUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={r.imageUrl}
          alt=""
          className={`${s.disc} shrink-0 rounded-full object-cover`}
        />
      );
    }
    return (
      <span
        className={`${s.disc} grid shrink-0 place-items-center rounded-full bg-teal-deep font-bold text-white`}
        aria-hidden
      >
        {r.initials}
      </span>
    );
  }
  const Icon = TYPE_ICONS[r.type];
  return (
    <span
      className={`${s.tile} grid shrink-0 place-items-center bg-navy`}
      aria-hidden
    >
      <Icon className={`${s.icon} text-white/90`} />
    </span>
  );
}
