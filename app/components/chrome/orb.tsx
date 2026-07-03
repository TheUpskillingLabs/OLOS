/* The brand orb (SVG) — the photography stand-in on covers, banners, and media
   frames. Place inside a positioned parent; pair with a scrim — the orb never
   sits raw under text or interactive elements (its red lobe kills contrast).
   Requires <OrbDefs /> mounted on the page (the gradients resolve to the first
   defs instance). Ported from onboarding-proto shared.js ORB. */
export default function Orb({ className = "m-orb" }: { className?: string }) {
  return (
    <div className={className}>
      <svg
        viewBox="0 0 240 240"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ display: "block", width: "100%", height: "100%" }}
      >
        <circle cx="120" cy="120" r="116" fill="url(#oc)" />
        <circle cx="120" cy="120" r="116" fill="url(#or)" />
        <g transform="translate(20,40) scale(0.142)">
          <path
            d="M 0 900.84 C 532.341 651.368 841.069 454.81 1407.215 0 C 1190.699 365.98 1060.371 566.788 776.503 900.84 L 950.588 496.405 C 539.219 733.009 347.248 789.767 0 900.84 Z"
            fill="url(#og)"
          />
        </g>
      </svg>
    </div>
  );
}
