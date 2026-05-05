import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { createServiceClient } from "@/lib/supabase/server";
import { resend, FROM_EMAIL } from "@/lib/email";
import {
  invitationEmailHtml,
  invitationEmailText,
} from "@/lib/email/invitation-template";

export const POST = withAdminAuth(
  async (
    _request: NextRequest,
    _auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const invitationId = parseIntParam(params.invitation_id, "invitation_id");
    if (invitationId instanceof NextResponse) return invitationId;

    const serviceClient = createServiceClient();

    // Fetch invitation with cycle name
    const { data: invitation, error: fetchError } = await serviceClient
      .from("invitations")
      .select("id, email, token, status, expires_at, role_preset, cycle_id, cycles (name)")
      .eq("id", invitationId)
      .single();

    if (fetchError) return dbError(fetchError);
    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }
    if (invitation.status !== "pending") {
      return NextResponse.json(
        { error: `Cannot send email for a ${invitation.status} invitation` },
        { status: 422 }
      );
    }
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This invitation has expired" },
        { status: 422 }
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(".supabase.co", ".vercel.app") ??
      "https://app.theupskillinglabs.org";

    const magicLink = `${appUrl}/login?invite=${invitation.token}`;
    const cycle = (invitation.cycles as unknown) as { name: string } | null;

    // Send email via Resend
    const { error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: invitation.email,
      subject: "You're invited to The Upskilling Labs",
      html: invitationEmailHtml({
        magicLink,
        rolePreset: invitation.role_preset,
        cycleName: cycle?.name ?? null,
      }),
      text: invitationEmailText({
        magicLink,
        rolePreset: invitation.role_preset,
        cycleName: cycle?.name ?? null,
      }),
    });

    if (sendError) {
      console.error("[invitation/send] Resend error:", sendError);
      return NextResponse.json(
        { error: "Failed to send email. Please try again." },
        { status: 502 }
      );
    }

    // Record the send timestamp in Supabase
    const now = new Date().toISOString();
    const { error: updateError } = await serviceClient
      .from("invitations")
      .update({ email_sent_at: now })
      .eq("id", invitationId);

    if (updateError) {
      // Non-fatal — email was sent, just log the tracking failure
      console.error("[invitation/send] Failed to update email_sent_at:", updateError);
    }

    return NextResponse.json({ email_sent_at: now });
  }
);
