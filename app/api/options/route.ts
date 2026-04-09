import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { NextRequest } from "next/server";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { createOptionSchema } from "@/lib/validations/pods";

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("option_lists")
    .select("id, list_name, value, display_order")
    .eq("active", true)
    .order("display_order");

  if (error) {
    return dbError(error);
  }

  const grouped: Record<string, { id: number; value: string }[]> = {};
  for (const row of data) {
    if (!grouped[row.list_name]) grouped[row.list_name] = [];
    grouped[row.list_name].push({ id: row.id, value: row.value });
  }

  return NextResponse.json(grouped);
}

export const POST = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, createOptionSchema);
    if (isErrorResponse(body)) return body;
    const { list_name, value, display_order } = body;

    const { data, error } = await auth.supabase
      .from("option_lists")
      .insert({ list_name, value, display_order })
      .select("id, list_name, value")
      .single();

    if (error) {
      return dbError(error);
    }

    return NextResponse.json(data, { status: 201 });
  }
);
