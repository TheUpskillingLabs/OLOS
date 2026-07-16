import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { toCsv } from "@/lib/export/csv";
import {
  getAuthorityRoleContacts,
  buildAuthorityContactsTable,
} from "@/lib/admin/people-contacts";

// Contact download for everyone holding an active authority role → CSV (global
// admin, Access console). Admin-only via withAdminAuth; the loader reads
// service-role because the file carries participant PII.
export const GET = withAdminAuth(async () => {
  const { rows, error } = await getAuthorityRoleContacts();
  if (error) return dbError(error, "authority-roles-contacts-export");

  const { columns, records } = buildAuthorityContactsTable(rows);
  const csv = toCsv(records, columns);

  const date = new Date().toISOString().slice(0, 10);
  const filename = `authority-roles-contacts-${date}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
