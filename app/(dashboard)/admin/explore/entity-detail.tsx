// Generic detail / 360 renderer (DESIGN.md §6.1): the base row up top, then every
// table that references it as its own section — all assembled from the registry's
// reverse relations, no bespoke query per entity. Empty relations render as
// explicit "no rows" sections so nothing looks missing.

import type { EntityRow, FetchDetailResult, RelationResult } from "@/lib/entity-explorer/types";
import { renderCell } from "./cells";

export function EntityDetail({ result }: { result: FetchDetailResult }) {
  const { config, row, foreignKeyLabels, relations } = result;
  // The route guarantees a non-null row before rendering.
  const baseRow = row as EntityRow;
  const id = String(baseRow.id);

  const titleRaw = baseRow[config.labelField];
  const title =
    config.labelField !== "id" && titleRaw != null && titleRaw !== ""
      ? String(titleRaw)
      : `${config.label} #${id}`;

  return (
    <div>
      {/* Base row header */}
      <div className="mb-4 rounded-card border border-teal/40 bg-gradient-to-br from-teal/10 to-white p-5 shadow-card">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-lg font-bold text-ink">{title}</span>
          <span className="rounded-sm bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal-deep">
            {config.label} #{id}
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {config.columns.map((c) => (
            <div key={c} className="flex flex-col">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-teal-deep">
                {c}
              </dt>
              <dd className="text-sm">{renderCell(c, baseRow, config, foreignKeyLabels)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="mb-4 text-sm text-slate">
        Base row up top; every table that references this record is rendered below as
        its own section, assembled from the registry&rsquo;s reverse relations.
      </p>

      {relations.length === 0 ? (
        <p className="text-sm text-meta">
          This entity declares no reverse relations.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {relations.map((rel) => (
            <RelationCard key={rel.relation.entity + rel.relation.via} rel={rel} />
          ))}
        </div>
      )}
    </div>
  );
}

function RelationCard({ rel }: { rel: RelationResult }) {
  const { relation, config, rows, total, truncated, foreignKeyLabels } = rel;
  const empty = total === 0;

  return (
    <div className="overflow-hidden rounded-card border border-ink/10 bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-teal/20 bg-teal/10 px-4 py-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-teal-deep">
          {relation.label}
        </span>
        <span
          className={`ml-auto rounded-sm px-2 py-0.5 text-[10px] font-bold ${
            empty ? "bg-ink/[0.06] text-meta" : "bg-teal/15 text-teal-deep"
          }`}
        >
          {total}
        </span>
      </div>

      {empty ? (
        <p className="px-4 py-4 text-xs italic text-meta">No related rows.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-ink/[0.02]">
              <tr>
                {config.columns.map((c) => (
                  <th
                    key={c}
                    className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-teal-deep"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {rows.map((row, i) => (
                <tr key={String(row.id ?? i)} className="transition-colors hover:bg-ink/[0.02]">
                  {config.columns.map((c) => (
                    <td key={c} className="px-3 py-2 align-top">
                      {renderCell(c, row, config, foreignKeyLabels)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {truncated && (
            <p className="px-3 py-2 text-[11px] text-meta">
              Showing first {rows.length} of {total}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
