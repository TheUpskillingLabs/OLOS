import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

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
