import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { ENTITY_EXPLORER_ENABLED } from "@/lib/entity-explorer/flag";
import { fetchEntityRowsForExport } from "@/lib/entity-explorer/fetch";
import { buildExplorerCsv } from "@/lib/entity-explorer/export";
import { isEntityKey } from "@/lib/entity-explorer/registry";

// Entity Explorer CSV export, admin surface: the CURRENT filters (entity +
// cycle + deleted toggle), every page, capped at EXPORT_ROW_CAP. Exactly the
// grid's allowlisted columns (plus readable _label twins for displayed FKs) —
// the file can never carry more than the screen does. Read-only, like the
// whole explorer. Admin-only via withAdminAuth; reads are service-role, so
// that gate + the flag are the only protection (DESIGN.md §8).
export const GET = withAdminAuth(async (request) => {
  if (!ENTITY_EXPLORER_ENABLED) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sp = request.nextUrl.searchParams;
  const entity = sp.get("entity");
  if (!isEntityKey(entity)) {
    return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
  }
  const cycleRaw = sp.get("cycle");
  const cycleNum = cycleRaw != null ? Number(cycleRaw) : NaN;
  const cycleId = Number.isFinite(cycleNum) ? cycleNum : null;
  const includeDeleted = sp.get("deleted") === "1";
  const search = sp.get("q");
  const filterColumn = sp.get("fcol");
  const filterValue = sp.get("fval");

  const serviceClient = createServiceClient();
  let exported;
  try {
    exported = await fetchEntityRowsForExport(serviceClient, {
      entity,
      cycleId,
      includeDeleted,
      search,
      filterColumn,
      filterValue,
    });
  } catch (error) {
    return dbError(error, "explore-export");
  }

  const csv = buildExplorerCsv(exported.config, exported.rows, exported.foreignKeyLabels);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${entity}-${date}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      // Surfaced so a capped file is detectable rather than silently partial.
      "X-Export-Truncated": exported.truncated ? "true" : "false",
    },
  });
});
