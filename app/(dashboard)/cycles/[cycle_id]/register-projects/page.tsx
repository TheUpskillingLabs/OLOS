import Link from "next/link";
import { windowOpen, parseWindow, fmtLabDateTime } from "@/lib/cycles/lab-time";
import { ChevronLeft } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";
import { notFound } from "next/navigation";
import ProjectRegistration from "./project-registration";
import { effectiveUser } from "@/lib/auth/simulation";

export default async function RegisterProjectsPage({
  params,
}: {
  params: Promise<{ cycle_id: string }>;
}) {
  const { cycle_id } = await params;
  const cycleId = parseInt(cycle_id, 10);
  const supabase = await createClient();

  const { data: cycle } = await supabase
    .from("cycles")
    .select("id, name, status")
    .eq("id", cycleId)
    .single();

  if (!cycle) notFound();

  const serviceClient = createServiceClient();
  const { data: config } = await serviceClient
    .from("cycle_config")
    .select(
      "project_registration_open, project_registration_close, project_max"
    )
    .eq("cycle_id", cycleId)
    // maybeSingle: a missing cycle_config row is a real production state —
    // read as closed, not an error (vibe-scan PP6).
    .maybeSingle();

  // Naive window columns are UTC instants (lib/cycles/lab-time.ts).
  const now = new Date();
  const isOpen = windowOpen(
    config?.project_registration_open,
    config?.project_registration_close,
    now
  );

  const user = await effectiveUser();

  // Project registration is cycle-wide (not pod-scoped). The eligibility
  // gate is a cycle_enrollment row in good standing — 'registered' or
  // 'active' — mirroring the server check in
  // app/api/projects/[project_id]/register/route.ts ('active' means "has an
  // active pod", so gating on it alone would lock out podless members).
  let enrollmentEligible = false;
  let currentProjectId: number | null = null;

  if (user) {
    const { data: participant } = await supabase
      .from("participants")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (participant) {
      const { data: enrollment } = await supabase
        .from("cycle_enrollments")
        .select("status")
        .eq("cycle_id", cycleId)
        .eq("participant_id", participant.id)
        .maybeSingle();

      enrollmentEligible =
        enrollment?.status === "registered" || enrollment?.status === "active";

      const { data: existingReg } = await supabase
        .from("project_memberships")
        .select("project_id")
        .eq("participant_id", participant.id)
        .eq("cycle_id", cycleId)
        .is("left_at", null)
        .maybeSingle();

      currentProjectId = existingReg?.project_id ?? null;
    }
  }

  // Fetch all projects in this cycle (any pod), with the pitch each one was
  // promoted from so members can read what they'd be joining. Member-safe
  // proposal columns only — no participant_id, no created_at — matching the
  // gallery's anonymized-by-construction discipline (vote on ideas, not
  // people; the same applies to joining them).
  let projects: {
    id: number;
    name: string | null;
    status: string;
    pod_id: number;
    member_count: number;
    summary: string | null;
    proposal_data: Record<string, string> | null;
  }[] = [];
  const { data: projectData } = await supabase
    .from("projects")
    .select(
      "id, name, status, pod_id, solution_proposals(summary, proposal_data)"
    )
    .eq("cycle_id", cycleId)
    .order("created_at");

  if (projectData && projectData.length > 0) {
    const projectIds = projectData.map((p) => p.id);
    const { data: projectMemberships } = await supabase
      .from("project_memberships")
      .select("project_id")
      .in("project_id", projectIds)
      .is("left_at", null);

    const countMap: Record<number, number> = {};
    for (const m of projectMemberships || []) {
      countMap[m.project_id] = (countMap[m.project_id] || 0) + 1;
    }

    projects = projectData.map((p) => {
      const proposal = one(
        p.solution_proposals as
          | { summary: string | null; proposal_data: Record<string, string> | null }
          | { summary: string | null; proposal_data: Record<string, string> | null }[]
          | null
      );
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        pod_id: p.pod_id,
        member_count: countMap[p.id] || 0,
        summary: proposal?.summary ?? null,
        proposal_data: proposal?.proposal_data ?? null,
      };
    });
  }

  return (
    <div>
      <div className="mb-8">
        <Link
          href={`/cycles/${cycle.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-meta transition-colors duration-150 hover:text-teal-deep"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {cycle.name}
        </Link>
        <h1 className="t-h1 mt-2 text-ink">
          Register for a project
        </h1>
        <p className="mt-1 text-sm text-charcoal">
          Join any project in this cycle. You can register for one project per
          cycle.
        </p>
      </div>

      {!isOpen ? (
        <div className="rounded-card border border-ink/10 bg-white p-6 shadow-card">
          <p className="text-charcoal">
            Project registration is not currently open.
          </p>
          {config?.project_registration_open &&
            now < (parseWindow(config.project_registration_open) as Date) && (
              <p className="mt-2 text-sm text-meta tabular-nums">
                Opens {fmtLabDateTime(config.project_registration_open)}
              </p>
            )}
        </div>
      ) : !enrollmentEligible ? (
        <div className="rounded-card border border-ink/10 bg-white p-6 shadow-card">
          <p className="text-charcoal">
            You are not registered for this cycle.
          </p>
          <Link
            href={`/cycles/${cycle.id}`}
            className="mt-2 inline-block text-sm font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:underline focus-visible:underline"
          >
            View cycle &rarr;
          </Link>
        </div>
      ) : (
        <ProjectRegistration
          projects={projects}
          initialCurrentProjectId={currentProjectId}
          projectMax={config?.project_max ?? 7}
        />
      )}
    </div>
  );
}
