"use client";

// The shared three-state time-range control (design doc §3). State lives in
// the URL (?range=, absent = week) so every range view is linkable and the
// server components re-fetch on change. Rendered by each sub-page that has
// range-scopable data; pages whose content is purely current-state say so
// instead of showing an inert control.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RANGE_LABELS, type PodRange } from "@/lib/moderator/range";

const ORDER: PodRange[] = ["week", "4w", "cycle"];

export function RangeToggle({ current }: { current: PodRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setRange = (range: PodRange) => {
    const params = new URLSearchParams(searchParams.toString());
    if (range === "week") params.delete("range");
    else params.set("range", range);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="inline-flex overflow-hidden rounded-card border border-ink/10 bg-white text-xs">
      {ORDER.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => setRange(r)}
          className={`px-3 py-1.5 transition-colors ${
            r === current
              ? "bg-teal/10 font-semibold text-teal-deep"
              : "text-slate hover:text-ink"
          }`}
          aria-pressed={r === current}
        >
          {RANGE_LABELS[r]}
        </button>
      ))}
    </div>
  );
}
