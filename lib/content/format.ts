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

export const CONTENT_TYPE_LABEL: Record<string, string> = {
  guide: "Guide",
  recording: "Recording",
  template: "Template",
  course: "Course",
  playbook: "Playbook",
};
