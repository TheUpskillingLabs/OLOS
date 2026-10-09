import "./ambassador.css";

/* The Ambassador account surfaces (docs/ambassadors/CLAUDE.md). The
   (dashboard) layout already guards auth, the profile gate and the weekly
   Learning Log gate; this layer only brings the amb-* styles. */
export default function AmbassadorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
