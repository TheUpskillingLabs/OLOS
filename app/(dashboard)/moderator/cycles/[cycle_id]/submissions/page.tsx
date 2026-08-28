import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveUserRoles, isAdmin, isModerator } from "@/lib/auth/roles";
import { effectiveUser } from "@/lib/auth/simulation";
import { fmtLabDateTime, fmtDateOnly } from "@/lib/cycles/lab-time";
import { SolutionProposalDetails } from "@/app/components/solution-proposal-details";

// Poderator "Project submissions & outreach" — cycle-scoped and fully
// attributed (the counterpart to the anonymized member gallery). Shows every
// submitted pitch with author + time, and a roster of pod members flagged by
// whether they've submitted and how recently they logged a Learning Log, so
// poderators can target outreach to non-submitters and the disengaged.

type ParticipantLite = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email: string | null;
  is_staff: boolean | null;
  is_test: boolean | null;
};

function displayName(p: ParticipantLite | null): string {
  if (!p) return "Unknown";
  const name = [p.preferred_name || p.first_name, p.last_name]
    .filter(Boolean)
    .join(" ");
  return name || p.email || `Participant ${p.id}`;
}

function embedded<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v ?? null;
}

export default async function ModeratorSubmissionsPage({
  params,
}: {
  params: Promise<{ cycle_id: string }>;
}) {
  const { cycle_id } = await params;
  const cycleId = parseInt(cycle_id, 10);
  if (Number.isNaN(cycleId)) notFound();

  const user = await effectiveUser();
  if (!user) redirect("/login");

  const serviceClient = createServiceClient();
  const userRoles = await resolveUserRoles(serviceClient, user.id);
  if (!isAdmin(userRoles) && !isModerator(userRoles)) redirect("/cycles");

  const { data: cycle } = await serviceClient
    .from("cycles")
    .select("id, name")
    .eq("id", cycleId)
    .single();
  if (!cycle) notFound();

  // Scope: admins see every pod; poderators see only their assigned pods.
  let podIds: number[] = [];
  if (isAdmin(userRoles)) {
    const { data } = await serviceClient
      .from("pods")
      .select("id")
      .eq("cycle_id", cycleId);
    podIds = (data ?? []).map((p) => p.id as number);
  } else if (userRoles.moderatorPodIds.length > 0) {
    const { data } = await serviceClient
      .from("pods")
      .select("id")
      .eq("cycle_id", cycleId)
      .in("id", userRoles.moderatorPodIds);
    podIds = (data ?? []).map((p) => p.id as number);
  }

  type ProposalFull = {
    id: number;
    participant_id: number;
    name: string | null;
    summary: string | null;
    proposal_data: Record<string, string> | null;
    created_at: string;
    participants: ParticipantLite | ParticipantLite[] | null;
  };
  type MembershipRow = {
    participant_id: number;
    participants: ParticipantLite | ParticipantLite[] | null;
  };

  let proposals: ProposalFull[] = [];
  let memberships: MembershipRow[] = [];
  if (podIds.length > 0) {
    const [{ data: pr }, { data: ms }] = await Promise.all([
      serviceClient
        .from("solution_proposals")
        .select(
          "id, participant_id, name, summary, proposal_data, created_at, participants:participant_id(id, first_name, last_name, preferred_name, email, is_staff, is_test)"
        )
        .in("pod_id", podIds)
        .order("created_at"),
      serviceClient
        .from("pod_memberships")
        .select(
          "participant_id, participants:participant_id(id, first_name, last_name, preferred_name, email, is_staff, is_test)"
        )
        .in("pod_id", podIds)
        .is("inactive_at", null),
    ]);
    proposals = (pr as ProposalFull[] | null) ?? [];
    memberships = (ms as MembershipRow[] | null) ?? [];
  }

  // Roster: dedupe members, drop staff/test, flag submission + last log.
  const submittedIds = new Set(proposals.map((p) => p.participant_id));
  const rosterMap = new Map<number, ParticipantLite>();
  for (const m of memberships) {
    const p = embedded(m.participants);
    if (!p || p.is_staff || p.is_test) continue;
    rosterMap.set(p.id, p);
  }
  const rosterIds = [...rosterMap.keys()];

  // Latest Learning Log per member this cycle — the engagement proxy for
  // "logged in recently". True last-login (auth.users.last_sign_in_at) is a
  // noted fast-follow; this is the strongest activity signal we already store.
  const lastLogByParticipant = new Map<number, string>();
  if (rosterIds.length > 0) {
    const { data: logs } = await serviceClient
      .from("learning_logs")
      .select("participant_id, created_at")
      .eq("cycle_id", cycleId)
      .in("participant_id", rosterIds)
      .order("created_at", { ascending: false });
    for (const l of logs ?? []) {
      if (!lastLogByParticipant.has(l.participant_id)) {
        lastLogByParticipant.set(l.participant_id, l.created_at);
      }
    }
  }

  // Project-registration status (2026-08 direct-registration phase): which
  // project each member has joined, if any — the registration-window
  // counterpart to the "Submitted" flag. Active memberships only
  // (left_at IS NULL), so a withdraw immediately reads as unregistered.
  const projectByParticipant = new Map<number, string>();
  if (rosterIds.length > 0) {
    const { data: pms } = await serviceClient
      .from("project_memberships")
      .select("participant_id, projects:project_id(name)")
      .eq("cycle_id", cycleId)
      .in("participant_id", rosterIds)
      .is("left_at", null);
    for (const pm of pms ?? []) {
      const proj = embedded(
        pm.projects as { name: string | null } | { name: string | null }[] | null
      );
      projectByParticipant.set(
        pm.participant_id as number,
        proj?.name ?? "Unnamed project"
      );
    }
  }

  const roster = rosterIds
    .map((id) => {
      const p = rosterMap.get(id) as ParticipantLite;
      return {
        id,
        name: displayName(p),
        email: p.email,
        submitted: submittedIds.has(id),
        project: projectByParticipant.get(id) ?? null,
        lastLog: lastLogByParticipant.get(id) ?? null,
      };
    })
    .sort((a, b) => {
      // Outreach order for the current phase: not-in-a-project first, then
      // non-submitters, then least-recently-active.
      if (!!a.project !== !!b.project) return a.project ? 1 : -1;
      if (a.submitted !== b.submitted) return a.submitted ? 1 : -1;
      const at = a.lastLog ? new Date(a.lastLog).getTime() : 0;
      const bt = b.lastLog ? new Date(b.lastLog).getTime() : 0;
      return at - bt;
    });

  const submittedCount = roster.filter((r) => r.submitted).length;
  const registeredCount = roster.filter((r) => r.project).length;

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <Link
          // ?view=all skips the returning-poderator auto-redirect, which would
          // otherwise bounce this back-link straight into the last-viewed pod.
          href="/moderator?view=all"
          className="inline-flex items-center gap-1.5 text-sm text-meta transition-colors duration-150 hover:text-teal-deep"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Poderator dashboard
        </Link>
        <h1 className="t-h1 mt-2 text-ink">Project submissions</h1>
        <p className="mt-1 text-sm text-charcoal">
          {cycle.name} — {proposals.length} submitted ·{" "}
          {submittedCount}/{roster.length} members submitted ·{" "}
          {registeredCount}/{roster.length} in a project.{" "}
          <Link
            href={`/moderator/cycles/${cycle.id}/vote-progress`}
            className="font-semibold text-teal-deep hover:underline"
          >
            Vote progress &rarr;
          </Link>
        </p>
      </div>

      {podIds.length === 0 ? (
        <div className="rounded-card border border-ink/10 bg-white p-6 shadow-card">
          <p className="text-charcoal">No pods in scope for this cycle.</p>
        </div>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="t-h3 mb-3 text-ink">Submissions</h2>
            {proposals.length === 0 ? (
              <div className="rounded-card border border-dashed border-meta-soft bg-white p-8 text-center">
                <p className="text-sm text-meta">No projects submitted yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {proposals.map((p) => {
                  const author = embedded(p.participants);
                  return (
                    <div
                      key={p.id}
                      className="rounded-card border border-ink/10 bg-white p-4 shadow-card"
                    >
                      <h3 className="font-semibold tracking-tight text-ink">
                        {p.name || "Untitled project"}
                      </h3>
                      {p.summary && (
                        <p className="mt-1 text-sm text-charcoal">{p.summary}</p>
                      )}
                      <p className="mt-1 text-xs text-meta tabular-nums">
                        {displayName(author)} · {fmtLabDateTime(p.created_at)}
                      </p>
                      <SolutionProposalDetails data={p.proposal_data} />
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h2 className="t-h3 mb-3 text-ink">Outreach — who still needs a nudge</h2>
            <div className="overflow-x-auto rounded-card border border-ink/10 bg-white shadow-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/10 text-left text-meta">
                    <th className="px-4 py-2 font-medium">Member</th>
                    <th className="px-4 py-2 font-medium">Submitted</th>
                    <th className="px-4 py-2 font-medium">Project</th>
                    <th className="px-4 py-2 font-medium">Last Learning Log</th>
                    <th className="px-4 py-2 font-medium">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-meta">
                        No pod members in scope.
                      </td>
                    </tr>
                  ) : (
                    roster.map((r) => (
                      <tr key={r.id} className="border-b border-ink/5 last:border-0">
                        <td className="px-4 py-2 text-ink">{r.name}</td>
                        <td className="px-4 py-2">
                          {r.submitted ? (
                            <span className="text-teal-deep">✓</span>
                          ) : (
                            <span className="font-semibold text-red">Not yet</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-charcoal">
                          {r.project ?? (
                            <span className="font-semibold text-red">
                              Not registered
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 tabular-nums text-charcoal">
                          {r.lastLog ? (
                            fmtDateOnly(r.lastLog)
                          ) : (
                            <span className="text-red">None</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-meta">{r.email ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
