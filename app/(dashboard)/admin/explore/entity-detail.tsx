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
      <div className="mb-4 rounded-lg border border-teal/30 bg-teal/10 p-5">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-lg font-bold text-white">{title}</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-cloud/70">
            {config.label} #{id}
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {config.columns.map((c) => (
            <div key={c} className="flex flex-col">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-cloud/50">
                {c}
              </dt>
              <dd className="text-sm">{renderCell(c, baseRow, config, foreignKeyLabels)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="mb-4 text-sm text-cloud/60">
        Base row up top; every table that references this record is rendered below as
        its own section, assembled from the registry&rsquo;s reverse relations.
      </p>

      {relations.length === 0 ? (
        <p className="text-sm text-cloud/50">
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
    <div className="overflow-hidden rounded-lg border border-whisper bg-white/[0.02]">
      <div className="flex items-center gap-2 border-b border-whisper bg-white/[0.04] px-4 py-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-cloud/70">
          {relation.label}
        </span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${
            empty ? "bg-white/10 text-cloud/50" : "bg-teal/20 text-aqua"
          }`}
        >
          {total}
        </span>
      </div>

      {empty ? (
        <p className="px-4 py-4 text-xs italic text-cloud/40">No related rows.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-white/[0.02]">
              <tr>
                {config.columns.map((c) => (
                  <th
                    key={c}
                    className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-cloud/50"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-whisper">
              {rows.map((row, i) => (
                <tr key={String(row.id ?? i)} className="hover:bg-white/[0.02]">
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
            <p className="px-3 py-2 text-[11px] text-cloud/50">
              Showing first {rows.length} of {total}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
