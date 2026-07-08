import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { parseIntParam } from "@/lib/api/params";
import { setActiveLabMembership } from "@/lib/labs/membership";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

// POST /api/labs/[lab_id]/join — join an ACTIVE Local Lab (docs/LOCAL_LABS.md).
// Sets participants.metro_id to the lab (the membership spine). 400 if the lab
// is still a waitlist — the caller must use POST /api/labs/waitlist for those.
export const POST = withAuth(
  async (
    _request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const labId = parseIntParam(params.lab_id, "lab_id");
    if (labId instanceof NextResponse) return labId;

    const participantId = auth.user.participantId;
    if (!participantId) {
      return NextResponse.json(
        { error: "Not a registered participant", redirect: "/register" },
        { status: 403 }
      );
    }

    const supabase = createServiceClient();
    const { lab, error } = await setActiveLabMembership(
      supabase,
      participantId,
      labId
    );
    if (error || !lab) {
      return NextResponse.json(
        { error: error ?? "Could not join this lab" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { joined: true, lab: { id: lab.id, slug: lab.slug } },
      { status: 200 }
    );
  }
);
