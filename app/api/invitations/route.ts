import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { can } from "@/lib/auth/roles";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { createInvitationSchema } from "@/lib/validations/invitations";
import { ROLE_PRESETS } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";

export const GET = withAdminAuth(
  async (_request: NextRequest, _auth: AuthenticatedRequest) => {
    const serviceClient = createServiceClient();

    const { data, error } = await serviceClient
      .from("invitations")
      .select("*, cycles (name), participants!invitations_invited_by_fkey (preferred_name, first_name, last_name)")
      .order("created_at", { ascending: false });

    if (error) return dbError(error);

    return NextResponse.json(data ?? []);
  }
);

export const POST = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, createInvitationSchema);
    if (isErrorResponse(body)) return body;

    const { email, role_preset, permissions: extraPerms, cycle_id, pod_id, pod_role } = body;

    if (pod_role && !pod_id) {
      return NextResponse.json({ error: "pod_role requires a pod" }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // pod_role/mode validation: a pod_role only makes sense on an org-mode
    // pod (co-lead/member are org workstream concepts), and an org-mode pod
    // always needs a pod_role — a moderator-assignment-only invite on an
    // org pod would otherwise create a phantom co-lead with no membership
    // or enrollment (fulfillInvitation, lib/auth/invitations.ts).
    // Participant-cycle pods keep the legacy poderator-only invite; direct
    // participant membership on those pods must keep going through the
    // registration paths that enforce windows/pod_limit.
    if (pod_id) {
      const { data: podRow } = await serviceClient
        .from("pods")
        .select("id, cycles (mode)")
        .eq("id", pod_id)
        .maybeSingle();

      if (!podRow) {
        return NextResponse.json({ error: "Pod not found" }, { status: 404 });
      }

      const podCycleMode = one(podRow.cycles as { mode: string } | { mode: string }[] | null)?.mode;

      if (pod_role && podCycleMode !== "org") {
        return NextResponse.json(
          { error: "Co-lead/member roles apply only to organization workstreams." },
          { status: 400 }
        );
      }

      if (!pod_role && podCycleMode === "org") {
        return NextResponse.json(
          { error: "Organization workstream invites need a pod role (co-lead or member)." },
          { status: 400 }
        );
      }
    }

    // Build final permissions list
    let finalPerms: string[] = [];
    if (role_preset && ROLE_PRESETS[role_preset]) {
      finalPerms = [...ROLE_PRESETS[role_preset]];
    }
    if (extraPerms) {
      for (const p of extraPerms) {
        if (!finalPerms.includes(p)) finalPerms.push(p);
      }
    }

    // If granting roles:write, caller must have it
    if (finalPerms.includes("roles:write") && !can(auth.user, "roles:write")) {
      return NextResponse.json(
        { error: "Only users with roles:write can invite with that permission" },
        { status: 403 }
      );
    }

    // Block exact duplicates: same email + same cycle + same role preset, pending and not expired
    let duplicateQuery = serviceClient
      .from("invitations")
      .select("id")
      .eq("email", email.toLowerCase())
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString());

    if (cycle_id) {
      duplicateQuery = duplicateQuery.eq("cycle_id", cycle_id);
    } else {
      duplicateQuery = duplicateQuery.is("cycle_id", null);
    }

    if (role_preset) {
      duplicateQuery = duplicateQuery.eq("role_preset", role_preset);
    } else {
      duplicateQuery = duplicateQuery.is("role_preset", null);
    }

    const { data: existing } = await duplicateQuery.maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "A pending invitation already exists for this email with the same cycle and role" },
        { status: 409 }
      );
    }

    const { data, error } = await serviceClient
      .from("invitations")
      .insert({
        email: email.toLowerCase(),
        permissions: finalPerms,
        role_preset: role_preset ?? null,
        cycle_id: cycle_id ?? null,
        pod_id: pod_id ?? null,
        pod_role: pod_role ?? null,
        invited_by: auth.user.participantId,
      })
      .select("id, email, token, permissions, role_preset, cycle_id, pod_id, pod_role, status, created_at, expires_at")
      .single();

    if (error) return dbError(error);

    return NextResponse.json(data, { status: 201 });
  }
);
