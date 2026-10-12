import Link from "next/link";
import { apply } from "@/lib/ambassador/content";

/* The apply flow's first screen below the heading: the film (or, until it
   exists, a photo that says nothing about a missing film), then the program
   as numbered steps — what you'll do, what you get, where it's going — and
   last "The Labs in brief", grouped by topic, which holds every fact the ten
   quiz questions ask about. All copy: apply.json `video`. A topic's `more`
   renders a link only once it has an href (the slot for fuller pieces built
   later), so an empty slot shows nothing. */

const v = apply.video;

export const hasFilm = Boolean(v.src);

type More = { label: string; href: string } | null;

export function ApplyOverview() {
  const { steps, labs } = v.overview;
  return (
    <>
      <div style={{ marginTop: 20 }}>
        {hasFilm ? (
          <video className="amb-video" controls playsInline preload="metadata" poster={v.poster || undefined}>
            <source src={v.src} />
            {v.captions && <track kind="captions" src={v.captions} srcLang="en" label="English" default />}
          </video>
        ) : (
          <figure className="amb-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.fallback.src} alt={v.fallback.alt} width={1600} height={1200} />
            <figcaption>{v.fallback.caption}</figcaption>
          </figure>
        )}
      </div>

      <ol className="amb-overview">
        {steps.map((s, i) => (
          <li key={s.id}>
            <span className="amb-step-n" aria-hidden>{i + 1}</span>
            <div>
              <h2 className="t-h3">{s.title}</h2>
              <ul>
                {s.points.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>
          </li>
        ))}
        <li>
          <span className="amb-step-n" aria-hidden>{steps.length + 1}</span>
          <div>
            <h2 className="t-h3">{labs.title}</h2>
            <p className="amb-note">{labs.lede}</p>
            <div className="amb-topics">
              {labs.topics.map((t) => {
                const more = t.more as More;
                return (
                  <section key={t.id} className="amb-panel" aria-label={t.title}>
                    <h3 className="t-h4">{t.title}</h3>
                    <ul>
                      {t.points.map((p) => <li key={p}>{p}</li>)}
                    </ul>
                    {more?.href && (
                      <Link className="amb-linkbtn" href={more.href}>{more.label} →</Link>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        </li>
      </ol>
    </>
  );
}
