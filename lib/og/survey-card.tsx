import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getOpenFieldSurvey } from "@/lib/content/surveys";

/* The public field survey's social card — the first programmatic OG generator in
   the app (there was none before; every route inherited the generic site card).
   Shared by the colocated opengraph-image / twitter-image routes so the card is
   authored once. Rebuilds the app's `.s-cover` dark treatment (app/globals.css)
   with brand tokens, since Satori (behind next/og) only speaks inline styles +
   flexbox — no Tailwind, no `grid`, and every multi-child box needs display:flex.

   Fonts: Satori can't use the variable Geologica that next/font loads, so we read
   vendored static weights (400/700) from disk. Kept off any CDN at runtime per the
   owner's no-CDN rule (app/layout.tsx). */

export const SURVEY_OG_SIZE = { width: 1200, height: 630 };
export const SURVEY_OG_CONTENT_TYPE = "image/png";
export const SURVEY_OG_ALT =
  "The Upskilling Labs field survey — you see something the data misses.";

// Brand tokens (app/globals.css @theme). Hardcoded here because Satori resolves
// no CSS variables — keep these in sync with the canonical palette.
const INK = "#00141b";
const TEAL = "#0094a0";
const WHITE_95 = "rgba(255,255,255,0.95)";
const WHITE_64 = "rgba(255,255,255,0.64)";
const WHITE_40 = "rgba(255,255,255,0.40)";

// The `.s-cover` recipe, rebuilt with Satori-safe gradients: `circle at x% y%`
// radials (Satori doesn't reliably parse ellipse `<size> at ...` forms) over the
// ink→navy→forest base. Comma-joined into one backgroundImage.
const COVER_BACKGROUND = [
  "radial-gradient(circle at 0% 100%, rgba(0,148,160,0.50) 0%, rgba(0,148,160,0) 45%)",
  "radial-gradient(circle at 100% 0%, rgba(0,148,160,0.35) 0%, rgba(0,148,160,0) 42%)",
  "linear-gradient(150deg, #00141b 0%, #03232a 55%, #005f68 125%)",
].join(", ");

// Disk reads memoized at module scope so repeated scrapes don't re-read the font
// and orb files on every request.
let assetsPromise: Promise<{
  regular: Buffer;
  bold: Buffer;
  orb: string;
}> | null = null;

function loadAssets() {
  if (!assetsPromise) {
    assetsPromise = (async () => {
      const [regular, bold, orbData] = await Promise.all([
        readFile(join(process.cwd(), "assets/fonts/Geologica-Regular.woff")),
        readFile(join(process.cwd(), "assets/fonts/Geologica-Bold.woff")),
        // The orb logomark, vendored from the 256×256 app icon (a fraction of the
        // 1.7MB public/assets/orb-mark.png) — small enough to inline as a data URI.
        // Kept in assets/ next to the fonts so Next's output file tracing bundles
        // all three runtime reads for production.
        readFile(join(process.cwd(), "assets/orb-badge.png")),
      ]);
      return {
        regular,
        bold,
        orb: `data:image/png;base64,${orbData.toString("base64")}`,
      };
    })();
  }
  return assetsPromise;
}

/**
 * Render the field survey's OG/Twitter card as a PNG. The only survey-specific
 * text is the subtitle: `${problem_domain} Cycle` (e.g. "Civics & Elections
 * Cycle"), read from the same source generateMetadata uses. Any read failure or
 * an unknown/closed slug falls back to the "Field Survey" card with no subtitle —
 * never a wrong cycle name, and never a broken image.
 */
export async function renderSurveyOgCard(slug: string) {
  const { regular, bold, orb } = await loadAssets();

  let subtitle: string | null = null;
  try {
    const survey = await getOpenFieldSurvey(slug);
    if (survey?.problem_domain) subtitle = `${survey.problem_domain} Cycle`;
  } catch {
    subtitle = null;
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          fontFamily: "Geologica",
          color: WHITE_95,
          backgroundColor: INK,
          backgroundImage: COVER_BACKGROUND,
        }}
      >
        {/* Brand row — orb badge + live-text wordmark (rebuilds the lockup so no
            baked-background PNG box shows on the gradient). */}
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori (next/og) renders a raw <img>; next/image can't run inside ImageResponse. */}
          <img
            src={orb}
            alt=""
            width={64}
            height={64}
            style={{ borderRadius: 15 }}
          />
          <div
            style={{
              marginLeft: 20,
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: WHITE_95,
            }}
          >
            The Upskilling Labs
          </div>
        </div>

        {/* Headline block — H1 "Field Survey", teal cycle subtitle, hook line. */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 108,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              color: WHITE_95,
            }}
          >
            Field Survey
          </div>
          {subtitle ? (
            <div
              style={{
                marginTop: 20,
                fontSize: 48,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: TEAL,
              }}
            >
              {subtitle}
            </div>
          ) : null}
          <div
            style={{
              marginTop: 22,
              fontSize: 30,
              fontWeight: 400,
              letterSpacing: "-0.01em",
              color: WHITE_64,
            }}
          >
            You see something the data misses.
          </div>
        </div>

        {/* Meta row — verbatim from the survey landing. */}
        <div
          style={{
            fontSize: 24,
            fontWeight: 400,
            letterSpacing: "-0.005em",
            color: WHITE_40,
          }}
        >
          ~2 minutes · no account needed · anonymous by default
        </div>
      </div>
    ),
    {
      ...SURVEY_OG_SIZE,
      fonts: [
        { name: "Geologica", data: regular, weight: 400, style: "normal" },
        { name: "Geologica", data: bold, weight: 700, style: "normal" },
      ],
      // The card is effectively static per survey — let CDNs/scrapers cache it.
      headers: {
        "Cache-Control":
          "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
