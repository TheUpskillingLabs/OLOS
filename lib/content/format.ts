// Date formatting for public content — verbatim ports of the prototype's
// fmtDate/fmtDay/fmtTime (tools/generate.js). Events store local wall time.

const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Jul 28 · 6 PM" */
export function fmtDate(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${MO[d.getMonth()]} ${d.getDate()} · ${h} ${ap}`;
}

/** "Tuesday, Jul 28" */
export function fmtDay(iso: string): string {
  const d = new Date(iso);
  return `${DAY[d.getDay()]}, ${MO[d.getMonth()]} ${d.getDate()}`;
}

/** "6 PM" / "6:30 PM" */
export function fmtTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}${m ? ":" + String(m).padStart(2, "0") : ""} ${ap}`;
}

/** "…, Washington, DC 20001, USA" → "Washington". Falls back to the
    original string if it can't find a state+ZIP segment. */
export function cityOf(locationName: string | null): string {
  if (!locationName) return "";
  const parts = locationName.split(",").map((s) => s.trim()).filter(Boolean);
  // The segment right before "ST ZIP" (e.g. "DC 20001") is the city.
  const stateZipIdx = parts.findIndex((p) => /^[A-Z]{2}\s+\d{5}/.test(p));
  if (stateZipIdx > 0) return parts[stateZipIdx - 1];
  return locationName; // unparseable → keep current behavior
}

export const CONTENT_TYPE_LABEL: Record<string, string> = {
  guide: "Guide",
  recording: "Recording",
  template: "Template",
  course: "Course",
  playbook: "Playbook",
};
