import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { getAmbassadorSelf } from "@/lib/ambassador/data";
import { guideProgress } from "@/lib/ambassador/status";
import { notifyCoordinators } from "@/lib/ambassador/notify";

/**
 * "Tell your coordinator you're ready": all five steps are done. Replaces the
 * prototype's pre-filled text message — the coordinator now sees it in their
 * list (/ambassador/coordinator) and on their dashboard.
 */
export const POST = withAuth(async (_request, auth) => {
  const participantId = auth.user.participantId;
  if (!participantId) return NextResponse.json({ error: "Finish creating your account first." }, { status: 403 });

  const service = createServiceClient();
  const self = await getAmbassadorSelf(service, participantId);
  if (!self?.role) {
    return NextResponse.json({ error: "Only ambassadors can do this." }, { status: 403 });
  }
  if (!guideProgress(self.stepsDone).complete) {
    return NextResponse.json({ error: "Finish all five steps first." }, { status: 400 });
  }
  if (self.application?.ready_at) return NextResponse.json({ ready_at: self.application.ready_at });

  const now = new Date().toISOString();
  // An ambassador granted directly (no application) gets a row here, so the
  // coordinator's list can carry their ready/button state too.
  const { error } = self.application
    ? await service
        .from("ambassador_applications")
        // They hold the role, so the row the coordinator list reads must say so (and name their Lab).
        .update({
          ready_at: now,
          updated_at: now,
          ...(self.application.status === "approved"
            ? {}
            : { status: "approved", lab_id: self.application.lab_id ?? self.role.lab_id, decided_at: self.application.decided_at ?? self.role.granted_at }),
        })
        .eq("id", self.application.id)
    : await service.from("ambassador_applications").insert({
        participant_id: participantId,
        lab_id: self.role.lab_id,
        status: "approved",
        decided_at: self.role.granted_at,
        ready_at: now,
      });
  if (error) return dbError(error, "ambassador-ready");
  notifyCoordinators("ready_for_button", self.application?.lab_id ?? self.role.lab_id);
  return NextResponse.json({ ready_at: now });
});
