import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveUserRoles } from "@/lib/auth/roles";
import PulseCheckForm from "./pulse-check-form";
import PulseCheckLocked from "./pulse-check-locked";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

type EnforcementStatus = "ok" | "warning_3day" | "warning_1day" | "overdue";

function computeStatus(deadlineMs: number, now: number): EnforcementStatus {
  const ms = deadlineMs - now;
  if (ms <= 0) return "overdue";
  if (ms < ONE_DAY_MS) return "warning_1day";
  if (ms <= THREE_DAYS_MS) return "warning_3day";
  return "ok";
}

export default async function PulseCheckPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const userRoles = await resolveUserRoles(service, user.id);
  const participantId = userRoles.participantId;

  if (!participantId) {
    return (
      <div className="mx-auto max-w-2xl py-10 text-center text-sm text-cloud/70">
        You must be a registered participant to submit a pulse check.
      </div>
    );
  }

  const { data: participant } = await service
    .from("participants")
    .select("last_pulse_completed_at, created_at")
    .eq("id", participantId)
    .single();

  const baseline =
    participant?.last_pulse_completed_at ?? participant?.created_at ?? new Date().toISOString();
  const deadlineMs = new Date(baseline).getTime() + SEVEN_DAYS_MS;
  const now = new Date().getTime();
  const status = computeStatus(deadlineMs, now);
  const enforcement = {
    last_completed_at: participant?.last_pulse_completed_at ?? null,
    deadline: new Date(deadlineMs).toISOString(),
    status,
    locked: status === "overdue",
  };

  // Options
  const { data: optionRows } = await service
    .from("option_lists")
    .select("id, list_name, value, display_order")
    .eq("active", true)
    .in("list_name", ["ai_tools", "pulse_benefits"])
    .order("display_order");
  const aiTools = (optionRows ?? [])
    .filter((r) => r.list_name === "ai_tools")
    .map((r) => ({ id: r.id, value: r.value }));
  const pulseBenefits = (optionRows ?? [])
    .filter((r) => r.list_name === "pulse_benefits")
    .map((r) => ({ id: r.id, value: r.value }));

  // Active cycle
  const { data: activeCycles } = await service
    .from("cycles")
    .select("id, name")
    .eq("status", "active");
  const activeCycle = activeCycles?.[0] ?? null;

  // User's pods + projects in active cycle
  let pods: { id: number; name: string }[] = [];
  let projects: { id: number; name: string; pod_id: number }[] = [];

  if (activeCycle) {
    const { data: podMems } = await service
      .from("pod_memberships")
      .select("pod_id, pods:pod_id(id, name, cycle_id)")
      .eq("participant_id", participantId)
      .is("inactive_at", null);

    pods = (podMems ?? [])
      .map((pm) => {
        const pod = Array.isArray(pm.pods) ? pm.pods[0] : pm.pods;
        return pod ? { id: pod.id, name: pod.name, cycle_id: pod.cycle_id } : null;
      })
      .filter((p): p is { id: number; name: string; cycle_id: number } => !!p)
      .filter((p) => p.cycle_id === activeCycle.id)
      .map((p) => ({ id: p.id, name: p.name }));

    if (pods.length > 0) {
      const podIds = pods.map((p) => p.id);
      const { data: projectRows } = await service
        .from("projects")
        .select("id, name, pod_id")
        .in("pod_id", podIds);
      projects = projectRows ?? [];
    }
  }

  // History (most recent 20)
  const { data: history } = await service
    .from("pulse_checks")
    .select("id, scheduled_date, completed_at, cycle_id, survey_responses")
    .eq("participant_id", participantId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(20);

  if (enforcement.locked) {
    return (
      <PulseCheckLocked
        enforcement={enforcement}
        aiTools={aiTools}
        pulseBenefits={pulseBenefits}
        cycle={activeCycle}
        pods={pods}
        projects={projects}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold text-white">Pulse Check</h1>
      <p className="mb-4 text-sm text-cloud/80">
        Your weekly check-in keeps you active and connected to The Labs.
      </p>

      <PulseCheckForm
        enforcement={enforcement}
        aiTools={aiTools}
        pulseBenefits={pulseBenefits}
        cycle={activeCycle}
        pods={pods}
        projects={projects}
      />

      {history && history.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Previous Submissions
          </h2>
          <div className="space-y-3">
            {history.map((entry) => (
              <HistoryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const ENERGY_LABELS = ["Very Low", "Low", "Moderate", "High", "Very High"];

function HistoryCard({
  entry,
}: {
  entry: {
    id: number;
    scheduled_date: string;
    completed_at: string | null;
    survey_responses: Record<string, unknown> | null;
  };
}) {
  const r = (entry.survey_responses ?? {}) as Record<string, unknown>;
  const energy = typeof r.energy_level === "number" ? r.energy_level : null;
  const accomplishment = typeof r.accomplishment === "string" ? r.accomplishment : "";
  const highlight = typeof r.highlight === "string" ? r.highlight : "";
  const challenge = typeof r.challenge === "string" ? r.challenge : "";
  const blockers = typeof r.blockers === "string" ? r.blockers : "";
  const tailwinds = typeof r.tailwinds === "string" ? r.tailwinds : "";
  const mitigation = typeof r.mitigation_strategy === "string" ? r.mitigation_strategy : "";

  return (
    <details className="rounded-md border border-whisper bg-white/[0.02] p-4 [&[open]>summary>span.chevron]:rotate-90">
      <summary className="flex cursor-pointer items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="chevron inline-block text-cloud/60 transition-transform">
            ›
          </span>
          <span className="text-sm font-medium text-cloud">
            {new Date(entry.scheduled_date).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
          {energy && (
            <span className="rounded-full px-2 py-0.5 text-xs font-medium text-aqua">
              Energy {energy}/5 ({ENERGY_LABELS[energy - 1]})
            </span>
          )}
        </div>
        {entry.completed_at && (
          <span className="text-xs text-cloud/60">
            {new Date(entry.completed_at).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        )}
      </summary>
      <div className="mt-3 space-y-2 text-sm text-cloud/80">
        {accomplishment && <p>{accomplishment}</p>}
        {highlight && (
          <p className="text-cloud/60">
            <span className="font-medium">Highlight:</span> {highlight}
          </p>
        )}
        {challenge && (
          <p className="text-cloud/60">
            <span className="font-medium">Challenge:</span> {challenge}
          </p>
        )}
        {blockers && (
          <p className="text-cloud/60">
            <span className="font-medium">Blockers:</span> {blockers}
          </p>
        )}
        {tailwinds && (
          <p className="text-cloud/60">
            <span className="font-medium">Tailwinds:</span> {tailwinds}
          </p>
        )}
        {mitigation && (
          <p className="text-cloud/60">
            <span className="font-medium">Mitigation:</span> {mitigation}
          </p>
        )}
      </div>
    </details>
  );
}
