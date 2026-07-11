import * as React from "react";

/**
 * The "organization" tint for chips on admin surfaces (P-5/P-6): a small
 * teal-deep dot + slate text, mirroring the organization StatusBadge tone on
 * the admin cycle header — the same color pairing means "org" everywhere.
 *
 * One home for what people-table.tsx and participant-sheet.tsx used to
 * duplicate (the sheet couldn't import from the table without a cycle).
 * Server-safe: no "use client", no handlers.
 */

export const ORG_CHIP_CLASS =
  "inline-flex items-center gap-1.5 rounded-sm bg-slate/10 py-0.5 text-xs font-medium text-slate";

export function OrgDot() {
  return <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-teal-deep" />;
}

/** An org-tinted chip. Pass horizontal padding via className (px-2 / px-2.5). */
export function OrgChip({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={`${ORG_CHIP_CLASS} ${className ?? ""}`.trim()}>
      <OrgDot />
      {children}
    </span>
  );
}
