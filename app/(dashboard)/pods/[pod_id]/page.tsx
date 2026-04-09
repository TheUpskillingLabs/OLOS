import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function PodDetailPage({
  params,
}: {
  params: Promise<{ pod_id: string }>;
}) {
  const { pod_id } = await params;
  const supabase = await createClient();

  const { data: pod } = await supabase
    .from("pods")
    .select(
      "id, name, status, cycle_id, problem_statement_id, problem_statements(statement_text)"
    )
    .eq("id", parseInt(pod_id))
    .single();

  if (!pod) notFound();

  const { data: members } = await supabase
    .from("pod_memberships")
    .select(
      "participant_id, joined_at, inactive_at, participants(first_name, last_name, preferred_name)"
    )
    .eq("pod_id", pod.id)
    .order("joined_at");

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status")
    .eq("pod_id", pod.id)
    .order("created_at");

  const ps = (pod.problem_statements as unknown) as Record<string, string> | null;

  return (
    <div>
      <div className="mb-8">
        <Link
          href={`/cycles/${pod.cycle_id}`}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          &larr; Back to Cycle
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {pod.name || `Pod ${pod.id}`}
        </h1>
        <span
          className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
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

      {ps?.statement_text && (
        <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-1 text-sm font-medium text-zinc-500">
            Problem Statement
          </h3>
          <p className="text-zinc-900 dark:text-zinc-50">
            {ps.statement_text}
          </p>
        </div>
      )}

      <div className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Members ({members?.length || 0})
        </h2>
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">
                  Name
                </th>
                <th className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">
                  Status
                </th>
                <th className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {(members || []).map((m) => {
                const p = (m.participants as unknown) as Record<string, string> | null;
                return (
                  <tr
                    key={m.participant_id}
                    className="bg-white dark:bg-zinc-900"
                  >
                    <td className="px-4 py-2 text-zinc-900 dark:text-zinc-50">
                      {p?.preferred_name || p?.first_name} {p?.last_name}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          m.inactive_at
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {m.inactive_at ? "inactive" : "active"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-zinc-500">
                      {new Date(m.joined_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {projects && projects.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Projects
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.map((project) => (
              <div
                key={project.id}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    {project.name || `Project ${project.id}`}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      project.status === "active"
                        ? "bg-green-100 text-green-800"
                        : project.status === "forming"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {project.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
