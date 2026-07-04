import { createServiceClient } from "@/lib/supabase/server";

// Metro (local lab) assignment — the production twin of onboarding-proto's
// zip→lab mapping (app.js FLOWS('signup').onComplete). The lab is assigned
// silently from the zip; the zip is used for nothing else (owner decision —
// the funnel says so out loud).
//
// The metros table (00033) is the source of truth; the zip→metro mapping is
// data (metros.zip_prefixes, migration 00038), not code — the hardcoded map
// this module used to carry is retired (roadmap Phase 0.5). Unmatched zips
// fall back to the active lab (DC), the prototype's rule: everyone gets a
// lab; only the active one can absorb "somewhere else".

export type MetroStatus = "active" | "waitlist";

export interface Metro {
  slug: string;
  name: string;
  status: MetroStatus;
}

interface MetroPrefixRow extends Metro {
  zip_prefixes: string[];
}

export async function metroFromZip(zip: string): Promise<Metro> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("metros")
    .select("slug, name, status, zip_prefixes");
  const metros = (data ?? []) as MetroPrefixRow[];

  const z = String(zip || "").slice(0, 3);
  const matched = metros.find((m) => (m.zip_prefixes ?? []).includes(z));
  if (matched) return matched;

  const active = metros.find((m) => m.status === "active");
  if (active) return active;

  // Degenerate fallback (empty metros table — fresh local DB before seeds):
  // keep the funnel alive rather than failing signup over lab assignment.
  return { slug: "dc", name: "Washington, DC", status: "active" };
}
