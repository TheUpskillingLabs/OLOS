import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { StatusBadge, DataTable } from "@/app/components/ui";
import { cycleStatusVariant } from "@/lib/cycle/labels";
import { one } from "@/lib/supabase/embed";
import CreateCycleForm from "../cycles/create-cycle-form";
import WorkstreamsDirectory, {
  type WorkstreamDirectoryRow,
} from "./workstreams-directory";

/**
 * The Organization surface (docs/ORG_CYCLES.md §2/§5): a durable home for
 * the org's own quarterly cycle, separate from the per-cycle
 * /admin/cycles/[id] drill-down. Three sections top to bottom: the org
 * cycle list (current cards + a collapsed past list), the workstream
 * directory (durable, cross-cycle — create/edit/status live in
 * workstreams-directory.tsx), and a core-contributor roster scoped to the current org
 * cycle — the active one if it exists, else the most recent draft/upcoming
 * (so the roster is usable while the quarter is being set up).
 */

const CURRENT_STATUSES = new Set(["draft", "upcoming", "active", "closing"]);

type OrgCycleRow = {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
};

type RunPodRow = {
  id: number;
  name: string | null;
  workstream_id: number | null;
  cycle_id: number;
};

type EmbeddedParticipant = {
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email: string;
};

type ContributorRow = {
  participant_id: number;
  name: string;
  email: string;
  is_co_lead: boolean;
  workstreams: string[];
};

function participantName(p: EmbeddedParticipant | null): string {
  if (!p) return "";
  return `${p.preferred_name || p.first_name} ${p.last_name}`.trim();
}

export default async function AdminOrgPage() {
  const { serviceClient } = await requireAdmin();

  const { data: cycleRows } = await serviceClient
    .from("cycles")
    .select("id, name, start_date, end_date, status")
    .eq("mode", "org")
    .order("start_date", { ascending: false });

  const cycles: OrgCycleRow[] = cycleRows ?? [];
  const current = cycles.filter((c) => CURRENT_STATUSES.has(c.status));
  const past = cycles.filter((c) => !CURRENT_STATUSES.has(c.status));
  // Active wins; otherwise fall back to the most recent draft/upcoming so
  // the directory's run column + core-contributor roster aren't empty during setup.
  const rosterCycle =
    current.find((c) => c.status === "active") ?? current[0] ?? null;
  const currentCycleIds = current.map((c) => c.id);

  const [{ data: enrollmentRows }, { data: runPodRows }, { data: workstreamRows }] =
    await Promise.all([
      currentCycleIds.length
        ? serviceClient
            .from("cycle_enrollments")
            .select("cycle_id, status")
            .in("cycle_id", currentCycleIds)
        : Promise.resolve({ data: [] as { cycle_id: number; status: string }[] }),
      currentCycleIds.length
        ? serviceClient
            .from("pods")
            .select("id, name, workstream_id, cycle_id")
            .in("cycle_id", currentCycleIds)
            .not("workstream_id", "is", null)
        : Promise.resolve({ data: [] as RunPodRow[] }),
      serviceClient
        .from("workstreams")
        .select("id, name, description, status")
        .order("name"),
    ]);

  // Core-contributor + runs counts per current cycle, for the "Org cycles" cards.
  const contributorCountByCycle: Record<number, number> = {};
  for (const e of enrollmentRows ?? []) {
    if (e.status !== "active") continue;
    contributorCountByCycle[e.cycle_id] = (contributorCountByCycle[e.cycle_id] ?? 0) + 1;
  }
  const runsCountByCycle: Record<number, number> = {};
  for (const r of (runPodRows ?? []) as RunPodRow[]) {
    runsCountByCycle[r.cycle_id] = (runsCountByCycle[r.cycle_id] ?? 0) + 1;
  }

  // The roster cycle's runs feed both the workstream directory's
  // "current run" cell and the core-contributor roster below — everything else on
  // this page is cross-cycle or per-card.
  const activeRuns = rosterCycle
    ? ((runPodRows ?? []) as RunPodRow[]).filter((r) => r.cycle_id === rosterCycle.id)
    : [];
  const activeRunPodIds = activeRuns.map((r) => r.id);
  const runByWorkstream: Record<number, { pod_id: number; name: string | null }> = {};
  const workstreamIdByPod: Record<number, number> = {};
  for (const r of activeRuns) {
    if (r.workstream_id == null) continue;
    runByWorkstream[r.workstream_id] = { pod_id: r.id, name: r.name };
    workstreamIdByPod[r.id] = r.workstream_id;
  }

  const [{ data: modAssignmentRows }, { data: membershipRows }] = await Promise.all([
    activeRunPodIds.length
      ? serviceClient
          .from("moderator_assignments")
          .select("participant_id, pod_id, participants (first_name, last_name, preferred_name, email)")
          .in("pod_id", activeRunPodIds)
          .is("removed_at", null)
      : Promise.resolve({
          data: [] as { participant_id: number; pod_id: number; participants: unknown }[],
        }),
    activeRunPodIds.length
      ? serviceClient
          .from("pod_memberships")
          .select("participant_id, pod_id, participants (first_name, last_name, preferred_name, email)")
          .in("pod_id", activeRunPodIds)
          .is("inactive_at", null)
      : Promise.resolve({
          data: [] as { participant_id: number; pod_id: number; participants: unknown }[],
        }),
  ]);

  const coLeadsByPod: Record<number, { participant_id: number; name: string }[]> = {};
  const coLeadParticipantIds = new Set<number>();
  for (const ma of modAssignmentRows ?? []) {
    const p = one(
      ma.participants as EmbeddedParticipant | EmbeddedParticipant[] | null
    );
    (coLeadsByPod[ma.pod_id] ??= []).push({
      participant_id: ma.participant_id,
      name: participantName(p),
    });
    coLeadParticipantIds.add(ma.participant_id);
  }

  const workstreamNameById: Record<number, string> = {};
  for (const w of workstreamRows ?? []) {
    workstreamNameById[w.id] = w.name;
  }

  const contributorMap = new Map<number, ContributorRow>();
  for (const m of membershipRows ?? []) {
    const p = one(
      m.participants as EmbeddedParticipant | EmbeddedParticipant[] | null
    );
    const workstreamId = workstreamIdByPod[m.pod_id];
    const workstreamName = workstreamId != null ? workstreamNameById[workstreamId] : undefined;
    const existing = contributorMap.get(m.participant_id);
    if (existing) {
      if (workstreamName && !existing.workstreams.includes(workstreamName)) {
        existing.workstreams.push(workstreamName);
      }
    } else {
      contributorMap.set(m.participant_id, {
        participant_id: m.participant_id,
        name: participantName(p),
        email: p?.email ?? "",
        is_co_lead: coLeadParticipantIds.has(m.participant_id),
        workstreams: workstreamName ? [workstreamName] : [],
      });
    }
  }

  const contributorRows = Array.from(contributorMap.values()).sort((a, b) => {
    if (a.is_co_lead !== b.is_co_lead) return a.is_co_lead ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const workstreamDirectoryRows: WorkstreamDirectoryRow[] = (workstreamRows ?? []).map(
    (w) => {
      const run = runByWorkstream[w.id];
      return {
        id: w.id,
        name: w.name,
        description: w.description,
        status: w.status,
        run: run
          ? {
              pod_id: run.pod_id,
              name: run.name,
              co_leads: coLeadsByPod[run.pod_id] ?? [],
            }
          : null,
      };
    }
  );

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="t-h1 text-ink">Organization</h1>
          <p className="mt-1 text-sm text-meta">
            The Labs&rsquo; own quarterly cycle — workstreams, core contributors, and runs.
          </p>
        </div>
        <CreateCycleForm fixedMode="org" />
      </div>

      <section className="mb-10">
        <h2 className="mb-4 t-h3 text-ink">Org cycles</h2>
        {current.length === 0 ? (
          <p className="text-sm text-meta">
            No organization cycle yet — create one to start the quarter.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {current.map((cycle) => (
              <div
                key={cycle.id}
                className="rounded-card border border-ink/10 bg-white p-5 shadow-card"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold tracking-tight text-ink">
                    {cycle.name}
                  </h3>
                  <StatusBadge variant={cycleStatusVariant(cycle.status)}>
                    {cycle.status}
                  </StatusBadge>
                </div>
                <p className="text-xs text-meta tabular-nums">
                  {new Date(cycle.start_date).toLocaleDateString()} &ndash;{" "}
                  {new Date(cycle.end_date).toLocaleDateString()}
                </p>
                <div className="mt-3 flex items-center gap-4 text-xs text-meta tabular-nums">
                  <span>{contributorCountByCycle[cycle.id] ?? 0} core contributor{(contributorCountByCycle[cycle.id] ?? 0) === 1 ? "" : "s"}</span>
                  <span>{runsCountByCycle[cycle.id] ?? 0} runs</span>
                </div>
                <Link
                  href={`/admin/cycles/${cycle.id}`}
                  className="mt-3 inline-block text-sm font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:text-ink"
                >
                  Manage &rarr;
                </Link>
              </div>
            ))}
          </div>
        )}

        {past.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-meta transition-colors duration-150 hover:text-charcoal">
              Past org cycles ({past.length})
            </summary>
            <div className="mt-3 divide-y divide-ink/10 rounded-card border border-ink/10 bg-white">
              {past.map((cycle) => (
                <div
                  key={cycle.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <span className="text-ink">{cycle.name}</span>
                  <StatusBadge variant={cycleStatusVariant(cycle.status)}>
                    {cycle.status}
                  </StatusBadge>
                  <span className="text-meta tabular-nums">
                    {new Date(cycle.start_date).toLocaleDateString()} &ndash;{" "}
                    {new Date(cycle.end_date).toLocaleDateString()}
                  </span>
                  <Link
                    href={`/admin/cycles/${cycle.id}`}
                    className="font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:text-ink"
                  >
                    Manage &rarr;
                  </Link>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-4 t-h3 text-ink">Workstreams</h2>
        <WorkstreamsDirectory workstreams={workstreamDirectoryRows} />
      </section>

      <section className="mb-10">
        <h2 className="mb-4 t-h3 text-ink">
          Core contributors
          {rosterCycle && (
            <span className="ml-2 text-sm font-normal text-meta">
              {rosterCycle.name}
            </span>
          )}
        </h2>
        {!rosterCycle ? (
          <p className="text-sm text-meta">No current organization cycle.</p>
        ) : contributorRows.length === 0 ? (
          <p className="text-sm text-meta">
            No core contributors on runs yet — invite them by email, or add
            already-registered members from the cycle&rsquo;s Workstreams tab.
          </p>
        ) : (
          <DataTable<ContributorRow>
            rows={contributorRows}
            rowKey={(row) => row.participant_id}
            columns={[
              {
                key: "name",
                header: "Name",
                className: "font-medium text-ink",
                cell: (row) => row.name,
              },
              {
                key: "role",
                header: "Role",
                cell: (row) => (
                  <StatusBadge variant={row.is_co_lead ? "active" : "inactive"}>
                    {row.is_co_lead ? "Co-lead" : "Member"}
                  </StatusBadge>
                ),
              },
              {
                key: "workstreams",
                header: "Workstreams",
                className: "text-meta",
                cell: (row) => row.workstreams.join(", ") || "—",
              },
              {
                key: "email",
                header: "Email",
                className: "text-meta",
                cell: (row) => row.email,
              },
            ]}
          />
        )}
      </section>

      <div className="flex items-center gap-6">
        {rosterCycle && (
          <Link
            href={`/admin/cycles/${rosterCycle.id}?tab=formation`}
            className="text-sm font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:text-ink"
          >
            Add core contributors &rarr;
          </Link>
        )}
        <Link
          href="/admin/people?tab=invitations"
          className="text-sm font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:text-ink"
        >
          Invite core contributors &rarr;
        </Link>
      </div>
    </div>
  );
}
