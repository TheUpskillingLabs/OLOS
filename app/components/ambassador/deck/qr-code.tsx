import qrcode from "qrcode-generator";

const QUIET = 4; // quiet zone, in modules

/** The join QR as one SVG path in ink on white (scans reliably on paper). */
export function QrCode({ value, label }: { value: string; label: string }) {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  const n = qr.getModuleCount();
  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + QUIET} ${r + QUIET}h1v1h-1z`;
  }
  const size = n + QUIET * 2;
  return (
    <div className="deck-sl-qr" role="img" aria-label={label}>
      <svg viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" aria-hidden="true">
        <rect width="100%" height="100%" fill="#fff" />
        <path d={d} fill="#00141B" />
      </svg>
    </div>
  );
}
