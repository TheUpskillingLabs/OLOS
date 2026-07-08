import { createServiceClient } from "@/lib/supabase/server";

// Metro (local lab) assignment — the production twin of onboarding-proto's
// zip→lab mapping (app.js FLOWS('signup').onComplete). The lab is assigned
// silently from the zip; the zip is used for nothing else (owner decision —
// the funnel says so out loud).
//
// The metros table (00033) is the source of truth; the zip→metro mapping is
// data (metros.zip_prefixes, migration 00038), not code — the hardcoded map
// this module used to carry is retired (roadmap Phase 0.5). Unmatched zips
// fall back to the default lab (metros.is_default, 00062 — with several
// active labs, "the active one" no longer names a single row), then to any
// active lab: everyone gets a lab; only a running one can absorb
// "somewhere else".

export type MetroStatus = "active" | "waitlist";

export interface Metro {
  /** Null only in the degenerate empty-table fallback. */
  id: number | null;
  slug: string;
  name: string;
  status: MetroStatus;
}

interface MetroPrefixRow extends Metro {
  id: number;
  is_default: boolean;
  zip_prefixes: string[];
}

export async function metroFromZip(zip: string): Promise<Metro> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("metros")
    .select("id, slug, name, status, is_default, zip_prefixes");
  const metros = (data ?? []) as MetroPrefixRow[];

  const z = String(zip || "").slice(0, 3);
  const matched = metros.find((m) => (m.zip_prefixes ?? []).includes(z));
  if (matched) return matched;

  const fallback =
    metros.find((m) => m.is_default) ?? metros.find((m) => m.status === "active");
  if (fallback) return fallback;

  // Degenerate fallback (empty metros table — fresh local DB before seeds):
  // keep the funnel alive rather than failing signup over lab assignment.
  return { id: null, slug: "dc", name: "Washington, DC", status: "active" };
}
