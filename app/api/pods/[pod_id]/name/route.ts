import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isAdmin, isModeratorForPod } from "@/lib/auth/roles";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { nameUpdateSchema } from "@/lib/validations/pods";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const PATCH = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;

    if (!isAdmin(auth.user) && !isModeratorForPod(auth.user, podId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await parseBody(request, nameUpdateSchema);
    if (isErrorResponse(body)) return body;
    const { name } = body;

    const { data, error } = await auth.supabase
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
