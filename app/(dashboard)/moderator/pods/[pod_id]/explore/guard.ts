// Shared gate for the pod-scoped explorer pages (list + detail) and nothing
// else — the export API route re-implements the same checks with the API-shaped
// middleware (withAuth) instead.
//
// Order matters: flag → login → pod-scoped role. Same auth pattern as the
// per-pod dashboard page (app/(dashboard)/moderator/pods/[pod_id]/page.tsx):
// admin (any pod) OR an active moderator assignment for THIS pod. Reads run
// with the service-role client (RLS bypassed), so this gate — plus the forced
// podId in every fetch — is the only protection. `effectiveUser()` keeps
// member-view simulation consistent with the rest of the moderator surface;
// it can only ever narrow admin access, never widen a member's.

import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveUserRoles, isAdmin, isModeratorForPod } from "@/lib/auth/roles";
import { effectiveUser } from "@/lib/auth/simulation";
import { ENTITY_EXPLORER_ENABLED } from "@/lib/entity-explorer/flag";

export interface PodExplorerContext {
  podId: number;
  pod: { id: number; name: string | null; cycle_id: number };
  serviceClient: ReturnType<typeof createServiceClient>;
}

export async function requirePodExplorer(
  podIdParam: string,
): Promise<PodExplorerContext> {
  // Feature flag (shared with the admin explorer): off → the route doesn't exist.
  if (!ENTITY_EXPLORER_ENABLED) notFound();

  const podId = Number.parseInt(podIdParam, 10);
  if (Number.isNaN(podId)) notFound();

  const user = await effectiveUser();
  if (!user) redirect("/login");

  const serviceClient = createServiceClient();
  const userRoles = await resolveUserRoles(serviceClient, user.id);
  if (!isAdmin(userRoles) && !isModeratorForPod(userRoles, podId)) {
    redirect("/moderator");
  }

  const { data: pod, error } = await serviceClient
    .from("pods")
    .select("id, name, cycle_id")
    .eq("id", podId)
    .maybeSingle();
  if (error) throw error;
  if (!pod) notFound();

  return { podId, pod, serviceClient };
}
