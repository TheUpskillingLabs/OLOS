import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isAdmin, isModeratorForPod } from "@/lib/auth/roles";
import { parseIntParam } from "@/lib/api/params";
import { dbError } from "@/lib/api/errors";
import { createServiceClient } from "@/lib/supabase/server";
import { ENTITY_EXPLORER_ENABLED } from "@/lib/entity-explorer/flag";
import { fetchEntityRowsForExport } from "@/lib/entity-explorer/fetch";
import { buildExplorerCsv } from "@/lib/entity-explorer/export";
import { isModeratorEntityKey } from "@/lib/entity-explorer/registry";

// Entity Explorer CSV export, pod surface: same shape as the admin export
// (app/api/admin/explore/export) with the pod fence of the pages — entity must
// be pod-scoped (registry allowlist), podId is forced from the route path, and
// the caller must be an admin or THIS pod's poderator (the auth pattern of
// app/api/pods/[pod_id]/contacts/export, which already hands poderators
// member PII as CSV). Read-only; reads are service-role, so these checks + the
// flag are the only protection.
export const GET = withAuth(async (request, auth, params) => {
  if (!ENTITY_EXPLORER_ENABLED) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const podId = parseIntParam(params.pod_id, "pod_id");
  if (podId instanceof NextResponse) return podId;

  if (!isAdmin(auth.user) && !isModeratorForPod(auth.user, podId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const entity = sp.get("entity");
  if (!isModeratorEntityKey(entity)) {
    return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
  }
  const includeDeleted = sp.get("deleted") === "1";
  const search = sp.get("q");
  const filterColumn = sp.get("fcol");
  const filterValue = sp.get("fval");

  const serviceClient = createServiceClient();
  let exported;
  try {
    exported = await fetchEntityRowsForExport(serviceClient, {
      entity,
      podId,
      includeDeleted,
      search,
      filterColumn,
      filterValue,
    });
  } catch (error) {
    return dbError(error, "pod-explore-export");
  }

  const csv = buildExplorerCsv(exported.config, exported.rows, exported.foreignKeyLabels);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `pod-${podId}-${entity}-${date}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Export-Truncated": exported.truncated ? "true" : "false",
    },
  });
});
