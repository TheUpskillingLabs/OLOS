import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Crumbs,
  EventTeaser,
  LabTeaser,
  MediaFrame,
} from "@/app/components/content/teasers";
import { getEvents, getMetro, getMetros } from "@/lib/content/queries";
import { publicSession } from "@/lib/auth/public-session";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import JoinButton from "./join-button";

/* The lab (metro) detail page — the prototype generator's labPage(), both
   branches: the active lab's dark gravity cover (labs/dc) and the waitlist
   pitch with the live join CTA. */

function labTitle(m: { name: string; st: string | null; slug: string }): string {
  return m.name + (m.st && m.slug !== "dc" ? `, ${m.st}` : "");
}

/** Whether the signed-in visitor is already on this metro's waitlist
    (auth user → participants → metro_waitlist_signups). Never gates —
    any failure reads as "not joined". */
async function alreadyJoined(metroId: number): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const service = createServiceClient();
    const { data: participant } = await service
      .from("participants")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!participant) return false;
    const { data: signup } = await service
      .from("metro_waitlist_signups")
      .select("id")
      .eq("metro_id", metroId)
      .eq("participant_id", participant.id)
      .maybeSingle();
    return !!signup;
  } catch {
    return false;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const m = await getMetro(slug);
  if (!m) return { title: "Local labs · The Upskilling Labs" };
  const title = `${labTitle(m)} — Local lab · The Upskilling Labs`;
  const description =
    m.status === "active"
      ? m.blurb || ""
      : `${m.waiting} people want a ${m.name} lab. Add your name — we’ll email you the day it ignites.`;
  return {
    title,
    description,
    openGraph: { title: `${labTitle(m)} — Local lab`, description },
  };
}

export default async function LabPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const m = await getMetro(slug);
  if (!m) notFound();

  const crumbs = (
    <div className="container">
      <Crumbs
        trail={[["Home", "/"], ["Local labs", "/local-labs"], [labTitle(m), null]]}
      />
    </div>
  );

  if (m.status === "active") {
    const events = (await getEvents()).slice(0, 3);
    return (
      <>
        {crumbs}
        <section
          className="grain"
          style={{
            background: "var(--ink)",
            color: "#fff",
            borderRadius: "var(--r)",
            margin: "16px var(--pad) 0",
          }}
        >
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px" }}>
            <span className="status active" style={{ color: "#fff" }}>
              Active lab
            </span>
            <h1 className="t-h1" style={{ margin: "14px 0 10px", color: "#fff" }}>
              {m.name}
            </h1>
            <p
              className="t-lede"
              style={{ color: "var(--od2)", marginBottom: 24 }}
            >
              {m.blurb || ""}
            </p>
            <div
              style={{
                display: "flex",
                gap: 32,
                flexWrap: "wrap",
                marginBottom: 28,
              }}
            >
              <div>
                <div className="t-h2" style={{ color: "#fff" }}>
                  {m.members}
                </div>
                <div className="t-small" style={{ color: "var(--od2)" }}>
                  members
                </div>
              </div>
              <div>
                <div className="t-h2" style={{ color: "#fff" }}>
                  {m.partner || ""}
                </div>
                <div className="t-small" style={{ color: "var(--od2)" }}>
                  library partner
                </div>
              </div>
              <div>
                <div className="t-h2" style={{ color: "#fff" }}>
                  Summer 2026
                </div>
                <div className="t-small" style={{ color: "var(--od2)" }}>
                  Civic &amp; Elections Cycle in progress
                </div>
              </div>
            </div>
            <Link className="btn btn-white" href="/login">
              Join this lab
            </Link>
          </div>
        </section>
        <section className="section">
          <div className="container">
            <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
              The rhythm
            </div>
            <div className="kv">
              <span className="k lbl">Weekly</span>
              <span className="t-body">
                Workshops and build nights at the library
              </span>
            </div>
            <div className="kv">
              <span className="k lbl">Monthly</span>
              <span className="t-body">
                Community showcase — real work, honest lessons
              </span>
            </div>
            <div className="kv">
              <span className="k lbl">Quarterly</span>
              <span className="t-body">
                A Build Cycle: real problems, real teams, everything returned to
                the commons
              </span>
            </div>
          </div>
        </section>
        {events.length > 0 && (
          <section className="section">
            <div className="container">
              <div className="section-head">
                <div>
                  <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                    More like this
                  </div>
                  <h2 className="t-h3">Upcoming at this lab</h2>
                </div>
              </div>
              <div className="cards dense">
                {events.map((e) => (
                  <EventTeaser key={e.slug} event={e} />
                ))}
              </div>
            </div>
          </section>
        )}
      </>
    );
  }

  // ── The waitlist branch ──
  const [{ signedIn }, joined, metros, allEvents] = await Promise.all([
    publicSession(),
    alreadyJoined(m.id),
    getMetros(),
    getEvents(),
  ]);
  const waitingLine = `${m.waiting} ${m.waiting === 1 ? "person is" : "people are"} waiting`;
  const otherWaits = metros
    .filter((x) => x.status === "waitlist" && x.slug !== m.slug)
    .sort((a, b) => b.waiting - a.waiting)
    .slice(0, 3);
  const virtualEvents = allEvents
    .filter((e) => e.location_type === "virtual")
    .slice(0, 3);

  const joinCta = (
    <JoinButton
      metroId={m.id}
      metroName={m.name}
      signedIn={signedIn}
      joined={joined}
    />
  );

  return (
    <>
      {crumbs}
      <div className="container">
        <div className="detail" style={{ marginTop: 16 }}>
          <div className="detail-main">
            <MediaFrame tag="Waitlist" />
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                marginTop: 20,
              }}
            >
              <span className="status forming">Waitlist open</span>
              <span className="lbl">{waitingLine}</span>
            </div>
            <h1 className="t-h1">We’re not in {m.name} yet.</h1>
            <p className="t-lede" style={{ marginBottom: 20 }}>
              {m.blurb ||
                "Every lab started as a list of names. Enough names, and we come."}
            </p>
            <div className="lbl lbl-teal" style={{ margin: "24px 0 4px" }}>
              What a lab is
            </div>
            <div className="kv">
              <span className="k lbl">A place</span>
              <span className="t-body">
                A library-hosted space
                {m.partner ? ` — ${m.partner} is already at the table` : ""}
              </span>
            </div>
            <div className="kv">
              <span className="k lbl">A rhythm</span>
              <span className="t-body">
                Weekly workshops, build nights, a monthly showcase
              </span>
            </div>
            <div className="kv">
              <span className="k lbl">A cycle</span>
              <span className="t-body">
                When the list is long enough, a Build Cycle ignites — real
                problems, real teams, run in the open
              </span>
            </div>
            <p className="t-body" style={{ marginTop: 20 }}>
              Every lab started as a list of names. Enough names, and we come.
              The list is how we pick the next city — and your name moves it.
            </p>
            <div className="detail-bottom">{joinCta}</div>
          </div>
          <aside className="detail-aside">
            <div className="lcard" style={{ padding: 24 }}>
              <div className="t-h3" style={{ marginBottom: 4 }}>
                {m.waiting} waiting
              </div>
              <p className="t-small" style={{ marginBottom: 16 }}>
                One tap. One email when it happens. That’s it.
              </p>
              {joinCta}
              <p className="t-small" style={{ marginTop: 12 }}>
                Takes a free account — sign in with Google and your name goes
                on the list.
              </p>
            </div>
          </aside>
        </div>
      </div>
      {otherWaits.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                  More like this
                </div>
                <h2 className="t-h3">Other cities lining up</h2>
              </div>
            </div>
            <div className="cards dense">
              {otherWaits.map((x) => (
                <LabTeaser key={x.slug} metro={x} />
              ))}
            </div>
          </div>
        </section>
      )}
      {virtualEvents.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                  More like this
                </div>
                <h2 className="t-h3">Meanwhile, in the Labs network</h2>
              </div>
            </div>
            <div className="cards dense">
              {virtualEvents.map((e) => (
                <EventTeaser key={e.slug} event={e} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
