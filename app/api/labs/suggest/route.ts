import { NextResponse, NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/labs/suggest?zip=20001 — the registration lab chooser's data
// (docs/LOCAL_LABS.md). Returns every lab split active/waitlist plus a zip
// suggestion (the nearest lab, mirroring metroFromZip's prefix→default→active
// fallback). Metros are public read, so no auth needed — this is the same
// data /local-labs shows, shaped for the funnel's picker.
interface LabLite {
  id: number;
  slug: string;
  name: string;
  st: string | null;
  status: "active" | "waitlist";
}

export async function GET(request: NextRequest) {
  const zip = (new URL(request.url).searchParams.get("zip") ?? "").slice(0, 3);
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("metros")
    .select("id, slug, name, st, status, is_default, zip_prefixes")
    .order("name");

  const rows = (data ?? []) as (LabLite & {
    is_default: boolean;
    zip_prefixes: string[] | null;
  })[];

  const lite = (m: (typeof rows)[number]): LabLite => ({
    id: m.id,
    slug: m.slug,
    name: m.name,
    st: m.st,
    status: m.status,
  });

  const matched = rows.find((m) => (m.zip_prefixes ?? []).includes(zip));
  const fallback =
    rows.find((m) => m.is_default) ?? rows.find((m) => m.status === "active");
  const suggested = matched ?? fallback ?? null;

  return NextResponse.json({
    suggested: suggested ? lite(suggested) : null,
    active: rows.filter((m) => m.status === "active").map(lite),
    waitlist: rows.filter((m) => m.status === "waitlist").map(lite),
  });
}
