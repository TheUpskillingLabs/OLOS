import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

const WINDOW_ROUTES: {
  label: string;
  field: string;
  route: string;
}[] = [
  { label: "Submit Problem Statements", field: "problem_statement", route: "propose" },
  { label: "Vote on Problem Statements", field: "voting", route: "vote" },
  { label: "Register for Pods", field: "pod_registration", route: "register-pods" },
  { label: "Submit Solution Proposals", field: "solution_proposal", route: "solutions" },
  { label: "Vote on Solutions", field: "solution_voting", route: "solution-vote" },
  { label: "Register for Projects", field: "project_registration", route: "register-projects" },
];

export default async function CycleDetailPage({
  params,
}: {
  params: Promise<{ cycle_id: string }>;
}) {
  const { cycle_id } = await params;
  const supabase = await createClient();

  const { data: cycle } = await supabase
    .from("cycles")
    .select("id, name, slug, start_date, end_date, status")
    .eq("id", parseInt(cycle_id))
    .single();

  if (!cycle) notFound();

  const { data: pods } = await supabase
    .from("pods")
    .select("id, name, status")
    .eq("cycle_id", cycle.id)
    .order("created_at");

  const { data: enrollments } = await supabase
    .from("cycle_enrollments")
    .select("status")
    .eq("cycle_id", cycle.id);

  const activeCount =
    enrollments?.filter((e) => e.status === "active").length || 0;

  // Fetch active windows
  const serviceClient = createServiceClient();
  const { data: config } = await serviceClient
    .from("cycle_config")
    .select(
      "problem_statement_open, problem_statement_close, voting_open, voting_close, pod_registration_open, pod_registration_close, solution_proposal_open, solution_proposal_close, solution_voting_open, solution_voting_close, project_registration_open, project_registration_close"
    )
    .eq("cycle_id", cycle.id)
    .single();

  const now = new Date();
  const activeWindows: { label: string; route: string; closesAt: string }[] = [];
  if (config) {
    for (const w of WINDOW_ROUTES) {
      const configRecord = config as Record<string, string | null>;
      const openVal = configRecord[`${w.field}_open`];
      const closeVal = configRecord[`${w.field}_close`];
      if (openVal && closeVal && now >= new Date(openVal) && now <= new Date(closeVal)) {
        activeWindows.push({ label: w.label, route: w.route, closesAt: closeVal });
      }
    }
  }

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/cycles"
          className="text-sm text-cloud/60 hover:text-aqua"
        >
          &larr; All Cycles
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">
          {cycle.name}
        </h1>
        <div className="mt-1 flex items-center gap-4 text-sm text-cloud/60">
          <span>
            {new Date(cycle.start_date).toLocaleDateString()} &ndash;{" "}
            {new Date(cycle.end_date).toLocaleDateString()}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              cycle.status === "active"
                ? "bg-teal/20 text-aqua"
                : cycle.status === "closed"
                  ? "bg-white/10 text-cloud/60"
                  : "bg-yellow-500/20 text-yellow-300"
            }`}
          >
            {cycle.status}
          </span>
        </div>
      </div>

      {/* Active window CTAs */}
      {activeWindows.length > 0 && (
        <div className="mb-8 space-y-3">
          {activeWindows.map((w) => (
            <Link
              key={w.route}
              href={`/cycles/${cycle.id}/${w.route}`}
              className="flex items-center justify-between rounded-md border border-teal/20 bg-teal/[0.04] p-4 transition-colors hover:border-teal/40 hover:bg-teal/[0.07]"
            >
              <div className="flex items-center gap-3">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-aqua" />
                <span className="font-medium text-white">{w.label}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-cloud/50">
                <span>
                  closes{" "}
                  {new Date(w.closesAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="text-aqua">&rarr;</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-md border border-whisper bg-white/[0.02] p-4">
          <p className="text-sm text-cloud/60">Total Enrolled</p>
          <p className="text-2xl font-bold text-white">
            {enrollments?.length || 0}
          </p>
        </div>
        <div className="rounded-md border border-whisper bg-white/[0.02] p-4">
          <p className="text-sm text-cloud/60">Active</p>
          <p className="text-2xl font-bold text-aqua">{activeCount}</p>
        </div>
        <div className="rounded-md border border-whisper bg-white/[0.02] p-4">
          <p className="text-sm text-cloud/60">Pods</p>
          <p className="text-2xl font-bold text-white">
            {pods?.length || 0}
          </p>
        </div>
      </div>

      {pods && pods.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-white">
            Pods
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {pods.map((pod) => (
              <Link
                key={pod.id}
                href={`/pods/${pod.id}`}
                className="rounded-md border border-whisper bg-white/[0.02] p-4 transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">
                    {pod.name || `Pod ${pod.id}`}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      pod.status === "active"
                        ? "bg-teal/20 text-aqua"
                        : pod.status === "forming"
                          ? "bg-teal/10 text-teal"
                          : "bg-white/10 text-cloud/60"
                    }`}
                  >
                    {pod.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
