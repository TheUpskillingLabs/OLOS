import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isOwnerEmail, ensureOwnerRole } from "@/lib/auth/owner-emails";

async function fulfillInvitation(
  serviceClient: ReturnType<typeof createServiceClient>,
  participantId: number,
  email: string
) {
  // Read invite token from cookie
  const cookieStore = await cookies();
  const inviteToken = cookieStore.get("invite_token")?.value;
  if (!inviteToken) return;

  // Clear the cookie
  cookieStore.set("invite_token", "", { maxAge: 0, path: "/" });

  // Look up the invitation
  const { data: invitation } = await serviceClient
    .from("invitations")
    .select("id, email, permissions, role_preset, cycle_id, pod_id")
    .eq("token", inviteToken)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!invitation) return;

  // Verify email matches
  if (invitation.email.toLowerCase() !== email.toLowerCase()) return;

  // Grant permissions
  const permissions = (invitation.permissions as string[]) ?? [];
  if (permissions.length > 0) {
    const rows = permissions.map((perm) => ({
      participant_id: participantId,
      permission: perm,
    }));
    await serviceClient
      .from("participant_permissions")
      .upsert(rows, { onConflict: "participant_id,permission", ignoreDuplicates: true });
  }

  // Record role preset in user_roles for audit
  if (invitation.role_preset && ["owner", "admin", "developer", "observer"].includes(invitation.role_preset)) {
    await serviceClient
      .from("user_roles")
      .upsert(
        { participant_id: participantId, role: invitation.role_preset, granted_by: null },
        { onConflict: "participant_id,role", ignoreDuplicates: true }
      );
  }

  // Enroll in cycle if specified
  if (invitation.cycle_id) {
    await serviceClient
      .from("cycle_enrollments")
      .upsert(
        { participant_id: participantId, cycle_id: invitation.cycle_id, status: "active" },
        { onConflict: "participant_id,cycle_id", ignoreDuplicates: true }
      );
  }

  // Create moderator assignment if pod specified
  if (invitation.pod_id) {
    // Need cycle_id for moderator_assignments — get it from the pod
    const { data: pod } = await serviceClient
      .from("pods")
      .select("cycle_id")
      .eq("id", invitation.pod_id)
      .single();

    if (pod) {
      await serviceClient
        .from("moderator_assignments")
        .upsert(
          {
            participant_id: participantId,
            pod_id: invitation.pod_id,
            cycle_id: pod.cycle_id,
          },
          { onConflict: "participant_id,pod_id,cycle_id", ignoreDuplicates: true }
        );
    }
  }

  // Mark invitation as accepted
  await serviceClient
    .from("invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const serviceClient = createServiceClient();
        const email = user.email;

        // Check if a participant record exists for this email
        const { data: participant } = await serviceClient
          .from("participants")
          .select("id, auth_user_id")
          .eq("email", email)
          .maybeSingle();

        if (participant) {
          // Link auth_user_id if not yet set
          if (!participant.auth_user_id) {
            await serviceClient
              .from("participants")
              .update({ auth_user_id: user.id })
              .eq("id", participant.id);
          }
          if (email && isOwnerEmail(email)) {
            await ensureOwnerRole(serviceClient, participant.id);
          }

          // Fulfill any pending invitation
          if (email) {
            await fulfillInvitation(serviceClient, participant.id, email);
          }

          return NextResponse.redirect(`${origin}/`);
        } else {
          // No participant record — redirect to registration
          return NextResponse.redirect(`${origin}/register`);
        }
      }

      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
