/**
 * Shared per-request context for the pod sub-page surface
 * (app/(dashboard)/moderator/pods/[pod_id]/*): one guard + one data fetch,
 * memoized with React.cache() so the layout (nav shell + badges) and the
 * active sub-page share a single auth round-trip and pod-detail query.
 *
 * Auth is the per-pod dashboard's existing pattern: admin (any pod) OR an
 * active moderator assignment for THIS pod, resolved for effectiveUser()
 * so member-view simulation behaves like the rest of the moderator surface.
 */
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveUserRoles, isAdmin, isModeratorForPod, type UserRoles } from "@/lib/auth/roles";
import { effectiveUser } from "@/lib/auth/simulation";
import { getPodDetail, type PodDetail } from "@/lib/moderator/pod-detail";
import { getPodsForUser, type PodCard } from "@/lib/moderator/pods-list";

export interface PodContext {
  podId: number;
  detail: PodDetail;
  /** Pods the caller can see — feeds the left-nav pod filter. */
  switcherPods: PodCard[];
  userRoles: UserRoles;
  serviceClient: ReturnType<typeof createServiceClient>;
  /** Members counted for badges/groups: active, non-staff. */
  realMembers: PodDetail["members"];
  /** At-risk, not dismissed — the Overview badge + group row. */
  atRiskMembers: PodDetail["members"];
  /** One miss from at-risk. */
  trendingMembers: PodDetail["members"];
  /** feedback rows with status 'new' among pod members. */
  newFeedbackCount: number;
}

export const getPodContext = cache(
  async (podIdParam: string): Promise<PodContext> => {
    const podId = Number.parseInt(podIdParam, 10);
    if (Number.isNaN(podId)) notFound();

    const user = await effectiveUser();
    if (!user) redirect("/login");

    const serviceClient = createServiceClient();
    const userRoles = await resolveUserRoles(serviceClient, user.id);
    if (!isAdmin(userRoles) && !isModeratorForPod(userRoles, podId)) {
      redirect("/moderator");
    }

    const [detail, switcherPods] = await Promise.all([
      getPodDetail(serviceClient, podId, userRoles.participantId),
      getPodsForUser(serviceClient, userRoles),
    ]);
    if (!detail) notFound();

    const realMembers = detail.members.filter(
      (m) => !m.is_staff_or_test && !m.is_inactive
    );
    const atRiskMembers = realMembers.filter(
      (m) => m.pulse_status === "at_risk" && !m.nudge_dismissed
    );
    const trendingMembers = realMembers.filter((m) => m.is_trending_at_risk);

    const memberIds = realMembers.map((m) => m.participant_id);
    let newFeedbackCount = 0;
    if (memberIds.length > 0) {
      const { count } = await serviceClient
        .from("feedback")
        .select("id", { head: true, count: "exact" })
        .in("participant_id", memberIds)
        .eq("status", "new");
      newFeedbackCount = count ?? 0;
    }

    return {
      podId,
      detail,
      switcherPods,
      userRoles,
      serviceClient,
      realMembers,
      atRiskMembers,
      trendingMembers,
      newFeedbackCount,
    };
  }
);
