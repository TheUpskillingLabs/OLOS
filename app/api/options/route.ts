import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { NextRequest } from "next/server";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("option_lists")
    .select("id, list_name, value, display_order")
    .eq("active", true)
    .order("display_order");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
    const body = await request.json();
    const { list_name, value, display_order } = body;

    if (!list_name || !value) {
      return NextResponse.json(
        { error: "list_name and value are required" },
        { status: 400 }
      );
    }

    const { data, error } = await auth.supabase
      .from("option_lists")
      .insert({ list_name, value, display_order })
      .select("id, list_name, value")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  }
);
