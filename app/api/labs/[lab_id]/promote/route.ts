import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { setActiveLabMembership } from "@/lib/labs/membership";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

// POST /api/labs/[lab_id]/promote — HQ promotes a waitlist lab to ACTIVE
// (docs/LOCAL_LABS.md). Flips metros.status='active' and converts every
// waitlist signup into an active-lab membership (participants.metro_id), so
// the people who waited can now take part in a cycle. The signups are cleared
// once converted — they're members now, not waiters. Admin-only.
export const POST = withAdminAuth(
  async (
    _request: NextRequest,
    _auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const labId = parseIntParam(params.lab_id, "lab_id");
    if (labId instanceof NextResponse) return labId;

    const client = createServiceClient();

    const { data: lab } = await client
      .from("metros")
      .select("id, slug, status")
      .eq("id", labId)
      .maybeSingle();
    if (!lab) {
      return NextResponse.json({ error: "Lab not found" }, { status: 404 });
    }
    if (lab.status === "active") {
      return NextResponse.json(
        { error: "This lab is already active." },
        { status: 400 }
      );
    }

    const { error: upErr } = await client
      .from("metros")
      .update({ status: "active" })
      .eq("id", labId);
    if (upErr) return dbError(upErr, "lab-promote");

    // Convert waitlist signups → active-lab membership. setActiveLabMembership
    // upholds the metro_id-references-active-lab invariant (the lab is now
    // active). A waiter already in another lab is moved to this one (they
    // opted into this waitlist) — documented behavior.
    const { data: signups } = await client
      .from("metro_waitlist_signups")
      .select("participant_id")
      .eq("metro_id", labId);

    let converted = 0;
    for (const s of signups ?? []) {
      const { error } = await setActiveLabMembership(
        client,
        s.participant_id,
        labId
      );
      if (!error) converted += 1;
    }

    await client.from("metro_waitlist_signups").delete().eq("metro_id", labId);

    return NextResponse.json(
      { promoted: true, slug: lab.slug, converted },
      { status: 200 }
    );
  }
);
