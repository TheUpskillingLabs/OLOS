import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isAdmin, isModeratorForPod, isLabLead } from "@/lib/auth/roles";
import { parseIntParam } from "@/lib/api/params";
import { dbError } from "@/lib/api/errors";
import { toCsv } from "@/lib/export/csv";
import { contactsFilenameSlug } from "@/lib/export/contacts";
import {
  getPodScope,
  getPodContacts,
  buildPodContactsTable,
} from "@/lib/pod/contacts";

// Contact download for every member of a pod → CSV. Authorized for admins, the
// pod's poderator, or the pod's lab lead (the file carries participant PII).
// Reads are service-role because pod_memberships/participants are RLS-locked,
// so the loaders re-fetch with the service client; this route re-checks the
// same authorization the member/moderator/admin surfaces gate the button on.
export const GET = withAuth(async (_request, auth, params) => {
  const podId = parseIntParam(params.pod_id, "pod_id");
  if (podId instanceof NextResponse) return podId;

  const { scope, error: scopeError } = await getPodScope(podId);
  if (scopeError) return dbError(scopeError, "pod-contacts-export");
  if (!scope) {
    return NextResponse.json({ error: "Pod not found" }, { status: 404 });
  }

  const allowed =
    isAdmin(auth.user) ||
    isModeratorForPod(auth.user, podId) ||
    (scope.lab_id != null && isLabLead(auth.user, scope.lab_id));
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { rows, error } = await getPodContacts(podId);
  if (error) return dbError(error, "pod-contacts-export");

  const { columns, records } = buildPodContactsTable(rows);
  const csv = toCsv(records, columns);

  const date = new Date().toISOString().slice(0, 10);
  const filename = `${contactsFilenameSlug(scope.name, `pod-${podId}`)}-contacts-${date}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
