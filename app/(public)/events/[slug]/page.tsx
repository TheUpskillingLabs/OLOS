import Link from "next/link";
import { notFound } from "next/navigation";
import { EventTeaser, MediaFrame } from "@/app/components/content/teasers";
import { getEvent, getEvents } from "@/lib/content/queries";
import { fmtDate, fmtDay, fmtTime } from "@/lib/content/format";
import { eventIcsHref } from "@/lib/content/event-ics";
import { publicSession } from "@/lib/auth/public-session";
import { createServiceClient } from "@/lib/supabase/server";
import RsvpButton, { MemberRegister } from "./rsvp";

/* The event detail page — the "ruled detail + registration rail" redesign
   (owner mock 3A, July 2026): title, facts and the register CTA all in the
   first screen; the photo demoted below the fold in grayscale (same treatment
   as the landing .hero-photo); body content under ruled, labelled sections.
   Translated into the house system — the mock's red numerals and buttons are
   teal (.ed-num, .btn-teal); type, rules and the 14px radius are the ported
   component layer.

   The rail is the registration surface: cost, the when/where facts, Register,
   and Add to calendar (a floating-wall-time .ics, lib/content/event-ics.ts).
   Below 1024px the rail is display:none (globals.css), so the facts repeat in
   the main column lg:hidden and the sticky .detail-bottom carries the CTA.

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
  // No public metadata for members-only events — crawlers and unfurlers
  // are, by definition, signed out.
  if (!e || e.visibility === "members") return {};
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

function Kv({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="kv">
      <span className="k lbl">{k}</span>
      <span className="t-body">{v}</span>
    </div>
  );
}

/* A ruled, labelled section — the mock's horizontal rule + small-caps header. */
function Ruled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: 36 }}>
      <hr className="rule" />
      <div className="lbl lbl-teal" style={{ margin: "18px 0 14px" }}>
        {label}
      </div>
      {children}
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
  // A members-only event's page exists for members (/learning links here)
  // and is a 404 for everyone else — same face a wrong slug shows, so the
  // URL doesn't confirm the event exists.
  if (!e || (e.visibility === "members" && !session.signedIn)) notFound();

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
  const whenLine = `${fmtDay(e.start_at)} · ${fmtTime(e.start_at)}${endTime}`;
  const whereLine =
    e.location_type === "virtual"
      ? "Online — we'll send the link"
      : (e.location_name ?? "");
  const metaRow = [
    e.kind,
    e.location_type === "virtual" ? "Virtual" : "In person",
    e.cost || "Free",
  ]
    .filter(Boolean)
    .join(" · ");
  const body = e.body ?? [];
  // Real photos only. The seeded gallery arrays hold orb-gradient names
  // ("m-teal", "m-forest"...) as placeholders, and grayscaling a full-width
  // gradient placeholder produced a page-height black box (July 2026). A
  // Luma-synced row's cover lands in `img` and shows here automatically.
  const photo =
    [e.img, ...(e.gallery ?? [])].find((p) => p && !/^m-/.test(p)) ?? null;
  const statusCopy = session.signedIn
    ? going
      ? "You're on the list. Luma has your confirmation and calendar invite."
      : "One tap — you're registered with your Labs account. The confirmation and calendar invite come from Luma."
    : isLumaManaged
      ? "Registration takes a minute on Luma — a few quick questions, then the confirmation and calendar invite land in your inbox."
      : e.location_type === "virtual"
        ? "Online — we'll send the link."
        : "Free & public — we'll send the room details.";

  return (
    <>
      <div className="container">
        <p className="t-small" style={{ marginTop: 20 }}>
          <Link className="see" href="/events">
            ← All events
          </Link>
        </p>

        <div className="detail" style={{ marginTop: 20 }}>
          {/* ── Main column: title + lede first, ruled sections beneath ── */}
          <div className="detail-main">
            <div className="lbl lbl-teal">{metaRow}</div>
            <h1 className="t-h1" style={{ marginTop: 10 }}>
              {e.name}
            </h1>
            {e.description && (
              <p className="t-lede ed-text" style={{ marginTop: 14 }}>
                {e.description}
              </p>
            )}

            {/* Facts + CTA for viewports where the rail is hidden. */}
            <div className="lg:hidden" style={{ marginTop: 24 }}>
              <Kv k="When" v={whenLine} />
              <Kv k="Where" v={whereLine} />
              <Kv k="Cost" v={e.cost || "Free"} />
              {e.bring && <Kv k="Bring" v={e.bring} />}
            </div>

            {/* The full Luma "About Event" text (00094, Luma-owned) as plain
                prose paragraphs — a FALLBACK, not a co-tenant: once the Labs
                write their own "what we'll cover" (the editorial body), the
                curated framing takes precedence and Luma's prose steps aside
                (owner call, July 2026). Plain on purpose: Luma's markdown
                emphasis and links are dropped rather than half-rendered —
                the rail's "View on Luma" link carries anyone who wants the
                styled page. */}
            {e.about && body.length === 0 && (
              <Ruled label="About this session">
                <div className="ed-text">
                  {e.about.split(/\n\s*\n/).map(
                    (p, i) =>
                      p.trim() && (
                        <p
                          key={i}
                          className="t-body"
                          style={{ color: "var(--slate)", marginBottom: 14 }}
                        >
                          {p.trim()}
                        </p>
                      )
                  )}
                </div>
              </Ruled>
            )}

            {body.length > 0 && (
              <Ruled label="What we'll cover">
                <div className="grid gap-6 md:grid-cols-3">
                  {body.map((p, i) => (
                    <div key={i}>
                      <span className="ed-num">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <p className="t-body" style={{ color: "var(--slate)" }}>
                        {p}
                      </p>
                    </div>
                  ))}
                </div>
              </Ruled>
            )}

            {/* The photo is demoted (mock 3A) but not banished: small, in
                color, beside the host it depicts. The mock grayscaled it, but
                the covers are designed brand cards, not photography — drained
                of color they read as broken (owner call, July 2026). */}
            <Ruled label="Host">
              <div className="flex items-start gap-5">
                {photo && (
                  <div style={{ width: 168, flexShrink: 0 }}>
                    <MediaFrame img={photo} square />
                  </div>
                )}
                <div className="t-h4">{e.host || "The Upskilling Labs"}</div>
              </div>
            </Ruled>

            {e.bring && (
              <Ruled label="Bring">
                <p className="t-body">{e.bring}</p>
              </Ruled>
            )}

            <div className="detail-bottom">
              {registerCta("btn btn-teal btn-block")}
            </div>
          </div>

          {/* ── The registration rail ── */}
          <aside className="detail-aside">
            <div className="lcard" style={{ padding: 24 }}>
              <div className="t-h3" style={{ marginBottom: 4 }}>
                {e.cost || "Free"}
              </div>
              <p className="t-small" style={{ marginBottom: 12 }}>
                per person · first come, first served
              </p>
              <Kv
                k="When"
                v={
                  <>
                    {fmtDay(e.start_at)}
                    <br />
                    {`${fmtTime(e.start_at)}${endTime}`}
                  </>
                }
              />
              <Kv k="Where" v={whereLine} />
              <div style={{ marginTop: 18 }}>
                {registerCta("btn btn-teal btn-block")}
              </div>
              <div style={{ marginTop: 10 }}>
                <a
                  className="btn btn-ghost btn-block"
                  href={eventIcsHref(e)}
                  download={`${e.slug}.ics`}
                >
                  Add to calendar
                </a>
              </div>
              <p className="t-small" style={{ marginTop: 12 }}>
                {statusCopy}
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
            {e.anchor && (
              <p className="t-small" style={{ marginTop: 12 }}>
                An anchor event of the current{" "}
                <Link
                  className="see"
                  href="/build-cycles"
                  target="_blank"
                  rel="noopener"
                >
                  Build Cycle
                </Link>
                .
              </p>
            )}
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
