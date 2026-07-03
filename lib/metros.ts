// Metro (local lab) assignment — the production twin of onboarding-proto's
// zip→lab mapping (app.js FLOWS('signup').onComplete). The lab is assigned
// silently from the zip; the zip is used for nothing else (owner decision —
// the funnel says so out loud).
//
// Two-state model from the prototype: DC is the only active lab; every other
// metro is a waitlist. A real `metros` table (backend doc §1.1) arrives with
// the labs/waitlist stage; until then this map is the source.

export type MetroStatus = "active" | "waitlist";

export interface Metro {
  slug: string;
  name: string;
  status: MetroStatus;
}

export const METROS: Record<string, Metro> = {
  dc: { slug: "dc", name: "Washington, DC", status: "active" },
  baltimore: { slug: "baltimore", name: "Baltimore", status: "waitlist" },
  philadelphia: { slug: "philadelphia", name: "Philadelphia", status: "waitlist" },
};

export function metroFromZip(zip: string): Metro {
  const z = String(zip || "");
  const key = /^20[0-5]/.test(z)
    ? "dc"
    : /^21[0-2]/.test(z)
      ? "baltimore"
      : /^19[0-4]/.test(z)
        ? "philadelphia"
        : "dc";
  return METROS[key];
}
