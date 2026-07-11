import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { grantRole, revokeRole, type AuthorityRole } from "@/lib/auth/grants";
import { capabilitiesForRoles, ROLE_CAPABILITIES } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * The /admin/access console's grant/revoke endpoint — the interactive face of
 * the single write path. Scoped to GLOBAL authority roles; scoped roles
 * (poderator/lab_lead/dri) keep their own surfaces. Attenuation + provenance
 * are enforced by lib/auth/grants.ts (owner-only owner-making, etc.).
 * Capabilities follow the role (resolveUserRoles derives them), so grant needs
 * no separate caps write; revoke also clears any legacy per-person caps this
 * role covered that no remaining role still justifies.
 */

const schema = z.object({
  participant_id: z.number().int().positive(),
  role: z.enum(["owner", "admin", "developer", "observer"]),
});

export const POST = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, schema);
    if (isErrorResponse(body)) return body;

    const client = createServiceClient();
    const grant = await grantRole(client, {
      participantId: body.participant_id,
      role: body.role as AuthorityRole,
      actor: auth.user,
      note: "granted via access console",
    });
    if (!grant.ok) {
      return NextResponse.json({ error: grant.error }, { status: grant.status });
    }
    return NextResponse.json({ ok: true, alreadyActive: grant.alreadyActive });
  }
);

export const DELETE = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, schema);
    if (isErrorResponse(body)) return body;

    const client = createServiceClient();

    // The rooted primary owner is never revoked here — ownership transfer is a
    // separate, deliberate action, and this guards against bricking the tree.
    if (body.role === "owner") {
      const { data: target } = await client
        .from("participant_roles")
        .select("granted_by")
        .eq("participant_id", body.participant_id)
        .eq("role", "owner")
        .is("revoked_at", null)
        .maybeSingle();
      if (target && target.granted_by === null) {
        return NextResponse.json(
          {
            error:
              "The primary owner can't be revoked here — ownership transfer is a separate, deliberate action.",
          },
          { status: 400 }
        );
      }
    }

    const rev = await revokeRole(client, {
      participantId: body.participant_id,
      role: body.role as AuthorityRole,
      actor: auth.user,
    });
    if (!rev.ok) {
      return NextResponse.json({ error: rev.error }, { status: rev.status });
    }

    // Drain legacy per-person caps this role covered that no REMAINING role
    // still justifies, so a pre-existing grant is fully revoked (caps a
    // remaining role grants are re-derived and kept).
    const { data: remaining } = await client
      .from("participant_roles")
      .select("role")
      .eq("participant_id", body.participant_id)
      .is("revoked_at", null);
    const stillGranted = new Set(
      capabilitiesForRoles((remaining ?? []).map((r) => r.role))
    );
    const toRevoke = (ROLE_CAPABILITIES[body.role] ?? []).filter(
      (p) => !stillGranted.has(p)
    );
    if (toRevoke.length > 0) {
      await client
        .from("participant_permissions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("participant_id", body.participant_id)
        .in("permission", toRevoke)
        .is("revoked_at", null);
    }

    return NextResponse.json({ ok: true });
  }
);
