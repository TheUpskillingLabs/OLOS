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
      <h1 className="mb-6 text-2xl font-bold text-white">
        Build Cycles
      </h1>
      {!cycles || cycles.length === 0 ? (
        <p className="text-cloud/60">No cycles yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cycles.map((cycle) => (
            <Link
              key={cycle.id}
              href={`/cycles/${cycle.id}`}
              className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6 backdrop-blur-sm transition-all hover:border-white/10 hover:bg-white/[0.04]"
            >
              <div className="flex items-start justify-between">
                <h2 className="text-lg font-semibold text-white">
                  {cycle.name}
                </h2>
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
              <p className="mt-2 text-sm text-cloud/60">
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
