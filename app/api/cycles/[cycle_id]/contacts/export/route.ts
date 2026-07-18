import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import { parseIntParam } from "@/lib/api/params";
import { dbError } from "@/lib/api/errors";
import { toCsv } from "@/lib/export/csv";
import {
  getCycleContacts,
  buildCycleContactsTable,
} from "@/lib/cycle/contacts";

// Contact download for everyone enrolled in a cycle → CSV (admin panel, cycle
// People tab). Admin-only via withAdminAuth; the loader reads service-role
// because cycle_enrollments is RLS-locked and the file carries participant PII.
export const GET = withAdminAuth(async (_request, _auth, params) => {
  const cycleId = parseIntParam(params.cycle_id, "cycle_id");
  if (cycleId instanceof NextResponse) return cycleId;

  const { cycle, rows, error } = await getCycleContacts(cycleId);
  if (error) return dbError(error, "cycle-contacts-export");
  if (!cycle) {
    return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
  }

  const { columns, records } = buildCycleContactsTable(rows);
  const csv = toCsv(records, columns);

  const date = new Date().toISOString().slice(0, 10);
  const filename = `${cycle.slug}-contacts-${date}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
