/* Server loader for the dashboard's Ambassador launch banner
   (lib/ambassador/launch.ts has the rules). One small read: the member's
   ambassador state, plus whether they dismissed this version. */

import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { getAmbassadorSelf } from "./data";
import { ambassadorStage } from "./status";
import { AMB_JOIN_COOKIE } from "./join-cookie";
import { ui } from "./content";
import { launchBannerKey, launchBannerVariant, launchWindowOpen, type LaunchBannerVariant } from "./launch";

export async function ambassadorLaunchBanner(
  participantId: number,
  now = new Date()
): Promise<{ variant: LaunchBannerVariant; dismissKey: string } | null> {
  const service = createServiceClient();
  const [self, jar] = await Promise.all([getAmbassadorSelf(service, participantId), cookies()]);
  if (!self) return null;

  const variant = launchBannerVariant({
    stage: ambassadorStage(self.application, Boolean(self.role)),
    windowOpen: launchWindowOpen(ui.launch.until, now),
    cameThroughFrontDoor: jar.has(AMB_JOIN_COOKIE),
  });
  if (!variant) return null;

  const dismissKey = launchBannerKey(variant);
  const { data } = await service
    .from("task_dismissals")
    .select("task_key")
    .eq("participant_id", participantId)
    .eq("task_key", dismissKey)
    .maybeSingle();
  return data ? null : { variant, dismissKey };
}
