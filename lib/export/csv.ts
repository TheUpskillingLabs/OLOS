// Minimal RFC-4180 CSV serializer — the repo has no CSV dependency and the
// only export need (field-survey responses → the Triangulator) is a flat
// table. Keep it dependency-free and defensive:
//   - quote a field only when it contains a comma, quote, CR, or LF;
//   - escape embedded quotes by doubling them;
//   - rows joined with CRLF, header row first;
//   - spreadsheet-injection guard: a cell that begins with a formula trigger
//     (= + - @ tab CR) is prefixed with a single quote so Excel/Sheets treats
//     it as text, not a formula.

export interface CsvColumn {
  key: string;
  header: string;
}

/** Coerce an arbitrary cell value to its CSV string form. */
export function formatCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((v) => String(v)).join("; ");
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

const INJECTION_PREFIX = /^[=+\-@\t\r]/;

/** Escape a single already-stringified cell for CSV output. */
export function escapeCsvCell(raw: string): string {
  let s = raw;
  if (INJECTION_PREFIX.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Serialize `rows` to CSV using `columns` for ordering + headers. Each row is
 * an object keyed by `column.key`; missing keys render as empty cells.
 */
export function toCsv(
  rows: Record<string, unknown>[],
  columns: CsvColumn[]
): string {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(",");
  const body = rows.map((row) =>
    columns.map((c) => escapeCsvCell(formatCsvValue(row[c.key]))).join(",")
  );
  return [header, ...body].join("\r\n");
}
