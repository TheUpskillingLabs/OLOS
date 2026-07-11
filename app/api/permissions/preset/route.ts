import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { applyPresetSchema } from "@/lib/validations/invitations";
import { ROLE_PRESETS } from "@/lib/auth/permissions";
import { canGrant, grantRole, type AuthorityRole } from "@/lib/auth/grants";
import { createServiceClient } from "@/lib/supabase/server";

// Presets that carry a global authority role (as opposed to caps only). The
// 'moderator' preset grants caps but no global role — poderator is pod-scoped
// and assigned via the moderators route.
const GLOBAL_ROLE_PRESETS = new Set(["owner", "admin", "developer", "observer"]);

export const POST = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, applyPresetSchema);
    if (isErrorResponse(body)) return body;

    const { participant_id, preset } = body;
    const permissions = ROLE_PRESETS[preset];

    if (!permissions) {
      return NextResponse.json({ error: "Unknown preset" }, { status: 400 });
    }

    // Attenuation up front (before any write): if this preset carries a global
    // role, the actor must be allowed to grant it — owner-only for owner, admin
    // for admin/developer/observer (lib/auth/grants.ts). Checking here avoids a
    // partial application where caps land but the role grant is then refused.
    const roleForPreset = GLOBAL_ROLE_PRESETS.has(preset)
      ? (preset as AuthorityRole)
      : null;
    if (roleForPreset) {
      const gate = canGrant(auth.user, roleForPreset);
      if (!gate.ok) {
        return NextResponse.json({ error: gate.error }, { status: 403 });
      }
    }

    const serviceClient = createServiceClient();

    // Insert all permissions for the preset
    const rows = permissions.map((perm) => ({
      participant_id,
      permission: perm,
      granted_by: auth.user.participantId,
    }));

    const { error } = await serviceClient
      .from("participant_permissions")
      .upsert(rows, { onConflict: "participant_id,permission", ignoreDuplicates: false });

    if (error) return dbError(error);

    // Clear revoked_at for any previously revoked
    await serviceClient
      .from("participant_permissions")
      .update({ revoked_at: null, granted_by: auth.user.participantId, granted_at: new Date().toISOString() })
      .eq("participant_id", participant_id)
      .in("permission", permissions)
      .not("revoked_at", "is", null);

    // Grant the authority role through the single write path — participant_roles
    // (the source of truth the app + RLS read, 00064), with provenance and the
    // attenuation already gated above. Replaces the old user_roles upsert.
    if (roleForPreset) {
      const grant = await grantRole(serviceClient, {
        participantId: participant_id,
        role: roleForPreset,
        actor: auth.user,
        note: "granted via role preset",
      });
      if (!grant.ok) {
        return NextResponse.json({ error: grant.error }, { status: grant.status });
      }
    }

    // Return updated permissions
    const { data: updated } = await serviceClient
      .from("participant_permissions")
      .select("permission")
      .eq("participant_id", participant_id)
      .is("revoked_at", null);

    return NextResponse.json({
      participant_id,
      preset,
      permissions: (updated ?? []).map((r) => r.permission),
    });
  }
);
