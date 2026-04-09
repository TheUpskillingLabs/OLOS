import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function CyclesPage() {
  const supabase = await createClient();

  const { data: cycles } = await supabase
    .from("cycles")
    .select("id, name, slug, start_date, end_date, status")
    .order("start_date", { ascending: false });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Build Cycles
      </h1>
      {!cycles || cycles.length === 0 ? (
        <p className="text-zinc-500">No cycles yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cycles.map((cycle) => (
            <Link
              key={cycle.id}
              href={`/cycles/${cycle.id}`}
              className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {cycle.name}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    cycle.status === "active"
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : cycle.status === "closed"
                        ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                  }`}
                >
                  {cycle.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-500">
                {new Date(cycle.start_date).toLocaleDateString()} &ndash;{" "}
                {new Date(cycle.end_date).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
