import Link from "next/link";
import { invite, AMBASSADOR_HOME } from "@/lib/ambassador/content";
import { loadAmbassadorPage } from "@/lib/ambassador/page";
import NominateForm from "./nominate-form";

/* An ambassador suggests someone to their coordinator, who decides and, if
   yes, sends a pre-approved invite. In the prototype this was a pre-filled
   text from the ambassador's phone; here it lands in the coordinator's list. */

export const dynamic = "force-dynamic";
export const metadata = { title: `${invite.nominate.title} · The Upskilling Labs` };

export default async function NominatePage() {
  const { stage } = await loadAmbassadorPage();
  return (
    <div className="amb">
      <Link className="amb-back" href={AMBASSADOR_HOME}>← Ambassador home</Link>
      <h1 className="t-h1 text-ink">{invite.nominate.title}</h1>
      <p className="t-lede" style={{ marginTop: 8 }}>{invite.nominate.lede}</p>
      {stage === "ambassador" ? (
        <NominateForm />
      ) : (
        <div className="amb-panel" style={{ marginTop: 20 }}>
          <p className="t-body">Nominating is for ambassadors. Once your coordinator confirms you, you can nominate people here.</p>
        </div>
      )}
    </div>
  );
}
