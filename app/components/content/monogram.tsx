/* The imageless-card fallback — centered initials on the card's gradient tile,
   replacing the retired brand orb. Drop it inside a positioned, gradient media
   frame (.media / .spot-media / .story-media); it fills the frame and inherits
   the tile's 14px corner via the parent's overflow:hidden. Presentational and
   hook-free, so both server (teasers) and "use client" (spotlights) modules can
   import it. No OrbDefs needed. */
export default function Monogram({ label }: { label: string }) {
  return (
    <span className="monogram" aria-hidden="true">
      {label || "•"}
    </span>
  );
}
