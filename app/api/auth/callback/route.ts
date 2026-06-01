import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isOwnerEmail, ensureOwnerRole } from "@/lib/auth/owner-emails";
import { escapeEmailForIlike } from "@/lib/auth/email";
import { reconcileEnrollmentActivation } from "@/lib/enrollment/reconciler";

const PLACEHOLDER_NAME = "unknown";

function hasPlaceholderName(first: string | null, last: string | null): boolean {
  return (
    (first ?? "").trim().toLowerCase() === PLACEHOLDER_NAME ||
    (last ?? "").trim().toLowerCase() === PLACEHOLDER_NAME
  );
}

async function fulfillInvitation(
  serviceClient: ReturnType<typeof createServiceClient>,
  participantId: number,
  email: string,
  hasPlaceholder: boolean
) {
  const cookieStore = await cookies();
  const inviteToken = cookieStore.get("invite_token")?.value;
  if (!inviteToken) return;

  // Look up the invitation
  const { data: invitation } = await serviceClient
    .from("invitations")
    .select("id, email, permissions, role_preset, cycle_id, pod_id")
    .eq("token", inviteToken)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!invitation) {
    cookieStore.set("invite_token", "", { maxAge: 0, path: "/" });
    return;
  }

  // Verify email matches (case-insensitive)
  if (invitation.email.toLowerCase() !== email.toLowerCase()) {
    cookieStore.set("invite_token", "", { maxAge: 0, path: "/" });
    return;
  }

  // Placeholder-name guard (architecture review broken edge #16; issue #103
  // closed-as-completed via #110). A participant with first_name='Unknown'
  // or last_name='Unknown' should not be enrolled in the cycle or assigned
  // a moderator role until they complete their profile. Leave the cookie
  // in place so the invitation can be re-fulfilled on a later request once
  // the layout-level placeholder guard (Phase B) redirects them through
  // /profile/edit. Until Phase B ships, the participant retains the
  // invitation context for the cookie's 1-hour TTL.
  if (hasPlaceholder) {
    return;
  }

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

  // Enroll in cycle if specified.
  //
  // Architecture review broken edge #2 fix: the previous implementation
  // passed `ignoreDuplicates: true` here, which made the upsert a no-op
  // when a pre-existing inactive enrollment row existed (created by
  // /api/cycles/[id]/interest or /api/registrations). The invitee then
  // landed on /dashboard still 'inactive' even though they had just
  // accepted an invitation that explicitly promised 'active'.
  //
  // We now upsert without ignoreDuplicates so the conflict path promotes
  // the row, then call the reconciler so the final status reflects actual
  // pod-membership reality (the reconciler will demote back to 'inactive'
  // if the invitee has no active pod-memberships — that's correct
  // behavior, since invitation acceptance alone does not constitute pod
  // membership).
  if (invitation.cycle_id) {
    await serviceClient
      .from("cycle_enrollments")
      .upsert(
        { participant_id: participantId, cycle_id: invitation.cycle_id, status: "active" },
        { onConflict: "participant_id,cycle_id" }
      );

    await reconcileEnrollmentActivation(participantId, invitation.cycle_id);
  }

  // Create moderator assignment if pod specified
  if (invitation.pod_id) {
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

  // Mark invitation as accepted and clear the cookie
  await serviceClient
    .from("invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  cookieStore.set("invite_token", "", { maxAge: 0, path: "/" });
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

        if (!email) {
          return NextResponse.redirect(`${origin}/login?error=auth_failed`);
        }

        // Case-insensitive lookup against the unique-on-lower(email) index
        // from migration 00016. escapeEmailForIlike neutralizes `_` and `%`
        // pattern characters that ILIKE would otherwise interpret as
        // wildcards (architecture review broken edge #19).
        const { data: participant } = await serviceClient
          .from("participants")
          .select("id, auth_user_id, first_name, last_name")
          .ilike("email", escapeEmailForIlike(email))
          .maybeSingle();

        if (participant) {
          // Link auth_user_id if not yet set
          if (!participant.auth_user_id) {
            await serviceClient
              .from("participants")
              .update({ auth_user_id: user.id })
              .eq("id", participant.id);
          }
          if (isOwnerEmail(email)) {
            await ensureOwnerRole(serviceClient, participant.id);
          }

          // Fulfill any pending invitation (placeholder-name aware)
          const hasPlaceholder = hasPlaceholderName(
            participant.first_name,
            participant.last_name
          );
          await fulfillInvitation(
            serviceClient,
            participant.id,
            email,
            hasPlaceholder
          );

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
