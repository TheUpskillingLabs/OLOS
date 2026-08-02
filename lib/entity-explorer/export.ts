// Entity Explorer — CSV shaping for the export routes (admin + poderator).
//
// Flat, registry-driven: exactly the allowlisted display columns, in order —
// the CSV can never carry more than the on-screen grid does. JSONB cells are
// JSON-stringified; each displayed forward-FK column gains a human-readable
// `<column>_label` twin so the file is usable without joins. Serialization
// (quoting, CRLF, spreadsheet-injection guard) is lib/export/csv.ts.

import { toCsv, type CsvColumn } from "@/lib/export/csv";
import type { EntityConfig, EntityRow } from "./types";

export function buildExplorerCsv(
  config: EntityConfig,
  rows: EntityRow[],
  foreignKeyLabels: Record<string, Record<string, string>>,
): string {
  // Only FK columns the grid displays get a _label twin — hidden FK columns
  // (e.g. project_votes.pod_id) stay out of the file entirely.
  const labeledFks = config.foreignKeys.filter((fk) =>
    config.columns.includes(fk.column),
  );

  const columns: CsvColumn[] = [
    ...config.columns.map((c) => ({ key: c, header: c })),
    ...labeledFks.map((fk) => ({
      key: `${fk.column}_label`,
      header: `${fk.column}_label`,
    })),
  ];

  const records = rows.map((row) => {
    const record: Record<string, unknown> = {};
    for (const column of config.columns) {
      const value = row[column];
      record[column] =
        value != null && typeof value === "object" ? JSON.stringify(value) : value;
    }
    for (const fk of labeledFks) {
      const value = row[fk.column];
      record[`${fk.column}_label`] =
        value == null ? "" : (foreignKeyLabels[fk.column]?.[String(value)] ?? "");
    }
    return record;
  });

  return toCsv(records, columns);
}
