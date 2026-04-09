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
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          &larr; All Cycles
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {cycle.name}
        </h1>
        <div className="mt-1 flex items-center gap-4 text-sm text-zinc-500">
          <span>
            {new Date(cycle.start_date).toLocaleDateString()} &ndash;{" "}
            {new Date(cycle.end_date).toLocaleDateString()}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              cycle.status === "active"
                ? "bg-green-100 text-green-800"
                : cycle.status === "closed"
                  ? "bg-zinc-100 text-zinc-600"
                  : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {cycle.status}
          </span>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">Total Enrolled</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {enrollments?.length || 0}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">Active</p>
          <p className="text-2xl font-bold text-green-600">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">Pods</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {pods?.length || 0}
          </p>
        </div>
      </div>

      {pods && pods.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Pods
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {pods.map((pod) => (
              <Link
                key={pod.id}
                href={`/pods/${pod.id}`}
                className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    {pod.name || `Pod ${pod.id}`}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      pod.status === "active"
                        ? "bg-green-100 text-green-800"
                        : pod.status === "forming"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-zinc-100 text-zinc-600"
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
