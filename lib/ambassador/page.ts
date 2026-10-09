/* The shared loader for the ambassador member pages. Reads render for the
   EFFECTIVE user (member-view simulation, lib/auth/simulation.ts), like every
   other member page; writes go through /api/ambassadors/**, which always
   authorize the real caller. */

import { cache } from "react";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { effectiveUser } from "@/lib/auth/simulation";
import { resolveUserRoles, type UserRoles } from "@/lib/auth/roles";
import { getAmbassadorSelf, isCoordinator, type AmbassadorSelf } from "./data";
import { ambassadorStage, guideProgress, type AmbassadorStage, type GuideProgress } from "./status";

export interface AmbassadorPageContext {
  self: AmbassadorSelf;
  stage: AmbassadorStage;
  progress: GuideProgress;
  roles: UserRoles;
  coordinator: boolean;
  /** The name the guide greets with. */
  firstName: string;
}

export const loadAmbassadorPage = cache(async (): Promise<AmbassadorPageContext> => {
  const user = await effectiveUser();
  if (!user) redirect("/login");
  const service = createServiceClient();
  const { data: participant } = await service.from("participants").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!participant) redirect("/register");

  const [self, roles] = await Promise.all([
    getAmbassadorSelf(service, participant.id as number),
    resolveUserRoles(service, user.id),
  ]);
  if (!self) redirect("/register");

  return {
    self,
    stage: ambassadorStage(self.application, Boolean(self.role)),
    progress: guideProgress(self.stepsDone),
    roles,
    coordinator: isCoordinator(roles),
    firstName: self.participant.preferred_name || self.participant.first_name,
  };
});
