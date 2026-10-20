/* The dashboard's Ambassador launch banner — which version a member sees, if
   any. Pure module (no Supabase): lib/ambassador/banner.ts loads the inputs.

     launch  — the program is open: everyone who hasn't applied, until the
               launch window closes (ui.launch.until).
     pending — they've applied: two reviewers are looking at it.

   Nothing for members part way through (the "Continue your application"
   dashboard task covers them), anyone who came through the ambassador front
   door (the "apply" task covers them — a fact appears once per page), or
   anyone already decided. Each version is dismissed on its own key, so
   dismissing the launch banner never hides the news that an application is
   in review. */

import { ambassadorTaskKey } from "@/lib/tasks/keys";
import type { AmbassadorStage } from "./status";

export type LaunchBannerVariant = "launch" | "pending";

/** The dismissal key for each version (task_dismissals, 00096). */
export function launchBannerKey(variant: LaunchBannerVariant): string {
  return ambassadorTaskKey(variant === "launch" ? "launch" : "launch_pending");
}

/** The launch window is open until `until` (a YYYY-MM-DD date, exclusive, UTC). */
export function launchWindowOpen(until: string | null | undefined, now: Date): boolean {
  if (!until) return true;
  const end = Date.parse(`${until}T00:00:00Z`);
  return Number.isNaN(end) ? false : now.getTime() < end;
}

export function launchBannerVariant(input: {
  stage: AmbassadorStage;
  windowOpen: boolean;
  cameThroughFrontDoor: boolean;
}): LaunchBannerVariant | null {
  if (input.stage === "pending") return "pending";
  if (input.stage === "none" && input.windowOpen && !input.cameThroughFrontDoor) return "launch";
  return null;
}
