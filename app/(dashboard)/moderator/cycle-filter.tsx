"use client";

// Cycle filter for the All pods view — a poderator running multiple
// cycles' pods can scope the cards + aggregates (rollup, pulse insights,
// field survey links) to one cycle at a time. State lives in the URL
// (?cycle=, absent = all cycles) alongside the range filter, so both are
// linkable and independent.

import { useRouter, usePathname, useSearchParams } from "next/navigation";

export interface CycleOption {
  id: number;
  name: string;
}

export function CycleFilter({
  current,
  options,
}: {
  current: number | null;
  options: CycleOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Nothing to filter when everything visible is already one cycle.
  if (options.length <= 1) return null;

  return (
    <div className="inline-flex items-center gap-2">
      <label htmlFor="cycle-filter" className="lbl lbl-teal">
        Cycle
      </label>
      <select
        id="cycle-filter"
        value={current ?? ""}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString());
          if (e.target.value) params.set("cycle", e.target.value);
          else params.delete("cycle");
          const qs = params.toString();
          router.push(qs ? `${pathname}?${qs}` : pathname);
        }}
        className="rounded-card border border-ink/10 bg-white px-2.5 py-1.5 text-sm font-semibold text-ink focus:border-teal focus:outline-none"
      >
        <option value="">All cycles</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
