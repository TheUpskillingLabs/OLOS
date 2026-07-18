import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { toCsv } from "@/lib/export/csv";
import {
  getAllPeopleContacts,
  buildAllPeopleContactsTable,
} from "@/lib/admin/people-contacts";

// Contact download for everyone in the org → CSV (global admin, People tab).
// Admin-only via withAdminAuth; the loader reads service-role because the file
// carries participant PII.
export const GET = withAdminAuth(async () => {
  const { rows, error } = await getAllPeopleContacts();
  if (error) return dbError(error, "all-people-contacts-export");

  const { columns, records } = buildAllPeopleContactsTable(rows);
  const csv = toCsv(records, columns);

  const date = new Date().toISOString().slice(0, 10);
  const filename = `all-people-contacts-${date}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
