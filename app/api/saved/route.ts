import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";

// Toggle a saved item (the /learning heart). POST { item_type, slug } — if the
// member already saved it, unsave; else save. Participant identity comes from
// the session (auth.user.participantId), never the client. The slug must
// reference a real published event/resource (keeps saved_items clean). RLS on
// saved_items is self-only regardless; the service client is used to run the
// exists→delete-or-insert toggle in one place.

export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const participantId = auth.user.participantId;
    if (!participantId) {
      return NextResponse.json(
        { error: "No participant record" },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const { item_type, slug } = (body ?? {}) as {
      item_type?: unknown;
      slug?: unknown;
    };
    if (
      (item_type !== "event" && item_type !== "resource") ||
      typeof slug !== "string" ||
      !slug
    ) {
      return NextResponse.json({ error: "Invalid item" }, { status: 400 });
    }

    const service = createServiceClient();

    // The slug must be a real published item.
    const table = item_type === "event" ? "events" : "resources";
    const { data: item } = await service
      .from(table)
      .select("id")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Toggle.
    const { data: existing } = await service
      .from("saved_items")
      .select("id")
      .eq("participant_id", participantId)
      .eq("item_type", item_type)
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      const { error } = await service
        .from("saved_items")
        .delete()
        .eq("id", (existing as { id: number }).id);
      if (error) {
        return NextResponse.json({ error: "Unsave failed" }, { status: 500 });
      }
      return NextResponse.json({ saved: false });
    }

    const { error } = await service
      .from("saved_items")
      .insert({ participant_id: participantId, item_type, slug });
    if (error) {
      return NextResponse.json({ error: "Save failed" }, { status: 500 });
    }
    return NextResponse.json({ saved: true });
  }
);
