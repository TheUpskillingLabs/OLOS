import { requireLabLead } from "@/lib/auth/guards";
import { isAdmin } from "@/lib/auth/roles";
import Link from "next/link";
import { StatusBadge, DataTable } from "@/app/components/ui";
import { cycleStatusVariant, podNoun } from "@/lib/cycle/labels";
import { formatDate } from "@/lib/format/date";
import { one } from "@/lib/supabase/embed";
import PodsTable, {
  type PodAdminRow,
} from "@/app/(dashboard)/admin/cycles/[cycle_id]/pods-table";
import WorkstreamsDirectory, {
  type WorkstreamDirectoryRow,
} from "@/app/(dashboard)/admin/org/workstreams-directory";
import AnnouncementsAdmin, {
  type AdminAnnouncement,
} from "@/app/(dashboard)/admin/announcements/announcements-admin";
import LabInviteForm from "./lab-invite-form";

/**
 * The lab-lead workspace body (docs/LOCAL_LABS.md): everything a lead runs
 * inside their lab — pods per current cycle (reusing the admin PodsTable,
 * whose management drawer hits the lab-relaxed pod routes), the lab's
 * internal workstreams, the member roster, and invitations. Cycle
 * lifecycle is deliberately read-only here: HQ owns it.
 */

type CycleRow = {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  mode: string;
};

type EmbeddedPerson = {
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email?: string;
};

function personName(p: EmbeddedPerson | null): string {
  if (!p) return "";
  return `${p.preferred_name || p.first_name} ${p.last_name}`.trim();
}

const CURRENT_STATUSES = new Set(["draft", "upcoming", "active", "closing"]);

export default async function LabWorkspacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { lab, userRoles, serviceClient } = await requireLabLead(slug);
  const admin = isAdmin(userRoles);

  // The lab's cycle world (docs/LOCAL_LABS.md, sub-cohort model): the shared
  // HQ participant cycle (mode='open', lab_id NULL — every lab participates
  // in it automatically) plus this lab's own internal org cycles.
  const [
    { data: cycleRows },
    { data: workstreamRows },
    { data: memberRows },
    { data: announcementRows },
  ] = await Promise.all([
    serviceClient
      .from("cycles")
      .select("id, name, start_date, end_date, status, mode")
      .or(`lab_id.eq.${lab.id},and(lab_id.is.null,mode.eq.open)`)
      .order("start_date", { ascending: false }),
    serviceClient
      .from("workstreams")
      .select("id, name, description, status")
      .eq("lab_id", lab.id)
      .order("name"),
    serviceClient
      .from("participants")
      .select("id, first_name, last_name, preferred_name, email")
      .eq("metro_id", lab.id)
      .order("first_name"),
    serviceClient
      .from("announcements")
      .select("id, title, body, lab_id, status, pinned, published_at, created_at")
      .eq("lab_id", lab.id)
      .order("created_at", { ascending: false }),
  ]);
  const labAnnouncements = (announcementRows as AdminAnnouncement[]) ?? [];

  const cycles = (cycleRows ?? []) as CycleRow[];
  const currentCycles = cycles.filter((c) => CURRENT_STATUSES.has(c.status));
  const currentCycleIds = currentCycles.map((c) => c.id);

  // ── Pods per current cycle (the PodsTable assembly, lab-scoped) ────────
  // This lab's pods carry pods.lab_id (00067) — under the shared HQ open
  // cycle, cycle_id alone no longer identifies the lab's slice.
  const { data: podRows } = currentCycleIds.length
    ? await serviceClient
        .from("pods")
        .select("id, name, status, cycle_id, workstream_id")
        .eq("lab_id", lab.id)
        .in("cycle_id", currentCycleIds)
        .order("created_at")
    : { data: [] as { id: number; name: string | null; status: string; cycle_id: number; workstream_id: number | null }[] };
  const podIds = (podRows ?? []).map((p) => p.id);

  const [{ data: membershipRows }, { data: modRows }, { data: enrollmentRows }] =
    await Promise.all([
      podIds.length
        ? serviceClient
            .from("pod_memberships")
            .select("pod_id, participant_id, participants (first_name, last_name, preferred_name)")
            .in("pod_id", podIds)
            .is("inactive_at", null)
        : Promise.resolve({ data: [] as { pod_id: number; participant_id: number; participants: unknown }[] }),
      podIds.length
        ? serviceClient
            .from("moderator_assignments")
            .select("pod_id, participant_id, assigned_at, participants (first_name, last_name, preferred_name)")
            .in("pod_id", podIds)
            .is("removed_at", null)
        : Promise.resolve({ data: [] as { pod_id: number; participant_id: number; assigned_at: string; participants: unknown }[] }),
      currentCycleIds.length
        ? serviceClient
            .from("cycle_enrollments")
            .select("cycle_id, participant_id, status, participants (first_name, last_name, preferred_name)")
            .in("cycle_id", currentCycleIds)
        : Promise.resolve({ data: [] as { cycle_id: number; participant_id: number; status: string; participants: unknown }[] }),
    ]);

  // Projects per pod — gates the Finalize-projects action in the pod
  // Manage drawer (same as the admin cycle page).
  const { data: labProjects } = podIds.length
    ? await serviceClient.from("projects").select("id, pod_id").in("pod_id", podIds)
    : { data: [] as { id: number; pod_id: number }[] };
  const projectCountByPod: Record<number, number> = {};
  for (const proj of labProjects ?? []) {
    projectCountByPod[proj.pod_id] = (projectCountByPod[proj.pod_id] ?? 0) + 1;
  }

  const membersByPod: Record<number, { participant_id: number; name: string }[]> = {};
  for (const m of membershipRows ?? []) {
    const p = one(m.participants as EmbeddedPerson | EmbeddedPerson[] | null);
    (membersByPod[m.pod_id] ??= []).push({
      participant_id: m.participant_id,
      name: personName(p),
    });
  }
  const moderatorsByPod: Record<
    number,
    { participant_id: number; name: string; assigned_at: string }[]
  > = {};
  for (const ma of modRows ?? []) {
    const p = one(ma.participants as EmbeddedPerson | EmbeddedPerson[] | null);
    (moderatorsByPod[ma.pod_id] ??= []).push({
      participant_id: ma.participant_id,
      name: personName(p),
      assigned_at: ma.assigned_at,
    });
  }
  const enrolledByCycle: Record<number, { participant_id: number; name: string }[]> = {};
  for (const e of enrollmentRows ?? []) {
    const p = one(e.participants as EmbeddedPerson | EmbeddedPerson[] | null);
    (enrolledByCycle[e.cycle_id] ??= []).push({
      participant_id: e.participant_id,
      name: personName(p),
    });
  }

  // ── Workstream directory rows (runs in the lab's current org cycles) ──
  const runByWorkstream: Record<number, { pod_id: number; name: string | null }> = {};
  const orgCycleIds = new Set(
    currentCycles.filter((c) => c.mode === "org").map((c) => c.id)
  );
  for (const p of podRows ?? []) {
    if (p.workstream_id != null && orgCycleIds.has(p.cycle_id)) {
      runByWorkstream[p.workstream_id] = { pod_id: p.id, name: p.name };
    }
  }
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
              co_leads: (moderatorsByPod[run.pod_id] ?? []).map((m) => ({
                participant_id: m.participant_id,
                name: m.name,
              })),
            }
          : null,
      };
    }
  );

  // ── Invitations targeting this lab ─────────────────────────────────────
  // Lab-relevant = into one of the lab's own (org) cycles, or into one of
  // the lab's pods. The shared HQ open cycle is in currentCycleIds, so a
  // bare cycle filter would surface every lab's HQ-cycle invitations —
  // post-filter by pod instead.
  const labOwnCycleIds = new Set(
    currentCycles.filter((c) => c.mode === "org").map((c) => c.id)
  );
  const labPodIds = new Set(podIds);
  const { data: rawInviteRows } = currentCycleIds.length
    ? await serviceClient
        .from("invitations")
        .select("id, email, status, pod_role, created_at, cycle_id, pod_id, cycles (name)")
        .in("cycle_id", currentCycleIds)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] as { id: number; email: string; status: string; pod_role: string | null; created_at: string; cycle_id: number; pod_id: number | null; cycles: unknown }[] };
  const inviteRows = (rawInviteRows ?? [])
    .filter(
      (inv) =>
        labOwnCycleIds.has(inv.cycle_id) ||
        (inv.pod_id != null && labPodIds.has(inv.pod_id))
    )
    .slice(0, 25);

  const memberRoster = (memberRows ?? []).map((p) => ({
    participant_id: p.id,
    name: personName(p as EmbeddedPerson),
    email: p.email as string,
  }));

  const invitePods = (podRows ?? []).map((p) => {
    const cycle = currentCycles.find((c) => c.id === p.cycle_id);
    return {
      id: p.id,
      name: p.name ?? `Pod ${p.id}`,
      cycle_id: p.cycle_id,
      cycle_name: cycle?.name ?? "",
      mode: cycle?.mode ?? "open",
    };
  });

  return (
    <div className="space-y-10">
      {/* Cycles — read-only lifecycle: HQ coordinates the calendar. */}
      <section>
        <h2 className="mb-1 t-h3 text-ink">Cycles</h2>
        <p className="mb-4 text-sm text-meta">
          Centrally coordinated by HQ — reach out to HQ to open or close a
          cycle.
        </p>
        <DataTable<CycleRow>
          rows={cycles}
          rowKey={(row) => row.id}
          empty="No cycles for this lab yet — HQ creates them."
          columns={[
            {
              key: "cycle",
              header: "Cycle",
              className: "font-medium text-ink",
              cell: (row) => row.name,
            },
            {
              key: "track",
              header: "Track",
              className: "text-meta",
              cell: (row) =>
                row.mode === "org" ? "Internal (team)" : "Participant (HQ shared)",
            },
            {
              key: "status",
              header: "Status",
              cell: (row) => (
                <StatusBadge variant={cycleStatusVariant(row.status)}>
                  {row.status}
                </StatusBadge>
              ),
            },
            {
              key: "dates",
              header: "Dates",
              className: "text-meta tabular-nums",
              cell: (row) => (
                <>
                  {formatDate(row.start_date)} &ndash; {formatDate(row.end_date)}
                </>
              ),
            },
            ...(admin
              ? [
                  {
                    key: "actions",
                    header: "",
                    align: "right" as const,
                    cell: (row: CycleRow) => (
                      <Link
                        href={`/admin/cycles/${row.id}`}
                        className="text-sm font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:text-ink"
                      >
                        Manage &rarr;
                      </Link>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </section>

      {/* Pods per current cycle — the lead's main management surface. */}
      {currentCycles.map((cycle) => {
        const cyclePods: PodAdminRow[] = (podRows ?? [])
          .filter((p) => p.cycle_id === cycle.id)
          .map((p) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            members: membersByPod[p.id] ?? [],
            moderators: moderatorsByPod[p.id] ?? [],
            projectCount: projectCountByPod[p.id] ?? 0,
          }));
        return (
          <section key={cycle.id}>
            <h2 className="mb-4 t-h3 text-ink">
              {cycle.name} — {podNoun(cycle.mode, true)} ({cyclePods.length})
            </h2>
            <PodsTable
              cycleId={cycle.id}
              pods={cyclePods}
              participants={enrolledByCycle[cycle.id] ?? []}
              mode={cycle.mode}
            />
          </section>
        );
      })}

      {/* The lab's internal workstreams (durable, cross-cycle). */}
      <section>
        <h2 className="mb-1 t-h3 text-ink">Workstreams</h2>
        <p className="mb-4 text-sm text-meta">
          Your lab team&rsquo;s durable internal workstreams. Runs charter
          into the lab&rsquo;s internal cycle each quarter.
        </p>
        <WorkstreamsDirectory workstreams={workstreamDirectoryRows} labId={lab.id} />
      </section>

      {/* Lab announcements — lab-scoped org news for this lab's members. */}
      <section>
        <h2 className="mb-1 t-h3 text-ink">Announcements</h2>
        <p className="mb-4 text-sm text-meta">
          Post news for {lab.name} members — it shows in the org-news rail of
          their dashboard. Scoped to this lab; HQ posts org-wide news separately.
          For a post in the community feed instead, post as your lab from{" "}
          <Link
            href={`/local-labs/${lab.slug}`}
            className="font-semibold text-teal-deep hover:underline"
          >
            your lab page
          </Link>
          .
        </p>
        <AnnouncementsAdmin
          initial={labAnnouncements}
          labs={[]}
          fixedLab={{ id: lab.id, label: lab.name }}
        />
      </section>

      {/* Invitations into this lab's cycles. */}
      <section>
        <h2 className="mb-1 t-h3 text-ink">Invitations</h2>
        <p className="mb-4 text-sm text-meta">
          Invite people into this lab&rsquo;s cycles and pods. Role presets
          and permissions are HQ-only.
        </p>
        <LabInviteForm
          cycles={currentCycles.map((c) => ({ id: c.id, name: c.name, mode: c.mode }))}
          pods={invitePods}
          invitations={(inviteRows ?? []).map((inv) => ({
            id: inv.id,
            email: inv.email,
            status: inv.status,
            pod_role: inv.pod_role,
            created_at: inv.created_at,
            cycle_name:
              one(inv.cycles as { name: string } | { name: string }[] | null)?.name ??
              "",
          }))}
        />
      </section>

      {/* Roster — everyone whose metro is this lab. */}
      <section>
        <h2 className="mb-4 t-h3 text-ink">
          Members ({memberRoster.length})
        </h2>
        <DataTable
          rows={memberRoster}
          rowKey={(row) => row.participant_id}
          empty="No members mapped to this lab yet."
          columns={[
            {
              key: "name",
              header: "Name",
              className: "font-medium text-ink",
              cell: (row) => row.name,
            },
            {
              key: "email",
              header: "Email",
              className: "text-meta",
              cell: (row) => row.email,
            },
          ]}
        />
      </section>
    </div>
  );
}
