import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdmin, isModeratorForPod, type UserRoles } from "@/lib/auth/roles";
import type { EntityType } from "@/lib/validations/showcase";

/**
 * The write gate for every showcase surface (page fields, logo/cover images,
 * entity links). Resolves the four owner types to the right predicate:
 *   - pod         → admin OR the pod's assigned moderator (the "Poderator")
 *   - project     → admin OR the parent pod's moderator
 *   - cycle       → admin only (no per-cycle curator role exists)
 *   - participant → the participant themselves OR admin
 *
 * Returns null when allowed, a NextResponse (403/404) when denied — the same
 * short-circuit contract as requireModeratorForPod:
 *
 *   const guard = await resolveEntityCurator(auth.user, type, id, auth.supabase);
 *   if (guard) return guard;
 *
 * `supabase` is only used to read projects.pod_id (world-readable within the
 * app); pass the request's auth.supabase.
 */
export async function resolveEntityCurator(
  user: UserRoles,
  ownerType: EntityType,
  ownerId: number,
  supabase: SupabaseClient
): Promise<NextResponse | null> {
  if (isAdmin(user)) return null;

  switch (ownerType) {
    case "pod":
      return isModeratorForPod(user, ownerId) ? null : forbidden();

    case "project": {
      const { data: project } = await supabase
        .from("projects")
        .select("pod_id")
        .eq("id", ownerId)
        .maybeSingle();
      if (!project) return notFound();
      return isModeratorForPod(user, project.pod_id) ? null : forbidden();
    }

    case "cycle":
      // Admins already returned null above; there is no per-cycle curator.
      return forbidden();

    case "participant":
      return user.participantId === ownerId ? null : forbidden();

    default:
      return forbidden();
  }
}

function forbidden(): NextResponse {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function notFound(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
