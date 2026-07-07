import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/directory/suggest?q=… — typeahead for the nav search box.
 * Members-only (withAuth — any signed-in member, matching the (dashboard)
 * layout gate). Returns a slim, PII-free payload across the three directory
 * entities: people (5), pods (3), projects (3).
 *
 * Security: reads through the SERVICE client with the same display-column
 * allowlist posture as /directory — participants RLS never widens, no PII
 * column is selected, and internal (test/staff) accounts are excluded.
 */

export interface DirectorySuggestion {
  type: "person" | "pod" | "project";
  href: string;
  label: string;
  sublabel: string | null;
  imageUrl: string | null;
  initials: string;
}

export const GET = withAuth(async (request: NextRequest) => {
  const raw = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  // PostgREST's .or() parses commas/parens as syntax, and %/_ are ilike
  // wildcards — strip them all so user input can't break or widen the match.
  const q = raw.replace(/[,()%\\_]/g, " ").replace(/\s+/g, " ").trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const like = `%${q}%`;
  const service = createServiceClient();

  const [peopleRes, podsRes, projectsRes] = await Promise.all([
    service
      .from("participants")
      .select(
        "id, handle, preferred_name, first_name, last_name, headline, profile_image_url"
      )
      .eq("is_test", false)
      .eq("is_staff", false)
      .or(
        `preferred_name.ilike.${like},first_name.ilike.${like},last_name.ilike.${like},headline.ilike.${like}`
      )
      .limit(5),
    service
      .from("pods")
      .select("id, name, status, problem_statements(statement_text)")
      .ilike("name", like)
      .limit(3),
    service
      .from("projects")
      .select("id, name, status, solution_proposals(name)")
      .ilike("name", like)
      .limit(3),
  ]);

  for (const [label, res] of [
    ["participants", peopleRes],
    ["pods", podsRes],
    ["projects", projectsRes],
  ] as const) {
    if (res.error) {
      console.error(`[directory/suggest] ${label} query failed:`, res.error.message);
    }
  }

  const first = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

  const results: DirectorySuggestion[] = [
    ...(peopleRes.data ?? []).map((p): DirectorySuggestion => {
      const name =
        p.preferred_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
      return {
        type: "person",
        href: p.handle
          ? `/u/${p.handle}`
          : `/directory?q=${encodeURIComponent(name)}`,
        label: name || "A member",
        sublabel: p.headline ?? null,
        imageUrl: p.profile_image_url ?? null,
        initials:
          `${p.first_name?.[0] ?? ""}${p.last_name?.[0] ?? ""}`.toUpperCase() ||
          "?",
      };
    }),
    ...(podsRes.data ?? []).map((p): DirectorySuggestion => {
      const statement = first(p.problem_statements)?.statement_text ?? null;
      return {
        type: "pod",
        href: `/pods/${p.id}`,
        label: p.name ?? `Pod ${p.id}`,
        sublabel: statement,
        imageUrl: null,
        initials: "",
      };
    }),
    ...(projectsRes.data ?? []).map((p): DirectorySuggestion => ({
      type: "project",
      href: `/projects/${p.id}`,
      label: p.name ?? `Project ${p.id}`,
      sublabel: first(p.solution_proposals)?.name ?? null,
      imageUrl: null,
      initials: "",
    })),
  ];

  return NextResponse.json({ results });
});
