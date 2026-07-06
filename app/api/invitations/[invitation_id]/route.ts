import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { createServiceClient } from "@/lib/supabase/server";
import { escapeEmailForIlike } from "@/lib/auth/email";

export const PATCH = withAdminAuth(
  async (_request: NextRequest, _auth: AuthenticatedRequest, params: Record<string, string>) => {
    const invitationId = parseIntParam(params.invitation_id, "invitation_id");
    if (invitationId instanceof NextResponse) return invitationId;

    const serviceClient = createServiceClient();

    // Load the invitation first so we know what (if anything) fulfillInvitation
    // already granted and can reverse it.
    const { data: invite } = await serviceClient
      .from("invitations")
      .select("id, status, email, permissions, role_preset, pod_id")
      .eq("id", invitationId)
      .maybeSingle();

    if (!invite || !["pending", "accepted"].includes(invite.status)) {
      return NextResponse.json(
        { error: "Invitation not found or already processed" },
        { status: 404 }
      );
    }

    // For an ACCEPTED invite, flipping status alone leaves every granted
    // permission / role / moderator assignment live — the admin sees "revoked"
    // but access persists (audit fix, security). Reverse the invite-owned
    // elevated grants here. Cohort enrollment is intentionally NOT force-
    // revoked: it is managed by the reconciler and reflects pod-membership
    // reality, not the invite alone.
    if (invite.status === "accepted") {
      const { data: participant } = await serviceClient
        .from("participants")
        .select("id")
        .ilike("email", escapeEmailForIlike(invite.email))
        .maybeSingle();

      if (participant) {
        const nowIso = new Date().toISOString();

        const perms = (invite.permissions as string[] | null) ?? [];
        if (perms.length > 0) {
          const { error } = await serviceClient
            .from("participant_permissions")
            .update({ revoked_at: nowIso })
            .eq("participant_id", participant.id)
            .in("permission", perms)
            .is("revoked_at", null);
          if (error) return dbError(error, "invite-revoke-permissions");
        }

        if (
          invite.role_preset &&
          ["owner", "admin", "developer", "observer"].includes(invite.role_preset)
        ) {
          const { error } = await serviceClient
            .from("user_roles")
            .update({ revoked_at: nowIso })
            .eq("participant_id", participant.id)
            .eq("role", invite.role_preset)
            .is("revoked_at", null);
          if (error) return dbError(error, "invite-revoke-role");
        }

        if (invite.pod_id) {
          const { error } = await serviceClient
            .from("moderator_assignments")
            .update({ removed_at: nowIso })
            .eq("participant_id", participant.id)
            .eq("pod_id", invite.pod_id)
            .is("removed_at", null);
          if (error) return dbError(error, "invite-revoke-moderator");
        }
      }
    }

    const { data, error } = await serviceClient
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", invitationId)
      .in("status", ["pending", "accepted"])
      .select("id, status")
      .single();

    if (error) return dbError(error);
    if (!data) {
      return NextResponse.json(
        { error: "Invitation not found or already processed" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  }
);
