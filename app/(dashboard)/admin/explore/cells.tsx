// Shared cell rendering for the list table and the detail/360 relation tables, so
// both render foreign keys, JSONB, dates, status pills and ids identically.
//
// FK cells and id cells link to the detail route /admin/explore/<entity>/<id>
// (DESIGN.md §12 step 4 — "FK links upgrade to detail-route links").

import Link from "next/link";
import { StatusBadge } from "@/app/components/ui";
import type { EntityConfig, EntityRow } from "@/lib/entity-explorer/types";

type BadgeVariant = "active" | "forming" | "inactive" | "draft" | "revoked";

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  active: "active",
  accepted: "active",
  owner: "active",
  admin: "active",
  forming: "forming",
  inactive: "inactive",
  closed: "inactive",
  observer: "inactive",
  expired: "inactive",
  pending: "draft",
  draft: "draft",
  developer: "draft",
  revoked: "revoked",
};

export function detailHref(entity: string, id: number | string): string {
  return `/admin/explore/${entity}/${id}`;
}

export function formatDate(value: unknown): string {
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
}

function isDateColumn(column: string): boolean {
  return column.endsWith("_at") || column.endsWith("_date");
}

/** Is this row soft-deleted, per its registry rule? */
export function isRowDeleted(config: EntityConfig, row: EntityRow): boolean {
  const rule = config.softDelete;
  if (!rule) return false;
  if (rule.kind === "timestamp") return row[rule.column] != null;
  return rule.deletedValues.includes(String(row[rule.column]));
}

/** Render one cell. `config` is the entity the row belongs to. */
export function renderCell(
  column: string,
  row: EntityRow,
  config: EntityConfig,
  foreignKeyLabels: Record<string, Record<string, string>>,
): React.ReactNode {
  const value = row[column];

  // Foreign key → link to the target record's detail view, labeled by labelField.
  const fk = config.foreignKeys.find((f) => f.column === column);
  if (fk && value != null) {
    const label = foreignKeyLabels[column]?.[String(value)] ?? `#${String(value)}`;
    return (
      <Link
        href={detailHref(fk.target, value as number | string)}
        className="text-aqua underline decoration-dotted underline-offset-2 hover:text-teal"
      >
        {label}
      </Link>
    );
  }

  if (value == null) return <span className="text-cloud/40">—</span>;

  // JSONB → collapsed, pretty-printed (DESIGN.md §9.5).
  if (typeof value === "object") {
    return (
      <details className="group">
        <summary className="cursor-pointer list-none font-mono text-xs text-cloud/60 hover:text-cloud">
          {"{…}"} <span className="text-cloud/40">▸</span>
        </summary>
        <pre className="mt-1 overflow-x-auto rounded border border-whisper bg-black/20 p-2 font-mono text-[11px] text-cloud/80">
          {JSON.stringify(value, null, 2)}
        </pre>
      </details>
    );
  }

  if (column === "status" || column === "role") {
    const variant = STATUS_VARIANT[String(value).toLowerCase()] ?? "inactive";
    return <StatusBadge variant={variant}>{String(value)}</StatusBadge>;
  }

  if (isDateColumn(column)) {
    return <span className="tabular-nums">{formatDate(value)}</span>;
  }

  // The primary key → link to this row's own detail view.
  if (column === "id") {
    return (
      <Link
        href={detailHref(config.key, value as number | string)}
        className="font-mono text-xs text-aqua hover:text-teal"
      >
        {String(value)}
      </Link>
    );
  }

  return <span className="text-cloud/85">{String(value)}</span>;
}
