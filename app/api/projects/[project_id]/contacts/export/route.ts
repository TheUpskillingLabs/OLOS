import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isAdmin, isModeratorForPod, isLabLead } from "@/lib/auth/roles";
import { labForPod } from "@/lib/auth/lab";
import { parseIntParam } from "@/lib/api/params";
import { dbError } from "@/lib/api/errors";
import { toCsv } from "@/lib/export/csv";
import { contactsFilenameSlug } from "@/lib/export/contacts";
import {
  getProjectScope,
  getProjectContacts,
  buildProjectContactsTable,
} from "@/lib/project/contacts";

// Contact download for everyone on a project → CSV (project page, members
// section). Reads are service-role because project_memberships embeds
// participant PII; the route re-checks authorization: admins, the pod's
// poderator, and the pod's lab lead.
export const GET = withAuth(async (_request, auth, params) => {
  const projectId = parseIntParam(params.project_id, "project_id");
  if (projectId instanceof NextResponse) return projectId;

  const { scope, error: scopeError } = await getProjectScope(projectId);
  if (scopeError) return dbError(scopeError, "project-contacts-export");
  if (!scope) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const labId = scope.pod_id != null ? await labForPod(scope.pod_id) : null;
  const allowed =
    isAdmin(auth.user) ||
    (scope.pod_id != null && isModeratorForPod(auth.user, scope.pod_id)) ||
    (labId != null && isLabLead(auth.user, labId));
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { rows, error } = await getProjectContacts(projectId);
  if (error) return dbError(error, "project-contacts-export");

  const { columns, records } = buildProjectContactsTable(rows);
  const csv = toCsv(records, columns);

  const date = new Date().toISOString().slice(0, 10);
  const slug = contactsFilenameSlug(scope.name, `project-${projectId}`);
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
