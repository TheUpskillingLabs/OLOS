import PublicNav from "@/app/components/chrome/public-nav";
import OrbDefs from "@/app/components/chrome/orb-defs";
import { PgFoot, UpsellBand } from "@/app/components/chrome/site-footers";
import { publicSession } from "@/lib/auth/public-session";

/* The public content pages' shell (events/library/labs/about/build-cycles):
   the dark public nav, the compact footer, and the signed-out upsell band.
   Every page here ships the same chrome — the prototype generator's shell(). */
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { signedIn, initials } = await publicSession();

  return (
    <div className={`flex min-h-screen flex-col${signedIn ? "" : " has-upsell"}`}>
      <OrbDefs />
      <PublicNav signedIn={signedIn} initials={initials} />
      <div className="flex-1">{children}</div>
      <PgFoot />
      {!signedIn && <UpsellBand />}
    </div>
  );
}
