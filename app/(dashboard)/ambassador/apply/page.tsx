import { cookies } from "next/headers";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { apply, publicQuiz, AMBASSADOR_HOME } from "@/lib/ambassador/content";
import { loadAmbassadorPage } from "@/lib/ambassador/page";
import { nextAmbassadorSession } from "@/lib/ambassador/session";
import { checkInvite } from "@/lib/ambassador/data";
import { resumeStage } from "@/lib/ambassador/status";
import { AMB_JOIN_COOKIE, cleanAmbJoin, parseAmbJoin } from "@/lib/ambassador/join-cookie";
import ApplyFlow, { type ApplyInvite } from "./apply-flow";

/* Getting in — orientation, one screen at a time, in the order that gives
   before it takes: The Labs in three minutes → ten questions → the Ambassador
   Agreement → your details → the pass. Sign-in replaces the prototype's
   "Your name" fields (Google already has them); the server grades the quiz,
   records the agreement, and decides: a valid invite means "You're in",
   otherwise "Almost there" until the Lab's coordinator confirms. */

export const dynamic = "force-dynamic";
export const metadata = { title: `${apply.title} · The Upskilling Labs`, description: apply.description };

export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ invite?: string; ref?: string }> }) {
  const sp = await searchParams;
  const { self, stage } = await loadAmbassadorPage();
  const parked = parseAmbJoin((await cookies()).get(AMB_JOIN_COOKIE)?.value);
  const fromUrl = cleanAmbJoin({ invite: sp.invite, ref: sp.ref });
  const token = fromUrl.invite ?? parked.invite ?? null;
  const ref = fromUrl.ref ?? parked.ref ?? null;

  let invite: ApplyInvite | null = null;
  if (token && stage !== "ambassador") {
    const { invite: row, problem } = await checkInvite(createServiceClient(), token, self.participant);
    invite = problem ? { token, by: null, note: null, problem } : { token, by: row!.inviter_name, note: row!.note, problem: null };
  }

  if (stage === "declined" || stage === "stepped_back") {
    return (
      <div className="amb">
        <h1 className="t-h1 text-ink">{apply.title}</h1>
        <p className="t-lede" style={{ marginTop: 8 }}>
          Your application is with your coordinator. Talk to them about what&apos;s next.
        </p>
        <Link className="btn btn-teal" style={{ marginTop: 18 }} href={AMBASSADOR_HOME}>Back to Ambassador home</Link>
      </div>
    );
  }

  const session = await nextAmbassadorSession();
  const app = self.application;

  return (
    <ApplyFlow
      initialStage={stage === "ambassador" ? "done" : resumeStage(app)}
      initialOutcome={stage === "ambassador" ? "in" : app?.status === "pending" ? "pending" : null}
      quiz={publicQuiz()}
      me={{
        first: self.participant.first_name,
        last: self.participant.last_name,
        email: self.participant.email,
        zip: self.participant.zip ?? "",
      }}
      referredBy={app?.referred_by ?? ""}
      invite={invite}
      refHandle={ref}
      session={session}
    />
  );
}
