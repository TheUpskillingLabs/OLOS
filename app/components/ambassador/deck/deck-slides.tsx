import { deck, ladder, ui } from "@/lib/ambassador/content";
import { QrCode } from "./qr-code";

export type DeckSlide = (typeof deck.slides)[number];

/** What slides 5 and 6 say about the next session (or the fallback copy). */
export interface AskInfo {
  day: string;
  where: string;
  expect: string;
  joinDate: string;
}

const DARK_BGS = new Set(["cover", "navy", "ink"]);
const LOGO = "/ambassador/logo-lockup-white.png";
const PHOTO = "/ambassador/photo-community.jpg";

function SlideBody({ slide, ask }: { slide: DeckSlide; ask: AskInfo }) {
  switch (slide.key) {
    case "question":
      return (
        <>
          <div className="deck-sl-body">
            <p className="deck-sl-eyebrow">{slide.eyebrow}</p>
            <h2 className="deck-sl-question">{deck.openingQuestion}</h2>
          </div>
          <div className="deck-sl-rail">
            {deck.partners.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.src} src={p.src} alt={p.alt} width={p.width} height={p.height} className="deck-sl-partner" />
            ))}
          </div>
        </>
      );
    case "story":
      return <div className="deck-sl-photo" role="img" aria-label={deck.photo.alt} style={{ backgroundImage: `url(${PHOTO})` }} />;
    case "what":
      return (
        <div className="deck-sl-body">
          <p className="deck-sl-eyebrow">{slide.eyebrow}</p>
          <h2 className="deck-sl-sentence">{deck.oneSentence}</h2>
          <ol className="deck-sl-ladder">
            {ladder.rungs.map((r, i) => (
              <li key={r.label}>
                <span className="deck-sl-rung-n">{String(i + 1).padStart(2, "0")}</span>
                <span className="deck-sl-rung-l">{r.label}</span>
              </li>
            ))}
          </ol>
        </div>
      );
    case "proof":
      return (
        <div className="deck-sl-body">
          <p className="deck-sl-eyebrow">{slide.eyebrow}</p>
          <p className="deck-sl-stat">{deck.proof.stat}</p>
          <p className="deck-sl-stat-label">{deck.proof.label}</p>
        </div>
      );
    case "ask":
      return (
        <div className="deck-sl-body">
          <p className="deck-sl-eyebrow">{slide.eyebrow}</p>
          <h2 className="deck-sl-date">{ask.day}</h2>
          <p className="deck-sl-where">{ask.where}</p>
          <p className="deck-sl-expect">{ask.expect}</p>
          {/* Words over a red rule, never a button-looking box: nobody can press a projected slide. */}
          <span className="deck-sl-join">{ui.present.joinCta}</span>
        </div>
      );
    case "join":
      return (
        <div className="deck-sl-body deck-sl-join-grid">
          <QrCode value={deck.joinUrl} label={deck.joinUrlLabel} />
          <div>
            <p className="deck-sl-eyebrow">{slide.eyebrow}</p>
            <p className="deck-sl-url">{deck.joinUrlLabel}</p>
            <p className="deck-sl-join-date">{ask.joinDate}</p>
          </div>
        </div>
      );
    default:
      return null;
  }
}

/** All slides stacked; `currentN` (a slide's `n`) is the visible one. */
export function DeckSlides({ slides, currentN, ask, hideInactive = false }: {
  slides: DeckSlide[];
  currentN: number | undefined;
  ask: AskInfo;
  /** Main stage hides inactive slides from assistive tech. */
  hideInactive?: boolean;
}) {
  return (
    <div className="deck-slides">
      {slides.map((s) => (
        <section
          key={s.n}
          className={`deck-slide deck-bg-${s.bg}${s.n === currentN ? " deck-current" : ""}`}
          aria-roledescription="slide"
          aria-label={`${ui.present.slide} ${s.n}`}
          aria-hidden={hideInactive ? s.n !== currentN : undefined}
        >
          {deck.placeholder && <span className="deck-sl-ph">{ui.present.placeholder}</span>}
          <SlideBody slide={s} ask={ask} />
          {DARK_BGS.has(s.bg) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="deck-sl-logo" src={LOGO} alt="The Upskilling Labs" width={384} height={144} />
          )}
        </section>
      ))}
    </div>
  );
}
