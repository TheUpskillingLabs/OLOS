import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isAdmin, isModeratorForPod } from "@/lib/auth/roles";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const PATCH = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseInt(params.pod_id);

    if (!isAdmin(auth.user) && !isModeratorForPod(auth.user, podId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || name.length > 40 || name.trim().split(/\s+/).length > 3) {
      return NextResponse.json(
        { error: "Name must be 3 words or fewer and 40 characters or fewer" },
        { status: 400 }
      );
    }

    const { data, error } = await auth.supabase
      .from("pods")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", podId)
      .select("id, name, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  }
);
