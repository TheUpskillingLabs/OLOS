/* Orb gradient defs sprite — the SINGLE renderable source for url(#oc/#or/#og).
   Inline orbs reference these gradient ids; browsers resolve url() to the FIRST
   instance in the document, and if that instance sits inside a hidden subtree
   the orb paints as a flat slab (prototype UX finding F1). Render this as
   body's first child on every app page; never display:none — hidden defs are
   exactly the bug. Ported from onboarding-proto shared.js. */
export default function OrbDefs() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        <radialGradient id="oc" cx="38%" cy="35%" r="58%">
          <stop offset="0%" stopColor="#0094A0" />
          <stop offset="62%" stopColor="rgba(0,148,160,0)" />
        </radialGradient>
        <radialGradient id="or" cx="62%" cy="78%" r="65%">
          <stop offset="60%" stopColor="rgba(225,29,42,0)" />
          <stop offset="100%" stopColor="#E11D2A" />
        </radialGradient>
        <linearGradient id="og" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00D3E4" />
          <stop offset="60%" stopColor="#0094A0" />
          <stop offset="100%" stopColor="#007882" />
        </linearGradient>
      </defs>
    </svg>
  );
}
