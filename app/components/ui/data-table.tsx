import * as React from "react";

/**
 * The shared admin table. Extracts the markup every admin page hand-rolled
 * verbatim — `rounded-card border shadow-card` shell + `bg-ink/[0.02]` head +
 * `divide-y divide-ink/10` hover rows — into one config-driven component so a
 * single restyle (DESIGN_INTENT rule 12) reaches every admin table.
 *
 * Presentational and server-safe: no "use client", no event handlers on the
 * table itself. Row-level interactivity lives inside a column's `cell` (a Link
 * or button), so this works as a Server Component AND inside Client Components.
 */

export type Column<T> = {
  /** Stable key for React + the column identity. */
  key: string;
  /** Header cell content. Pass "" for an unlabeled actions column. */
  header: React.ReactNode;
  /** Text alignment (default left). */
  align?: "left" | "right";
  /** Extra classes applied to each body `<td>` (e.g. "font-medium text-ink"). */
  className?: string;
  /** Renders the body cell for a row. */
  cell: (row: T) => React.ReactNode;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty = "Nothing to show.",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => React.Key;
  empty?: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-card border border-ink/10 bg-white shadow-card">
      <table className="w-full text-sm">
        <thead className="bg-ink/[0.02]">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`lbl px-4 py-3 ${c.align === "right" ? "text-right" : "text-left"}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/10">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-sm text-meta">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                className="transition-colors duration-150 hover:bg-ink/[0.02]"
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-4 py-3 ${c.align === "right" ? "text-right" : ""} ${c.className ?? ""}`.trim()}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
