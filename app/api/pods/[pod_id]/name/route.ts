import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { isModeratorForPod } from "@/lib/auth/roles";
import { requirePodManagement } from "@/lib/auth/cycle-access";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { nameUpdateSchema } from "@/lib/validations/pods";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const PATCH = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;

    // The pod's moderator, or a lifecycle manager scoped to this pod's lab.
    if (!isModeratorForPod(auth.user, podId)) {
      const guard = await requirePodManagement(auth.supabase, auth.user, podId);
      if (guard) return guard;
    }

    const body = await parseBody(request, nameUpdateSchema);
    if (isErrorResponse(body)) return body;
    const { name } = body;

    // Authorization is enforced above (admin or the pod's own moderator). The
    // write runs on the service client because the pods_update RLS policy
    // requires is_admin_or_owner(); a moderator would otherwise match 0 rows
    // and .single() would 500 (audit fix).
    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient
      .from("pods")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", podId)
      .select("id, name, updated_at")
      .single();

    if (error) {
      return dbError(error);
    }

    return NextResponse.json(data);
  }
);
