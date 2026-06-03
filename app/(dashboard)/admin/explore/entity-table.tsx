// Generic, registry-driven table (DESIGN.md §11). Dumb renderer: it shows exactly
// the columns the registry declares, turns FK cells into links, collapses JSONB,
// badges soft-deleted rows, and paginates. No entity-specific code.
//
// Server component: the only interactivity is JSONB expand (native <details>) and
// navigation (<Link>), so no client JS is needed.

import Link from "next/link";
import type { FetchListResult } from "@/lib/entity-explorer/types";
import { isRowDeleted, renderCell } from "./cells";

function pagerHref(
  entity: string,
  cycleId: number | null,
  includeDeleted: boolean,
  page: number,
): string {
  const params = new URLSearchParams({ entity, page: String(page) });
  if (cycleId != null) params.set("cycle", String(cycleId));
  if (includeDeleted) params.set("deleted", "1");
  return `/admin/explore?${params.toString()}`;
}

export function EntityTable({
  result,
  cycleId,
  includeDeleted,
}: {
  result: FetchListResult;
  cycleId: number | null;
  includeDeleted: boolean;
}) {
  const { config, rows, page, pageSize, total, foreignKeyLabels } = result;

  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = (page - 1) * pageSize + rows.length;
  const hasPrev = page > 1;
  const hasNext = page * pageSize < total;

  return (
    <div>
      {/* Meta line */}
      <div className="mb-2 flex items-center justify-between px-1 text-xs text-cloud/70">
        <span>
          Table <span className="font-mono text-aqua">{config.table}</span>
          {config.cycleScoped && " · cycle-scoped"}
        </span>
        <span className="tabular-nums">
          {total === 0 ? "no rows" : `rows ${firstRow}–${lastRow} of ${total}`}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-teal/15">
            <tr>
              {config.columns.map((c) => (
                <th
                  key={c}
                  className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-aqua"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((row, i) => {
              const deleted = isRowDeleted(config, row);
              return (
                <tr
                  key={String(row.id ?? i)}
                  className={`transition-colors duration-150 hover:bg-teal/[0.07] ${deleted ? "text-cloud/40" : ""}`}
                >
                  {config.columns.map((c, ci) => (
                    <td
                      key={c}
                      className={`px-4 py-3 align-top ${ci === 0 && deleted ? "border-l-2 border-red" : ""}`}
                    >
                      {renderCell(c, row, config, foreignKeyLabels)}
                    </td>
                  ))}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={config.columns.length}
                  className="px-4 py-8 text-center text-sm text-cloud/60"
                >
                  No rows.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-3 flex items-center justify-between px-1 text-xs text-cloud/70">
        <span>{pageSize} rows / page</span>
        <div className="flex gap-2">
          <PagerButton
            href={pagerHref(config.key, cycleId, includeDeleted, page - 1)}
            enabled={hasPrev}
          >
            ← Prev
          </PagerButton>
          <PagerButton
            href={pagerHref(config.key, cycleId, includeDeleted, page + 1)}
            enabled={hasNext}
          >
            Next →
          </PagerButton>
        </div>
      </div>
    </div>
  );
}

function PagerButton({
  href,
  enabled,
  children,
}: {
  href: string;
  enabled: boolean;
  children: React.ReactNode;
}) {
  const base = "rounded-md border px-3 py-1.5 text-xs transition-colors";
  if (!enabled) {
    return <span className={`${base} cursor-default border-white/10 text-cloud/30`} aria-disabled>{children}</span>;
  }
  return (
    <Link href={href} className={`${base} border-teal/40 text-aqua hover:bg-teal/15 hover:text-aqua`}>
      {children}
    </Link>
  );
}
