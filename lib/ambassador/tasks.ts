/* The dashboard's Ambassador tasks (lib/tasks/assemble.ts, kind
   "ambassador"). One task at most for the member's own ladder, plus one for a
   coordinator with people waiting:

     apply       — a new member came through the ambassador front door
                   (/ambassador/start parked the amb_join cookie) and hasn't
                   started: registration always lands on the dashboard, so
                   this is the way back to the application.
     continue    — part way through orientation.
     guide       — an ambassador with guide steps left.
     ready       — all five done: tell your coordinator.
     coordinator — a Lab lead/admin with applications or buttons waiting.

   Pending, declined and finished ambassadors get no task: nothing to do. */

import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import type { TaskInputs } from "@/lib/tasks/assemble";
import type { UserRoles } from "@/lib/auth/roles";
import { AMB_JOIN_COOKIE } from "./join-cookie";
import { coordinatorQueueCount, getAmbassadorSelf } from "./data";
import { ambassadorStage, guideProgress } from "./status";
import { AMBASSADOR_APPLY, AMBASSADOR_COORDINATOR, AMBASSADOR_HOME, fill, ui } from "./content";

type AmbassadorTask = NonNullable<TaskInputs["ambassador"]>[number];

/** The minimal UserRoles a coordinator check needs, from participant_roles. */
async function coordinatorRoles(participantId: number): Promise<UserRoles | null> {
  const service = createServiceClient();
  const { data } = await service
    .from("participant_roles")
    .select("role, lab_id")
    .eq("participant_id", participantId)
    .in("role", ["owner", "admin", "developer", "lab_lead"])
    .is("revoked_at", null);
  if (!data || data.length === 0) return null;
  const roles = data.filter((r) => r.role !== "lab_lead").map((r) => r.role) as UserRoles["roles"];
  const labLeadLabIds = data.filter((r) => r.role === "lab_lead" && r.lab_id != null).map((r) => r.lab_id as number);
  return {
    userId: "",
    participantId,
    roles,
    permissions: [],
    moderatorPodIds: [],
    labLeadLabIds,
    cycleEnrollments: [],
  };
}

export async function ambassadorTasks(participantId: number): Promise<AmbassadorTask[]> {
  const service = createServiceClient();
  const [self, roles, jar] = await Promise.all([
    getAmbassadorSelf(service, participantId),
    coordinatorRoles(participantId),
    cookies(),
  ]);
  const tasks: AmbassadorTask[] = [];
  if (!self) return tasks;

  const stage = ambassadorStage(self.application, Boolean(self.role));
  // The front door always parks the cookie (even with no invite or referrer).
  const cameThroughFrontDoor = jar.has(AMB_JOIN_COOKIE);

  if (stage === "none" && cameThroughFrontDoor) {
    tasks.push({
      stage: "apply",
      eyebrow: "Ambassador",
      title: "Continue to the ambassador application",
      detail: ui.home.nudge,
      href: AMBASSADOR_APPLY,
      cta: ui.home.apply,
      dismissible: true,
    });
  } else if (stage === "applying") {
    tasks.push({
      stage: "continue",
      eyebrow: "Ambassador",
      title: ui.home.applyContinue,
      detail: ui.home.nudge,
      href: AMBASSADOR_APPLY,
      cta: "Continue",
      dismissible: true,
    });
  } else if (stage === "ambassador") {
    const p = guideProgress(self.stepsDone);
    if (p.next) {
      tasks.push({
        stage: "guide",
        eyebrow: "Ambassador",
        title: p.count === 0 ? "Get ready: start the ambassador guide" : fill(ui.home.continue, { title: p.next.title }),
        detail: fill(ui.nav.progress, { n: p.count, total: p.total }),
        href: p.next.href,
        cta: p.count === 0 ? ui.home.start : "Continue",
        dismissible: true,
      });
    } else if (!self.application?.ready_at) {
      tasks.push({
        stage: "ready",
        eyebrow: "Ambassador",
        title: ui.home.claim,
        detail: ui.home.doneGoal,
        href: AMBASSADOR_HOME,
        cta: "Open",
        dismissible: false,
      });
    }
  }

  if (roles) {
    const waiting = await coordinatorQueueCount(service, roles);
    if (waiting > 0) {
      tasks.push({
        stage: "coordinator",
        eyebrow: "Coordinator",
        title: waiting === 1 ? "One ambassador is waiting for you" : `${waiting} ambassadors are waiting for you`,
        detail: "Confirm new ambassadors, or hand over a button.",
        href: AMBASSADOR_COORDINATOR,
        cta: "Review",
        dismissible: false,
      });
    }
  }
  return tasks;
}
