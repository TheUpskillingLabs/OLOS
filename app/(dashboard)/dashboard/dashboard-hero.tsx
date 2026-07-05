import Link from "next/link";
import Orb from "@/app/components/chrome/orb";

/* The dashboard hero — the signed-in identity band (prototype panel-dashboard
   ".app-cover"): a warm dark orb cover carrying the member's avatar, a greeting,
   a one-line status, and (when engaged) an at-a-glance stat strip. LinkedIn's
   identity header married to Airbnb's rounded, orb-lit cover. A plain server
   component; OrbDefs is mounted once by the dashboard layout. */

export interface HeroStat {
  value: string | number;
  label: string;
}

export default function DashboardHero({
  initials,
  avatarUrl,
  eyebrow,
  greeting,
  lede,
  stats,
}: {
  initials: string;
  avatarUrl?: string | null;
  eyebrow: string;
  greeting: string;
  lede: string;
  stats?: HeroStat[];
}) {
  return (
    <section className="app-cover s-cover grain on-dark mb-8 rounded-card shadow-card">
      <Orb />
      {/* Scrim — the orb never sits raw under text (design rule). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(100deg, rgba(0,20,27,0) 42%, rgba(0,20,27,0.5) 100%)",
        }}
      />
      <div className="app-cover-inner px-6 sm:px-10">
        <div className="flex flex-wrap items-center gap-5 sm:gap-7">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              aria-hidden
              referrerPolicy="no-referrer"
              className="avatar-lg object-cover"
            />
          ) : (
            <div className="avatar-lg" aria-hidden>
              {initials}
            </div>
          )}
          <div className="min-w-[220px] flex-1">
            <div className="lbl lbl-teal mb-2">{eyebrow}</div>
            <h1 className="t-h1">{greeting}</h1>
            <p className="t-lede mt-2">{lede}</p>
            <Link
              href="/profile"
              className="mt-3 inline-block text-sm font-semibold hover:underline"
              style={{ color: "var(--od1)" }}
            >
              View your full profile &rarr;
            </Link>
          </div>
          {stats && stats.length > 0 && (
            <div className="flex gap-7 sm:gap-9">
              {stats.map((s) => (
                <div key={s.label}>
                  <div
                    className="text-3xl font-bold leading-none tracking-tight tabular-nums"
                    style={{ color: "var(--teal)" }}
                  >
                    {s.value}
                  </div>
                  <div className="lbl mt-2">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
