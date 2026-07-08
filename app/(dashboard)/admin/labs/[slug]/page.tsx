import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { StatusBadge, DataTable } from "@/app/components/ui";
import { cycleStatusVariant } from "@/lib/cycle/labels";
import { formatDate } from "@/lib/format/date";
import { one } from "@/lib/supabase/embed";
import CreateCycleForm from "../../cycles/create-cycle-form";
import LabLeadsPanel, { type LeadRow, type ParticipantOption } from "./lab-leads-panel";

/**
 * HQ's per-lab drill-in (docs/LOCAL_LABS.md): the lab's cycle streams
 * (participant + internal), per-lab cycle creation (lifecycle stays
 * HQ-owned), and the lab-lead roster. The lab-facing workspace the leads
 * themselves use is /labs/[slug] (Phase 3) — this page is the HQ view.
 */

type CycleListRow = {
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
  email: string;
};

function personName(p: EmbeddedPerson | null): string {
  if (!p) return "";
  return `${p.preferred_name || p.first_name} ${p.last_name}`.trim();
}

function cycleSection(title: string, rows: CycleListRow[], empty: string) {
  return (
    <section className="mb-8">
      <h2 className="mb-4 t-h3 text-ink">{title}</h2>
      <DataTable<CycleListRow>
        rows={rows}
        rowKey={(row) => row.id}
        empty={empty}
        columns={[
          {
            key: "cycle",
            header: "Cycle",
            className: "font-medium text-ink",
            cell: (row) => row.name,
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
          {
            key: "actions",
            header: "",
            align: "right",
            cell: (row) => (
              <Link
                href={`/admin/cycles/${row.id}`}
                className="text-sm font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:text-ink"
              >
                Manage &rarr;
              </Link>
            ),
          },
        ]}
      />
    </section>
  );
}

export default async function AdminLabDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { serviceClient } = await requireAdmin();
  const { slug } = await params;

  const { data: lab } = await serviceClient
    .from("metros")
    .select("id, slug, name, st, status, is_default")
    .eq("slug", slug)
    .maybeSingle();
  if (!lab) notFound();

  const [{ data: cycles }, { data: leadRows }, { data: participantRows }] =
    await Promise.all([
      serviceClient
        .from("cycles")
        .select("id, name, start_date, end_date, status, mode")
        .eq("lab_id", lab.id)
        .order("start_date", { ascending: false }),
      serviceClient
        .from("lab_leads")
        .select(
          "participant_id, assigned_at, participants!lab_leads_participant_id_fkey(first_name, last_name, preferred_name, email)"
        )
        .eq("lab_id", lab.id)
        .is("removed_at", null)
        .order("assigned_at"),
      serviceClient
        .from("participants")
        .select("id, first_name, last_name, preferred_name, email")
        .order("first_name"),
    ]);

  const allCycles = (cycles ?? []) as CycleListRow[];
  const participantCycles = allCycles.filter((c) => c.mode !== "org");
  const internalCycles = allCycles.filter((c) => c.mode === "org");

  const leads: LeadRow[] = (leadRows ?? []).map((row) => {
    const p = one(row.participants as EmbeddedPerson | EmbeddedPerson[] | null);
    return {
      participant_id: row.participant_id,
      name: personName(p),
      email: p?.email ?? "",
      assigned_at: row.assigned_at,
    };
  });

  const participantOptions: ParticipantOption[] = (participantRows ?? []).map(
    (p) => ({
      participant_id: p.id,
      name: personName(p as EmbeddedPerson),
    })
  );

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="lbl mb-1.5">Local Lab</div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="t-h1 text-ink">
              {lab.name}
              {lab.st ? <span className="text-meta"> ({lab.st})</span> : null}
            </h1>
            <StatusBadge variant={lab.status === "active" ? "active" : "forming"}>
              {lab.status}
            </StatusBadge>
          </div>
          <p className="mt-1 text-sm text-meta">
            <Link
              href="/admin/labs"
              className="font-semibold text-teal-deep hover:underline"
            >
              &larr; All labs
            </Link>
          </p>
        </div>
        <CreateCycleForm fixedMode="org" labId={lab.id} />
      </div>

      {/* Sub-cohort model (docs/LOCAL_LABS.md, 00067): the participant track
          is the single HQ quarterly cycle — this lab participates in it
          automatically, so there is no per-lab participant cycle to create.
          Historical per-lab participant cycles (if any) still list. */}
      <section className="mb-8 rounded-card border border-teal/30 bg-teal/10 p-4">
        <p className="text-sm text-ink">
          <span className="font-semibold">Participant cohort:</span> this lab
          participates in the HQ quarterly cycle automatically — members join
          it and form {lab.name}-tagged pods. Manage the cycle from{" "}
          <Link href="/admin" className="font-semibold text-teal-deep hover:underline">
            Cycles
          </Link>
          .
        </p>
      </section>
      {participantCycles.length > 0 &&
        cycleSection(
          "Historical participant cycles",
          participantCycles,
          "None."
        )}
      {cycleSection(
        "Internal cycles",
        internalCycles,
        "No internal (team) cycles for this lab yet."
      )}

      <section className="mb-8">
        <h2 className="mb-1 t-h3 text-ink">Lab leads</h2>
        <p className="mb-4 text-sm text-meta">
          Leads manage this lab&rsquo;s pods, rosters, and workstreams. Cycle
          lifecycle stays with HQ.
        </p>
        <LabLeadsPanel
          labId={lab.id}
          leads={leads}
          participantOptions={participantOptions}
        />
      </section>
    </div>
  );
}
