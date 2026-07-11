import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { feedbackStatusPatchSchema } from "@/lib/validations/feedback";

// Triage a feedback submission (PATCH) — the only edit the review UI makes.
// Admin-only (withAdminAuth); the DB feedback_update policy is also admin/owner,
// but we write with the service client here, consistent with the admin reads.
export const PATCH = withAdminAuth(
  async (
    request: NextRequest,
    _auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const id = parseIntParam(params.id, "id");
    if (id instanceof NextResponse) return id;

    const body = await parseBody(request, feedbackStatusPatchSchema);
    if (isErrorResponse(body)) return body;

    const service = createServiceClient();
    const { data, error } = await service
      .from("feedback")
      .update({ status: body.status })
      .eq("id", id)
      .select("id, status")
      .maybeSingle();

    if (error) return dbError(error, "feedback-status-update");
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(data);
  }
);
