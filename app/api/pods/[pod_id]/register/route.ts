import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { checkWindow } from "@/lib/auth/windows";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;
    const participantId = auth.user.participantId;

    if (!participantId) {
      return NextResponse.json({ error: "Not a registered participant" }, { status: 403 });
    }

    // Get pod to check status and cycle
    const { data: pod } = await auth.supabase
      .from("pods")
      .select("id, cycle_id, status")
      .eq("id", podId)
      .single();

    if (!pod) {
      return NextResponse.json({ error: "Pod not found" }, { status: 404 });
    }

    if (!["forming", "active"].includes(pod.status)) {
      return NextResponse.json({ error: "Pod is not accepting registrations" }, { status: 400 });
    }

    // Check window
    const window = await checkWindow(auth.supabase, pod.cycle_id, "pod_registration");
    if (!window.open) {
      return NextResponse.json({ error: window.message }, { status: 403 });
    }

    // Check already registered for this pod
    const { data: existing } = await auth.supabase
      .from("pod_memberships")
      .select("id")
      .eq("pod_id", podId)
      .eq("participant_id", participantId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "You are already registered for this pod." },
        { status: 400 }
      );
    }

    // Check 2-pod cap for this cycle
    const { data: cyclePods } = await auth.supabase
      .from("pod_memberships")
      .select("id, pods!inner(cycle_id)")
      .eq("participant_id", participantId)
      .eq("pods.cycle_id", pod.cycle_id)
      .is("inactive_at", null);

    if ((cyclePods || []).length >= 2) {
      return NextResponse.json(
        { error: "You are already registered in 2 pods for this cycle." },
        { status: 400 }
      );
    }

    // Register
    const { data: membership, error } = await auth.supabase
      .from("pod_memberships")
      .insert({ participant_id: participantId, pod_id: podId })
      .select("id, joined_at")
      .single();

    if (error) {
      return dbError(error);
    }

    // Check if pod should activate
    const { data: config } = await auth.supabase
      .from("cycle_config")
      .select("pod_min")
      .eq("cycle_id", pod.cycle_id)
      .single();

    const { count } = await auth.supabase
      .from("pod_memberships")
      .select("id", { count: "exact", head: true })
      .eq("pod_id", podId)
      .is("inactive_at", null);

    if (config && count && count >= config.pod_min && pod.status === "forming") {
      await auth.supabase
        .from("pods")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", podId);

      // Activate enrollment for all pod members
      const { data: members } = await auth.supabase
        .from("pod_memberships")
        .select("participant_id")
        .eq("pod_id", podId)
        .is("inactive_at", null);

      if (members) {
        for (const m of members) {
          await auth.supabase
            .from("cycle_enrollments")
            .update({ status: "active" })
            .eq("participant_id", m.participant_id)
            .eq("cycle_id", pod.cycle_id)
            .eq("status", "inactive");
        }
      }
    }

    // If pod is already active, activate just this joining participant
    if (pod.status === "active") {
      await auth.supabase
        .from("cycle_enrollments")
        .update({ status: "active" })
        .eq("participant_id", participantId)
        .eq("cycle_id", pod.cycle_id)
        .eq("status", "inactive");
    }

    return NextResponse.json(
      { pod_membership_id: membership.id, registered_at: membership.joined_at },
      { status: 201 }
    );
  }
);

export const DELETE = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;
    const participantId = auth.user.participantId;

    if (!participantId) {
      return NextResponse.json({ error: "Not a registered participant" }, { status: 403 });
    }

    // Get pod for window check
    const { data: pod } = await auth.supabase
      .from("pods")
      .select("cycle_id")
      .eq("id", podId)
      .single();

    if (!pod) {
      return NextResponse.json({ error: "Pod not found" }, { status: 404 });
    }

    const window = await checkWindow(auth.supabase, pod.cycle_id, "pod_registration");
    if (!window.open) {
      return NextResponse.json({ error: window.message }, { status: 403 });
    }

    const { error } = await auth.supabase
      .from("pod_memberships")
      .delete()
      .eq("pod_id", podId)
      .eq("participant_id", participantId);

    if (error) {
      return dbError(error);
    }

    return NextResponse.json({ success: true });
  }
);
