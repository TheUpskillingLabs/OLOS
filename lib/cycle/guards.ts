import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// Guard for routes whose mechanics only make sense for participant
// ('open') cycles — formation windows, phase fast-forwarding, self-serve
// registration flows. Org cycles (mode='org', docs/ORG_CYCLES.md) are never
// formed by voting and never self-registered: co-leads are assigned via
// moderator_assignments, core contributors are invited directly into
// pod_memberships, and there is no problem-statement/voting/pod-registration
// window to step through. Call this right after resolving the cycle so a
// stray org-cycle id 403s with a clear message instead of corrupting
// cycle_config or the cycle_enrollments/pod_memberships side effects that
// participant-cycle routes assume.
export async function rejectOrgCycle(
  supabase: SupabaseClient,
  cycleId: number,
  message?: string
): Promise<NextResponse | null> {
  const { data: cycle } = await supabase
    .from("cycles")
    .select("mode")
    .eq("id", cycleId)
    .maybeSingle();

  if (!cycle) return null; // let the caller's own 404 handling run

  if (cycle.mode === "org") {
    return NextResponse.json(
      {
        error:
          message ??
          "This action is not available for organization cycles — workstreams are invite-only.",
      },
      { status: 403 }
    );
  }

  return null;
}

// Enrollment statuses that count as "in the cycle" for the invite-only gate —
// the same pair project registration accepts. Exits (inactive/revoked) stay
// out: a revoked member can't re-enter an invite-only cycle by self-serve.
const ENROLLED_STATUSES = new Set(["registered", "active"]);

// Pure half of the invite-only gate (docs/ORG_CYCLES.md §5a, migration
// 00109): a cycle flagged invite_only admits only members who already hold an
// enrollment, which an accepted admin invitation writes
// (lib/auth/invitations.ts). Missing config (no row yet) reads as open.
export function isInviteOnlyBlocked(
  config: { invite_only: boolean | null } | null,
  enrollment: { status: string } | null
): boolean {
  if (!config?.invite_only) return false;
  return !enrollment || !ENROLLED_STATUSES.has(enrollment.status);
}

// Route guard for the self-serve entry points (join ceremony, agreement,
// interest, pod register): 403 when the cycle is invite-only and this
// participant was never invited. Sits beside rejectOrgCycle on purpose — an
// org cycle is invite-only by construction; this is the participant-cycle
// equivalent, switched per cycle by an admin.
export async function rejectUninvited(
  supabase: SupabaseClient,
  cycleId: number,
  participantId: number,
  message?: string
): Promise<NextResponse | null> {
  const { data: config } = await supabase
    .from("cycle_config")
    .select("invite_only")
    .eq("cycle_id", cycleId)
    .maybeSingle();

  if (!config?.invite_only) return null;

  const { data: enrollment } = await supabase
    .from("cycle_enrollments")
    .select("status")
    .eq("cycle_id", cycleId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (!isInviteOnlyBlocked(config, enrollment)) return null;

  return NextResponse.json(
    {
      error:
        message ??
        "This cycle is invite-only. If you were invited, use the link in your invitation email.",
    },
    { status: 403 }
  );
}

// Config keys an org cycle actually uses. Org cycles have no formation
// windows or ballots (docs/ORG_CYCLES.md §5) — the phase-window
// (problem_statement_*/voting_*/pod_registration_*/solution_*/
// project_registration_*) and voting-count (submitter_votes,
// vote_threshold, max_pods, etc.) knobs are inert there, since nothing
// ever reads or stamps them for a mode='org' cycle. Silently accepting a
// PATCH containing them would let a raw API caller believe the write took
// effect when it's actually a no-op, so the config route rejects them
// outright instead.
export const ORG_ALLOWED_CONFIG_KEYS = new Set([
  "pod_limit",
  "milestone_mid_week",
  "milestone_final_week",
  "log_gate_paused",
  // The Leadership Log cascade is an org-tier ritual (00069) — its pause
  // toggle is valid only on org cycles.
  "leadership_log_gate_paused",
]);

// Keys in a parsed cycle_config PATCH body that aren't valid for an org
// cycle, sorted for stable error copy. Only own enumerable keys with a
// defined value count — parseBody's zod-stripped output omits keys the
// caller never sent, so those never show up here.
export function orgForbiddenConfigKeys(body: Record<string, unknown>): string[] {
  return Object.keys(body)
    .filter((key) => body[key] !== undefined && !ORG_ALLOWED_CONFIG_KEYS.has(key))
    .sort();
}
