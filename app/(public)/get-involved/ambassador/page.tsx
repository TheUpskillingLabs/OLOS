import Image from "next/image";
import { CircleUserRound, Clock, Heart, MessageSquare, Users, type LucideIcon } from "lucide-react";
import { AMBASSADOR_START, program as p } from "@/lib/ambassador/content";
import "./ambassador-program.css";

/* The public Ambassador program page, ported from the prototype's /ambassador/
   role page. An unlisted draft (noindex, linked from nowhere) until the board
   approves the role. Static and server-rendered; the hero button is the still
   render, not the prototype's live WebGL. Every "Become an ambassador" goes to
   AMBASSADOR_START (the account entry point), overriding program.json's href. */

export const metadata = {
  title: `${p.role} · The Upskilling Labs`,
  description: p.description,
  robots: { index: false, follow: false },
};

const NOS = ["01", "02", "03", "04", "05", "06"];
/* The brass pins are centred in their renders; each hangs flush left by its own
   inset (its left edge as a share of the image's width). */
const PIN_INSET: Record<string, number> = { coffee: 0.096, mic: 0.194, handshake: 0.079 };
const ICONS: Record<string, LucideIcon> = { time: Clock, talk: MessageSquare, people: Users, free: Heart };
const isPh = (s: string) => s.includes("[PLACEHOLDER]") || s.includes("[N]");
const ph = (s: string) => (isPh(s) ? "ap-ph" : undefined);

export default function AmbassadorProgramPage() {
  const cta = AMBASSADOR_START;
  return (
    <main className="ap" id="main">
      {/* Hero: the role, one line, its button with rings spreading from it. */}
      <section className="ap-hero">
        <p className="ap-eyebrow">{p.hero.eyebrow}</p>
        <h1 className="ap-title">{p.hero.title.join(" ")}</h1>
        <div className="ap-stage">
          <div className="ap-rings" aria-hidden="true"><i /><i /><i /><i /></div>
          {/* Plain img: next/image doesn't take srcSet, and these are pre-sized stills. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="ap-pin"
            src="/ambassador/hero-button-760.webp"
            srcSet="/ambassador/hero-button-760.webp 760w, /ambassador/hero-button-1200.webp 1200w"
            sizes="(min-width: 1024px) min(75vh, 848px), min(128vw, 69svh)"
            alt={p.hero.alt}
            width={760}
            height={760}
            fetchPriority="high"
          />
        </div>
      </section>

      {/* Intro: the role in a few sentences and the one button. */}
      <section className="ap-intro">
        <p className="ap-lede">{p.intro.lede}</p>
        <p className="ap-terms">
          <b>{p.intro.strong}</b> <span className={ph(p.intro.terms)}>{p.intro.terms}</span>
        </p>
        <div className="ap-cta">
          <a className="ap-btn" href={cta}>{p.intro.cta}</a>
          <p className="ap-account">It starts with a free Labs account.</p>
          <p className={`ap-status ${ph(p.intro.status) ?? ""}`}><i aria-hidden="true" />{p.intro.status}</p>
        </div>
        {p.placeholder && (
          <p className="ap-draft"><b>Draft.</b> <span className="ap-ph">[PLACEHOLDER]</span> draft copy: details marked in this style are still to be set.</p>
        )}
      </section>

      {/* Three moments, told in order. */}
      <section className="ap-sec ap-moments">
        <div className="ap-wrap">
          <div className="ap-head">
            <p className="ap-kicker">{p.moments.kicker}</p>
            <h2 className="ap-h2">{p.moments.title}</h2>
          </div>
          <ol className="ap-rows">
            {p.moments.items.map((m, i) => (
              <li className="ap-row" key={m.title}>
                <p className="ap-step"><span className="ap-no">{NOS[i]}</span>{m.step}</p>
                {m.icon && (
                  <Image
                    className="ap-row-pin"
                    src={`/ambassador/moment-${m.icon}.webp`}
                    alt=""
                    width={480}
                    height={480}
                    style={{ "--inset": PIN_INSET[m.icon] ?? 0.1 } as React.CSSProperties}
                    unoptimized
                  />
                )}
                <h3>{m.title}</h3>
                <p className={`ap-body ${ph(m.body) ?? ""}`}>{m.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* In short: four facts. */}
      <section className="ap-sec ap-simple">
        <div className="ap-wrap">
          <div className="ap-head ap-center">
            <p className="ap-kicker">{p.simple.kicker}</p>
            <h2 className="ap-h2">{p.simple.title}</h2>
          </div>
          <ul className="ap-facts">
            {p.simple.items.map((f) => {
              const Icon = ICONS[f.icon] ?? Users;
              return (
                <li key={f.title}>
                  <Icon size={32} strokeWidth={1.4} aria-hidden="true" />
                  <h3>{f.title}</h3>
                  <p className={ph(f.body)}>{f.body}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* How it works: the account starts at step one, the button is given at step two. */}
      <section className="ap-sec ap-path">
        <div className="ap-wrap">
          <div className="ap-head">
            <p className="ap-kicker">{p.path.kicker}</p>
            <h2 className="ap-h2">{p.path.title}</h2>
          </div>
          <ol className="ap-steps" style={{ "--n": p.path.steps.length } as React.CSSProperties}>
            {p.path.steps.map((s, i) => (
              <li className={"mark" in s && s.mark ? `is-${s.mark}` : undefined} key={s.title}>
                <span className="ap-dot" aria-hidden="true" />
                <p className="ap-step"><span className="ap-no">{NOS[i]}</span></p>
                <h3>{s.title}</h3>
                <p className={`ap-body ${ph(s.body) ?? ""}`}>{s.body}</p>
                {"mark" in s && s.mark === "account" && (
                  <p className="ap-mark"><CircleUserRound size={22} strokeWidth={1.5} aria-hidden="true" />Your account starts here</p>
                )}
                {"mark" in s && s.mark === "button" && (
                  <p className="ap-mark">
                    <Image src="/ambassador/button-400.webp" alt="" width={40} height={40} unoptimized />
                    Your button
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* The button, drawn face on from its print file with construction lines. */}
      <section className="ap-sec ap-anatomy">
        <div className="ap-wrap ap-split">
          <div className="ap-anatomy-text">
            <p className="ap-kicker">{p.button.kicker}</p>
            <h2 className="ap-h2">{p.button.title}</h2>
            <p className="ap-lede-sm">{p.button.body}</p>
          </div>
          <figure className="ap-drawing">
            <div className="ap-face">
              <Image src="/ambassador/button-art.webp" alt={p.hero.alt} width={1200} height={1200} unoptimized />
            </div>
            <svg className="ap-lines" viewBox="0 0 200 200" aria-hidden="true">
              <circle cx="100" cy="100" r="75" />
              <circle cx="100" cy="100" r="91.5" className="cut" />
              <path d="M100 18v12M100 170v12M18 100h12M170 100h12" />
              <rect x="97.5" y="22.5" width="5" height="5" /><rect x="97.5" y="172.5" width="5" height="5" /><rect x="22.5" y="97.5" width="5" height="5" /><rect x="172.5" y="97.5" width="5" height="5" />
              <path d="M25 196h150M25 192v8M175 192v8" className="dim" />
              <path d="M16 11 56 55M184 11 121 79M184 171 133 152" className="lead" />
              <circle cx="56" cy="55" r="1.3" className="end" /><circle cx="121" cy="79" r="1.3" className="end" /><circle cx="133" cy="152" r="1.3" className="end" />
            </svg>
            <figcaption>
              <span className="ap-c ap-c-mark">Orb mark</span>
              <span className="ap-c ap-c-top">The Upskilling Labs</span>
              <span className="ap-c ap-c-role">{p.role}</span>
              <span className="ap-c ap-c-size">1.5 in · 38 mm</span>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Questions. */}
      <section className="ap-sec ap-faq">
        <div className="ap-wrap ap-split">
          <div className="ap-head">
            <p className="ap-kicker">{p.faq.kicker}</p>
            <h2 className="ap-h2">{p.faq.title}</h2>
          </div>
          <div className="ap-faqlist">
            {p.faq.items.map((f) => (
              <details key={f.q}>
                <summary><span>{f.q}</span><i aria-hidden="true" /></summary>
                <p className={ph(f.a)}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Join. */}
      <section className="ap-join">
        <div className="ap-wrap">
          <Image className="ap-join-button" src="/ambassador/button-400.webp" alt="" width={400} height={400} unoptimized />
          <h2>{p.join.title}</h2>
          <p className={`ap-lede-sm ${ph(p.join.lede) ?? ""}`}>{p.join.lede}</p>
          <a className="ap-btn" href={cta}>{p.join.cta}</a>
          <p className="ap-account">It starts with a free Labs account.</p>
        </div>
      </section>
    </main>
  );
}
