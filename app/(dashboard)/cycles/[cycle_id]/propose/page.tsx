import Link from "next/link";
import { windowOpen, parseWindow, fmtLabDateTime } from "@/lib/cycles/lab-time";
import { ChevronLeft } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProposeForm from "./propose-form";

export default async function ProposePage({
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

  // Check if window is open
  const serviceClient = createServiceClient();
  // maybeSingle: a cycle with no cycle_config row is a real production state
  // (config is seeded by hand) — .single() would error and read as a generic
  // "closed" message with no hint at the actual problem.
  const { data: config } = await serviceClient
    .from("cycle_config")
    .select("problem_statement_open, problem_statement_close")
    .eq("cycle_id", cycleId)
    .maybeSingle();

  // Naive window columns are UTC instants; entry + display are lab-local
  // (lib/cycles/lab-time.ts).
  const now = new Date();
  const isOpen = windowOpen(
    config?.problem_statement_open,
    config?.problem_statement_close,
    now
  );

  // Get user's name for pre-filling
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let participantName = "";
  if (user) {
    const { data: participant } = await supabase
      .from("participants")
      .select("first_name, last_name, preferred_name")
      .eq("auth_user_id", user.id)
      .single();
    if (participant) {
      participantName =
        `${participant.preferred_name || participant.first_name || ""} ${participant.last_name || ""}`.trim();
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <Link
          href={`/cycles/${cycle.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-meta transition-colors duration-150 hover:text-teal-deep"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {cycle.name}
        </Link>
        <h1 className="t-h1 mt-2 text-ink">
          Submit your problem situation
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-charcoal">
          Bring over what your Triangulator map already holds: the situation
          you named in the workbook, the paradox at its core, and one
          distilled sentence for the ballot. Cycle participants vote to
          shortlist the strongest situations; the shortlist becomes the
          cycle&rsquo;s pods, and pods that reach the minimum number of
          registrants officially form.
        </p>
        <p className="mt-2 text-sm font-medium text-charcoal">
          Parts 2 and 3 are a paste from your workbook — if a field feels
          hard to fill, that&rsquo;s the workbook telling you it isn&rsquo;t
          done yet.
        </p>
      </div>

      {isOpen ? (
        <ProposeForm cycleId={cycleId} participantName={participantName} />
      ) : (
        <div className="rounded-card border border-ink/10 bg-white p-6 shadow-card">
          <p className="text-charcoal">
            {config
              ? "Problem situation submission is not currently open."
              : "This cycle isn't fully configured yet — the submission window hasn't been scheduled. If you expected it to be open, let an organizer know."}
          </p>
          {config?.problem_statement_open &&
            now < (parseWindow(config.problem_statement_open) as Date) && (
              <p className="mt-2 text-sm text-meta tabular-nums">
                Opens {fmtLabDateTime(config.problem_statement_open)}
              </p>
            )}
        </div>
      )}
    </div>
  );
}
