import OrbDefs from "@/app/components/chrome/orb-defs";

/* The Sensemaker/survey shell — chrome-less on purpose. Like the (auth) group,
   it has no nav/footer/upsell so its surfaces run full-bleed (the field survey
   is a one-question-at-a-time flow, not a content page). It mounts OrbDefs once
   so the brand orb's gradients resolve on the welcome + success screens. */
export default function SurveyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <OrbDefs />
      {children}
    </>
  );
}
