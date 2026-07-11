import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

// POST /api/metros/[metro_id]/waitlist — the waitlist join (backend doc
// §1.1b): the production twin of the prototype's confirmWaitlistJoin().
// One tap, one row; joining twice is a no-op (the UNIQUE(metro_id,
// participant_id) constraint is the contract). Only 'waitlist' metros
// accept signups — the active lab's CTA is the membership path, not a list.
export const POST = withAuth(
  async (
    _request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const metroId = parseIntParam(params.metro_id, "metro_id");
    if (metroId instanceof NextResponse) return metroId;

    const participantId = auth.user.participantId;
    if (!participantId) {
      return NextResponse.json(
        { error: "Not a registered participant", redirect: "/register" },
        { status: 403 }
      );
    }

    const supabase = createServiceClient();

    const { data: metro } = await supabase
      .from("metros")
      .select("id, status")
      .eq("id", metroId)
      .maybeSingle();

    if (!metro) {
      return NextResponse.json({ error: "Metro not found" }, { status: 404 });
    }
    if (metro.status !== "waitlist") {
      return NextResponse.json(
        { error: "This lab is already active — no waitlist to join" },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabase
      .from("metro_waitlist_signups")
      .insert({ metro_id: metroId, participant_id: participantId });

    // 23505 = unique_violation — already on the list; joining twice is fine.
    if (insertError && insertError.code !== "23505") {
      return dbError(insertError, "metro-waitlist-join");
    }

    return NextResponse.json({ joined: true }, { status: 200 });
  }
);
