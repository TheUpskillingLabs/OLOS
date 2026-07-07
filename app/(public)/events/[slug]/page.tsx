import { notFound } from "next/navigation";
import { EventTeaser } from "@/app/components/content/teasers";
import { getEvent, getEvents } from "@/lib/content/queries";
import { fmtDate, fmtDay, fmtTime } from "@/lib/content/format";
import { publicSession } from "@/lib/auth/public-session";
import { createServiceClient } from "@/lib/supabase/server";
import Gallery from "./gallery";
import RsvpButton, { MemberRegister } from "./rsvp";

/* The event detail page — the generator's eventPage(): gallery, date/type
   row, name, lede, body paragraphs, kv rows, the sticky RSVP aside, and the
   "More sessions like this" recirculation. Copy ported byte-for-byte.

   Registration parity (owner decision): members one-tap register with
   their account (forwarded to Luma's guest list); anonymous visitors on
   Luma-managed events register on Luma's own page, where its questions
   (photo release included) live; the email modal remains only for
   editorial events Luma doesn't know about. */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const e = await getEvent(slug);
  if (!e) return {};
  return {
    title: `${e.name} · The Upskilling Labs`,
    description: e.description ?? undefined,
    openGraph: {
      title: e.name,
      description: e.description ?? undefined,
      type: "article",
    },
  };
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="kv">
      <span className="k lbl">{k}</span>
      <span className="t-body">{v}</span>
    </div>
  );
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [e, events, session] = await Promise.all([
    getEvent(slug),
    getEvents(),
    publicSession(),
  ]);
  if (!e) notFound();

  // "You're going ✓" reflects both in-app RSVPs and, via the guest mirror,
  // registrations made directly on Luma.
  let going = false;
  if (session.signedIn && session.email) {
    const supabase = createServiceClient();
    const { data: rsvp } = await supabase
      .from("event_rsvps")
      .select("id")
      .eq("event_id", e.id)
      .eq("email", session.email)
      .maybeSingle();
    going = Boolean(rsvp);
  }

  const isLumaManaged = Boolean(e.synced_at && e.luma_url);
  const registerCta = (className: string) =>
    session.signedIn ? (
      <MemberRegister eventId={e.id} going={going} className={className} />
    ) : isLumaManaged ? (
      <a
        className={className}
        href={e.luma_url as string}
        target="_blank"
        rel="noopener"
      >
        Register — save a spot
      </a>
    ) : (
      <RsvpButton
        eventId={e.id}
        name={e.name}
        dateLabel={fmtDate(e.start_at)}
        label="Register — save a spot"
        className={className}
      />
    );

  // The generator's related pick: up to 3 events at or after this one;
  // when this is the last event, the final 3 others.
  const others = events
    .filter(
      (x) => x.slug !== e.slug && new Date(x.start_at) >= new Date(e.start_at)
    )
    .slice(0, 3);
  const related = others.length
    ? others
    : events.filter((x) => x.slug !== e.slug).slice(-3);

  const endTime = e.end_at ? `–${fmtTime(e.end_at)}` : "";

  return (
    <>
      <div className="container">
        <div className="detail" style={{ marginTop: 16 }}>
          <div className="detail-main">
            <Gallery img={e.img} gallery={e.gallery} />
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                marginTop: 20,
              }}
            >
              <span className="lbl lbl-teal">{fmtDate(e.start_at)}</span>
              <span className="lbl">
                {e.location_type === "virtual" ? "Virtual" : "In person"}
                {e.kind ? ` · ${e.kind}` : ""}
              </span>
            </div>
            <h1 className="t-h1">{e.name}</h1>
            <p className="t-lede" style={{ marginBottom: 20 }}>
              {e.description}
            </p>
            {(e.body ?? []).map((p, i) => (
              <p key={i} className="t-body" style={{ marginBottom: 14 }}>
                {p}
              </p>
            ))}
            <div style={{ marginTop: 24 }}>
              <Kv k="Where" v={e.location_name ?? ""} />
              <Kv
                k="When"
                v={`${fmtDay(e.start_at)} · ${fmtTime(e.start_at)}${endTime}`}
              />
              <Kv k="Cost" v={e.cost || "Free"} />
              <Kv k="Host" v={e.host || "The Upskilling Labs"} />
              {e.bring && <Kv k="Bring" v={e.bring} />}
            </div>
            <div className="detail-bottom">
              {registerCta("btn btn-red btn-block")}
            </div>
          </div>
          <aside className="detail-aside">
            <div className="lcard" style={{ padding: 24 }}>
              <div className="t-h3" style={{ marginBottom: 4 }}>
                {e.cost || "Free"}
              </div>
              <p className="t-small" style={{ marginBottom: 16 }}>
                per person · first come, first served
              </p>
              <p className="t-body" style={{ marginBottom: 16 }}>
                {fmtDay(e.start_at)}
                <br />
                {`${fmtTime(e.start_at)}${endTime} · ${e.location_name ?? ""}`}
              </p>
              {registerCta("btn btn-red btn-block")}
              <p className="t-small" style={{ marginTop: 12 }}>
                {session.signedIn
                  ? going
                    ? "You're on the list. Luma has your confirmation and calendar invite."
                    : "One tap — you're registered with your Labs account. The confirmation and calendar invite come from Luma."
                  : isLumaManaged
                    ? "Registration takes a minute on Luma — a few quick questions, then the confirmation and calendar invite land in your inbox."
                    : e.location_type === "virtual"
                      ? "Online — we'll send the link."
                      : "Free & public — we'll send the room details."}
              </p>
              {e.luma_url && (
                <p className="t-small" style={{ marginTop: 8 }}>
                  <a
                    className="see"
                    href={e.luma_url}
                    target="_blank"
                    rel="noopener"
                  >
                    View on Luma →
                  </a>
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
      {related.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                  More like this
                </div>
                <h2 className="t-h3">More sessions like this</h2>
              </div>
            </div>
            <div className="cards dense">
              {related.map((x) => (
                <EventTeaser key={x.slug} event={x} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
