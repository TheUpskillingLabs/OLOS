import PublicNav from "@/app/components/chrome/public-nav";
import OrbDefs from "@/app/components/chrome/orb-defs";
import { OsFooter } from "@/app/components/chrome/site-footers";
import { publicSession } from "@/lib/auth/public-session";

/* The public content pages' shell (events/library/labs/about/build-cycles):
   the dark public nav and the full open-source footer. Every page here ships
   the same chrome as the landing — the prototype generator's shell(). */
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { signedIn, initials, avatarUrl } = await publicSession();

  return (
    <div className="flex min-h-screen flex-col">
      <OrbDefs />
      <PublicNav signedIn={signedIn} initials={initials} avatarUrl={avatarUrl} />
      <div className="flex-1">{children}</div>
      <OsFooter />
    </div>
  );
}
