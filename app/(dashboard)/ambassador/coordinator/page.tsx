import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveUserRoles } from "@/lib/auth/roles";
import { coordinatorLabs, isCoordinator, APPLICATION_SELECT, INVITE_SELECT, type AmbassadorInvite } from "@/lib/ambassador/data";
import { STEPS, invite as inviteCopy, AMBASSADOR_HOME } from "@/lib/ambassador/content";
import type { AmbassadorApplication } from "@/lib/ambassador/status";
import { formatDate } from "@/lib/format/date";
import { DecisionButtons, InviteForm, InviteRow, NominationActions } from "./coordinator-client";

/* The coordinator's side of the role — a Lab's leads (and HQ admins) see the
   ambassadors of their Lab: who's waiting to be confirmed, who's ready for
   their button, the invites they've made, and nominations from ambassadors.
   Replaces the prototype's unlisted /invite/ page and the text messages that
   carried applications and nominations.

   Gate: the REAL signed-in user (never the simulated one), like every
   staff surface (lib/auth/guards.ts). Reads use the service-role client, so
   the Lab filter below is their only scope. */

export const dynamic = "force-dynamic";
export const metadata = { title: "Ambassadors · Coordinator · The Upskilling Labs" };

type Person = { id: number; first_name: string; last_name: string; preferred_name: string | null; email: string };
type AppRow = AmbassadorApplication & { participant: Person | null; lab: { name: string } | null };
type NomRow = {
  id: number;
  lab_id: number | null;
  nominee_name: string;
  how_known: string | null;
  reason: string;
  nominee_contact: string | null;
  status: "open" | "invited" | "declined";
  created_at: string;
  nominator: Person | null;
};

const name = (p: Person | null) => (p ? `${p.preferred_name || p.first_name} ${p.last_name}`.trim() : "Someone");

export default async function CoordinatorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const service = createServiceClient();
  const roles = await resolveUserRoles(service, user.id);
  if (!isCoordinator(roles)) redirect(AMBASSADOR_HOME);

  const labs = coordinatorLabs(roles);
  // Lab scope: admins see every Lab and HQ; a lead sees their Labs only.
  const inScope = labs ?? [];
  let appsQ = service
    .from("ambassador_applications")
    .select(`${APPLICATION_SELECT}, participant:participants!ambassador_applications_participant_id_fkey(id, first_name, last_name, preferred_name, email), lab:metros(name)`)
    .neq("status", "started")
    .order("submitted_at", { ascending: false });
  let invitesQ = service.from("ambassador_invites").select(INVITE_SELECT).order("created_at", { ascending: false }).limit(100);
  let nomsQ = service
    .from("ambassador_nominations")
    .select("id, lab_id, nominee_name, how_known, reason, nominee_contact, status, created_at, nominator:participants!ambassador_nominations_nominator_id_fkey(id, first_name, last_name, preferred_name, email)")
    .order("created_at", { ascending: false });
  if (labs) {
    appsQ = appsQ.in("lab_id", inScope);
    invitesQ = invitesQ.in("lab_id", inScope);
    nomsQ = nomsQ.in("lab_id", inScope);
  }
  const labsQ = labs
    ? service.from("metros").select("id, name").in("id", inScope)
    : service.from("metros").select("id, name").eq("status", "active").order("name");

  const [{ data: apps }, { data: invites }, { data: noms }, { data: labRows }] = await Promise.all([appsQ, invitesQ, nomsQ, labsQ]);

  // Server clock for the invites' open/expired split (hydration-stable).
  const nowMs = new Date().getTime();
  const rows = (apps ?? []) as unknown as AppRow[];
  const approvedIds = rows.filter((a) => a.status === "approved").map((a) => a.participant_id);
  const { data: steps } = approvedIds.length
    ? await service.from("ambassador_step_progress").select("participant_id, step_id").in("participant_id", approvedIds)
    : { data: [] as { participant_id: number; step_id: string }[] };
  const stepCount = new Map<number, number>();
  for (const s of steps ?? []) stepCount.set(s.participant_id, (stepCount.get(s.participant_id) ?? 0) + 1);

  const pending = rows.filter((a) => a.status === "pending");
  const ambassadors = rows.filter((a) => a.status === "approved");
  const past = rows.filter((a) => a.status === "declined" || a.status === "stepped_back");
  const nominations = (noms ?? []) as unknown as NomRow[];
  const labOptions = (labRows ?? []) as { id: number; name: string }[];

  return (
    <div className="amb-wide">
      <Link className="amb-back" href={AMBASSADOR_HOME}>← Ambassador home</Link>
      <header className="amb-head">
        <p className="lbl lbl-teal">Coordinator</p>
        <h1 className="t-h1 text-ink" style={{ marginTop: 6 }}>Ambassadors</h1>
        <p className="t-lede">
          Confirm new ambassadors, hand over buttons, and invite the people your ambassadors suggest.
          {labs ? "" : " You see every Lab and HQ as an admin."}
        </p>
      </header>

      <section className="amb-section">
        <h2 className="t-h2">Waiting for you</h2>
        <p className="t-small">They passed the ten questions and signed the agreement. Confirm them, or say not now.</p>
        <div className="amb-table-wrap">
          {pending.length === 0 ? (
            <p className="amb-empty">Nobody is waiting.</p>
          ) : (
            <table className="amb-table">
              <thead>
                <tr><th>Who</th><th>Lab</th><th>Brought in by</th><th>Quiz</th><th>Submitted</th><th /></tr>
              </thead>
              <tbody>
                {pending.map((a) => (
                  <tr key={a.id}>
                    <td><b>{name(a.participant)}</b><br /><span className="t-small">{a.participant?.email}</span></td>
                    <td>{a.lab?.name ?? "HQ"}</td>
                    <td>{a.referred_by ?? "—"}</td>
                    <td>{a.quiz_score ?? "—"} of {a.quiz_total ?? "—"}</td>
                    <td>{a.submitted_at ? formatDate(a.submitted_at) : "—"}</td>
                    <td><DecisionButtons id={a.id} actions={["approve", "decline"]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="amb-section">
        <h2 className="t-h2">Ambassadors</h2>
        <p className="t-small">Who&apos;s getting ready, who&apos;s ready for their button, and who has it.</p>
        <div className="amb-table-wrap">
          {ambassadors.length === 0 ? (
            <p className="amb-empty">No ambassadors yet.</p>
          ) : (
            <table className="amb-table">
              <thead>
                <tr><th>Who</th><th>Lab</th><th>Guide</th><th>Button</th><th /></tr>
              </thead>
              <tbody>
                {ambassadors.map((a) => (
                  <tr key={a.id}>
                    <td><b>{name(a.participant)}</b><br /><span className="t-small">{a.participant?.email}</span></td>
                    <td>{a.lab?.name ?? "HQ"}</td>
                    <td>
                      {stepCount.get(a.participant_id) ?? 0} of {STEPS.length} steps
                      {a.ready_at && <><br /><span className="status active">Ready</span></>}
                    </td>
                    <td>{a.button_given_at ? `Given ${formatDate(a.button_given_at)}` : "Not yet"}</td>
                    <td>
                      <DecisionButtons id={a.id} actions={a.button_given_at ? ["step_back"] : ["button_given", "step_back"]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="amb-section">
        <h2 className="t-h2">Nominations</h2>
        <p className="t-small">People your ambassadors suggested. Invite them, or set them aside.</p>
        <div className="amb-table-wrap">
          {nominations.length === 0 ? (
            <p className="amb-empty">No nominations yet.</p>
          ) : (
            <table className="amb-table">
              <thead>
                <tr><th>Nominee</th><th>From</th><th>Why</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {nominations.map((n) => (
                  <tr key={n.id}>
                    <td>
                      <b>{n.nominee_name}</b>
                      {n.how_known && <><br /><span className="t-small">{n.how_known}</span></>}
                      {n.nominee_contact && <><br /><span className="t-small">{n.nominee_contact}</span></>}
                    </td>
                    <td>{name(n.nominator)}</td>
                    <td>{n.reason}</td>
                    <td>{n.status}</td>
                    <td><NominationActions id={n.id} status={n.status} nomineeName={n.nominee_name} labId={n.lab_id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="amb-section">
        <h2 className="t-h2">{inviteCopy.invite.title}</h2>
        <p className="t-small">{inviteCopy.invite.lede}</p>
        <InviteForm labs={labOptions} requireLab={Boolean(labs)} />
        <h3 className="t-h3" style={{ marginTop: 28 }}>{inviteCopy.invite.sentTitle}</h3>
        <div className="amb-table-wrap" style={{ marginTop: 10 }}>
          {(invites ?? []).length === 0 ? (
            <p className="amb-empty">No invites yet.</p>
          ) : (
            <table className="amb-table">
              <thead>
                <tr><th>For</th><th>From</th><th>Made</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {((invites ?? []) as AmbassadorInvite[]).map((i) => (
                  <InviteRow key={i.id} invite={i} nowMs={nowMs} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {past.length > 0 && (
        <section className="amb-section">
          <h2 className="t-h2">Not now, or stepped back</h2>
          <div className="amb-table-wrap">
            <table className="amb-table">
              <thead>
                <tr><th>Who</th><th>Lab</th><th>Status</th><th>Note</th><th /></tr>
              </thead>
              <tbody>
                {past.map((a) => (
                  <tr key={a.id}>
                    <td><b>{name(a.participant)}</b></td>
                    <td>{a.lab?.name ?? "HQ"}</td>
                    <td>{a.status === "declined" ? "Not now" : "Stepped back"}</td>
                    <td>{a.decision_note ?? "—"}</td>
                    <td><DecisionButtons id={a.id} actions={a.status === "declined" ? ["approve", "reopen"] : ["approve"]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
