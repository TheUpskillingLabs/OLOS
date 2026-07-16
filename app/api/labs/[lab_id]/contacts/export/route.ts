import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isAdmin, isLabLead } from "@/lib/auth/roles";
import { parseIntParam } from "@/lib/api/params";
import { dbError } from "@/lib/api/errors";
import { toCsv } from "@/lib/export/csv";
import { contactsFilenameSlug } from "@/lib/export/contacts";
import {
  getLabScope,
  getLabContacts,
  buildLabContactsTable,
} from "@/lib/lab/contacts";

// Contact download for everyone who belongs to a lab → CSV (lab-lead workspace
// and the HQ per-lab drill-in). Admins and the lab's own lead only; the loader
// reads service-role because the file carries participant PII. A lab IS a
// metros row and membership is participants.metro_id, so this exports the full
// lab roster — even on the admin page that only lists lab leads.
export const GET = withAuth(async (_request, auth, params) => {
  const labId = parseIntParam(params.lab_id, "lab_id");
  if (labId instanceof NextResponse) return labId;

  const { lab, error: scopeError } = await getLabScope(labId);
  if (scopeError) return dbError(scopeError, "lab-contacts-export");
  if (!lab) {
    return NextResponse.json({ error: "Lab not found" }, { status: 404 });
  }

  const allowed = isAdmin(auth.user) || isLabLead(auth.user, labId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { rows, error } = await getLabContacts(labId);
  if (error) return dbError(error, "lab-contacts-export");

  const { columns, records } = buildLabContactsTable(rows);
  const csv = toCsv(records, columns);

  const date = new Date().toISOString().slice(0, 10);
  const slug = lab.slug || contactsFilenameSlug(lab.name, `lab-${labId}`);
  const filename = `${slug}-contacts-${date}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
