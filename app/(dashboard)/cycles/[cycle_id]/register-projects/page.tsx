import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProjectRegistration from "./project-registration";

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
    .select("project_registration_open, project_registration_close")
    .eq("cycle_id", cycleId)
    .single();

  const now = new Date();
  const isOpen =
    config?.project_registration_open &&
    config?.project_registration_close &&
    now >= new Date(config.project_registration_open) &&
    now <= new Date(config.project_registration_close);

  // Get user's pods for this cycle
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let myPods: { id: number; name: string | null }[] = [];
  let currentProjectId: number | null = null;

  if (user) {
    const { data: participant } = await supabase
      .from("participants")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (participant) {
      const { data: memberships } = await supabase
        .from("pod_memberships")
        .select("pod_id, pods!inner(id, name, cycle_id)")
        .eq("participant_id", participant.id)
        .eq("pods.cycle_id", cycleId)
        .is("inactive_at", null);

      myPods = (memberships || []).map((m) => {
        const pod = m.pods as unknown as { id: number; name: string | null };
        return { id: pod.id, name: pod.name };
      });

      // Check current project registration
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

  // Fetch projects for the user's pods
  const podIds = myPods.map((p) => p.id);
  let projects: { id: number; name: string | null; status: string; pod_id: number; member_count: number }[] = [];
  if (podIds.length > 0) {
    const { data: projectData } = await supabase
      .from("projects")
      .select("id, name, status, pod_id")
      .in("pod_id", podIds)
      .order("created_at");

    if (projectData) {
      // Get member counts
      const projectIds = projectData.map((p) => p.id);
      const { data: projectMemberships } = await supabase
        .from("project_memberships")
        .select("project_id")
        .in("project_id", projectIds.length > 0 ? projectIds : [0])
        .is("left_at", null);

      const countMap: Record<number, number> = {};
      for (const m of projectMemberships || []) {
        countMap[m.project_id] = (countMap[m.project_id] || 0) + 1;
      }

      projects = projectData.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        pod_id: p.pod_id,
        member_count: countMap[p.id] || 0,
      }));
    }
  }

  return (
    <div>
      <div className="mb-8">
        <Link
          href={`/cycles/${cycle.id}`}
          className="text-sm text-cloud/60 hover:text-aqua"
        >
          &larr; {cycle.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">
          Register for a Project
        </h1>
        <p className="mt-1 text-sm text-cloud/50">
          Join a project within your pod. You can register for one project per
          cycle.
        </p>
      </div>

      {!isOpen ? (
        <div className="rounded-md border border-whisper bg-white/[0.02] p-6 text-center">
          <p className="text-cloud/60">
            Project registration is not currently open.
          </p>
          {config?.project_registration_open &&
            now < new Date(config.project_registration_open) && (
              <p className="mt-2 text-sm text-cloud/40">
                Opens{" "}
                {new Date(config.project_registration_open).toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
                )}
              </p>
            )}
        </div>
      ) : myPods.length === 0 ? (
        <div className="rounded-md border border-whisper bg-white/[0.02] p-6 text-center">
          <p className="text-cloud/60">
            You are not a member of any pods in this cycle.
          </p>
          <Link
            href={`/cycles/${cycle.id}`}
            className="mt-2 inline-block text-sm text-aqua hover:underline"
          >
            View cycle &rarr;
          </Link>
        </div>
      ) : (
        <ProjectRegistration
          pods={myPods}
          projects={projects}
          initialCurrentProjectId={currentProjectId}
        />
      )}
    </div>
  );
}
