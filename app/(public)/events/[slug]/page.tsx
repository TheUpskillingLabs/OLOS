import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventTeaser, MediaFrame } from "@/app/components/content/teasers";
import { getEvent, getEvents } from "@/lib/content/queries";
import { fmtDate, fmtDay, fmtTime } from "@/lib/content/format";
import { eventIcsHref } from "@/lib/content/event-ics";
import { renderMarkdown, markdownToc } from "@/lib/content/markdown";
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

/* A keyless Google Maps search, the same URL shape Luma's own event page uses.
   An embed would need a paid Maps Embed API key. */
function mapsHref(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/* One sponsor logo in a fixed tile (00095).

   Two reasons it is a tile rather than a bare image. Sponsors send whatever art
   they have — squares, wide lockups, tall crests — and a row of bare images at
   one height lands ragged; a fixed box with object-fit: contain centres any
   ratio and gives the wall a rhythm. It also avoids next/image needing real
   intrinsic dimensions we do not know: `fill` inside a sized box means no ratio
   guessing and no layout shift.

   `bg: "dark"` is for knockout art (white-on-transparent), invisible on the
   warm paper otherwise. A hint, not a detection: only the person who received
   the file knows what they have, and sampling pixels server-side to guess would
   be both slow and fragile. */
function SponsorTile({
  sponsor,
}: {
  sponsor: { src: string; alt: string; bg?: "light" | "dark" };
}) {
  const dark = sponsor.bg === "dark";
  return (
    <div
      className="lcard"
      style={{
        position: "relative",
        width: 180,
        height: 96,
        /* .lcard already gives the white fill and hairline rule; only the
           knockout case needs an override. */
        ...(dark
          ? { background: "var(--ink)", borderColor: "var(--ink)" }
          : {}),
      }}
    >
      {/* Padding lives on the image, not the tile: `fill` resolves inset: 0
          against the padding box, so putting it in both places insets twice. */}
      <Image
        src={sponsor.src}
        alt={sponsor.alt}
        fill
        sizes="180px"
        style={{ objectFit: "contain", padding: 18 }}
      />
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
  /* "Where" is a link wherever there is something to link to: a keyless Google
     Maps search for in-person events (the same maps.google.com/search URL
     Luma's own page uses — an embed would need a paid API key), or the Luma
     meeting URL for virtual ones. `location_address` is the full postal
     address (00095); older rows have none until their next sync, so the short
     display label is the fallback query. */
  const whereQuery = e.location_address ?? e.location_name;
  const sponsors = e.sponsors ?? [];
  const stats = e.stats ?? [];
  /* "Free · per person · first come, first served" reads as nonsense (owner
     flag, 2026-07-31): "per person" is the unit of a price, so it only belongs
     when there is one. `cost` is free text, so allow the ways someone might
     write zero rather than only an empty column. */
  const isFree = !e.cost || /^\s*(free|no charge|\$?0(?:\.00)?)\s*$/i.test(e.cost);
  /* Optional by design: no key means no embed, and the "Open in Maps" link
     still answers the question. Public because the iframe renders client-side;
     Embed API keys are meant to be referrer-restricted, not secret. */
  const mapsEmbedKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;
  const whereLine =
    e.location_type === "virtual" ? (
      e.meeting_url ? (
        <a
          className="see"
          href={e.meeting_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "underline" }}
        >
          Online — join link
        </a>
      ) : (
        "Online — we'll send the link"
      )
    ) : whereQuery ? (
      <a
        className="see"
        href={mapsHref(whereQuery)}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: "underline" }}
      >
        {e.location_name ?? whereQuery}
      </a>
    ) : /* null, not "": an in-person row with no location at all (seeded rows
          predating their first Luma sync) used to render an empty labelled row,
          which reads as a bug. The row is now omitted instead. */
      null;
  const metaRow = [
    e.kind,
    e.location_type === "virtual" ? "Virtual" : "In person",
    e.cost || "Free",
  ]
    .filter(Boolean)
    .join(" · ");
  const body = e.body ?? [];
  // Jump links for the Luma copy, only when it is long enough to need them.
  const toc = e.about && body.length === 0 ? markdownToc(e.about) : [];
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

            {/* Facts + CTA for viewports where the rail is hidden — led by
                the Luma card, which desktop shows at the top of the rail. */}
            <div className="lg:hidden" style={{ marginTop: 24 }}>
              {photo && (
                <div style={{ marginBottom: 16, maxWidth: 360 }}>
                  <MediaFrame img={photo} square />
                </div>
              )}
              <Kv k="When" v={whenLine} />
              {whereLine && <Kv k="Where" v={whereLine} />}
              <Kv k="Cost" v={e.cost || "Free"} />
              {e.bring && <Kv k="Bring" v={e.bring} />}
            </div>

            {/* The full Luma "About Event" text (00094, Luma-owned) — a
                FALLBACK, not a co-tenant: once the Labs write their own "what
                we'll cover" (the editorial body), the curated framing takes
                precedence and Luma's prose steps aside (owner call, July
                2026). That `body` override is also the escape hatch for copy
                Luma cannot express, since the sync overwrites `about` every
                tick.

                renderMarkdown handles the subset Luma's editor can produce,
                including its bold-as-heading convention and a schedule block
                built from time rows — see lib/content/markdown.tsx. */}
            {/* No "About this session" label above this: the Luma copy IS the
                page body now, and labelling it made the real content look like
                a footnote (owner call, 2026-07-31). Just a rule, then the text.

                The jump nav only appears once there are enough headings to be
                worth one — Luma copy for a full-day event runs long, and short
                workshop copy would look silly with a table of contents. */}
            {e.about && body.length === 0 && (
              <div style={{ marginTop: 36 }}>
                <hr className="rule" />
                {toc.length >= 3 && (
                  <nav
                    aria-label="On this page"
                    style={{ margin: "18px 0 22px" }}
                  >
                    <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                      On this page
                    </div>
                    <div className="flex flex-wrap" style={{ gap: "6px 18px" }}>
                      {toc.map((h) => (
                        <a
                          key={h.id}
                          className="see t-small"
                          href={`#${h.id}`}
                          style={{ textDecoration: "underline" }}
                        >
                          {h.text.replace(/:$/, "")}
                        </a>
                      ))}
                    </div>
                  </nav>
                )}
                <div className="ed-text" style={{ marginTop: 18 }}>
                  {renderMarkdown(e.about)}
                </div>
              </div>
            )}

            {/* Location gets a section of its own, not just the rail's Kv row.
                The rail sits in .detail-aside, which is display:none below
                1024px, so on a narrow window the address was only in the
                lg:hidden facts block — and on a wide one it was a small line in
                a sidebar card. "Where is this?" deserves better than that
                (owner call, 2026-07-31). An embedded map is deliberately not
                here: it needs a paid Google Embed API key, and the link does
                the job. */}
            {e.location_type === "in_person" && whereQuery && (
              <Ruled label="Location">
                {e.location_name && (
                  <p className="t-h4" style={{ marginBottom: 4 }}>
                    {e.location_name}
                  </p>
                )}
                {e.location_address &&
                  e.location_address !== e.location_name && (
                    <p className="t-body" style={{ color: "var(--slate)" }}>
                      {e.location_address}
                    </p>
                  )}
                {/* The embed is keyed and therefore optional: without a key it
                    is simply absent, so local dev and previews show the link
                    rather than a broken frame. Google's Embed API takes a plain
                    address in `q`, so no geocoding and no stored coordinates.
                    lazy-loaded because it is a third-party frame below the
                    fold. */}
                {mapsEmbedKey && (
                  <div
                    className="lcard"
                    style={{
                      marginTop: 16,
                      overflow: "hidden",
                      height: 300,
                      padding: 0,
                    }}
                  >
                    <iframe
                      title={`Map of ${e.location_name ?? whereQuery}`}
                      src={`https://www.google.com/maps/embed/v1/place?key=${mapsEmbedKey}&q=${encodeURIComponent(whereQuery)}`}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      style={{ border: 0, width: "100%", height: "100%" }}
                    />
                  </div>
                )}
                <div style={{ marginTop: 14 }}>
                  <a
                    className="btn btn-ghost"
                    href={mapsHref(whereQuery)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open in Maps
                  </a>
                </div>
              </Ruled>
            )}

            {/* Editorial numerals (00095). Absent on short events, where a stat
                row would be four numbers about nothing. */}
            {stats.length > 0 && (
              <Ruled label="By the numbers">
                <div className="stat-row">
                  {stats.map((s, i) => (
                    <div className="stat-cell" key={i}>
                      <div
                        className="stat-num"
                        style={{ color: "var(--teal-deep)" }}
                      >
                        {s.n}
                      </div>
                      <div className="stat-lbl">{s.label}</div>
                    </div>
                  ))}
                </div>
              </Ruled>
            )}

            {/* Sponsors are editorial (00095): Luma shows logos on its own page
                but does not expose them through the API, so they cannot be
                synced and live on the row instead. */}
            {sponsors.length > 0 && (
              <Ruled label="With thanks to our sponsors">
                <div className="flex flex-wrap" style={{ gap: 16 }}>
                  {sponsors.map((s, i) => (
                    <SponsorTile key={i} sponsor={s} />
                  ))}
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

            <Ruled label="Host">
              <div className="t-h4">{e.host || "The Upskilling Labs"}</div>
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
          {/* The Luma card tops the rail (owner call, July 2026 — "the
              thumbnail at the top", the way Luma leads with it) — but small:
              at the rail's full 360px it shoved the register button below
              the fold, and the card is a teaser, not the point. */}
          <aside className="detail-aside">
            {photo && (
              <div style={{ marginBottom: 16, width: 180 }}>
                <MediaFrame img={photo} square />
              </div>
            )}
            <div className="lcard" style={{ padding: 24 }}>
              {/* A price earns the big numeral slot; "Free" does not. Set at
                  t-h3 it shouted, and "Free · per person" read as nonsense
                  (owner flag, 2026-07-31). Free events now get one quiet line,
                  and the card leads with the facts instead. */}
              {isFree ? (
                <p className="t-small" style={{ marginBottom: 14 }}>
                  Free · first come, first served
                </p>
              ) : (
                <>
                  <div className="t-h3" style={{ marginBottom: 4 }}>
                    {e.cost}
                  </div>
                  <p className="t-small" style={{ marginBottom: 12 }}>
                    per person · first come, first served
                  </p>
                </>
              )}
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
              {whereLine && <Kv k="Where" v={whereLine} />}
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
