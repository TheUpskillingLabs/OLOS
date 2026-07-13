import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { fetchSearchDocs } from "@/lib/search/data";
import { assembleResults, SUGGEST_LIMITS, toResult } from "@/lib/search/order";
import { MIN_QUERY_LENGTH, sanitizeQuery } from "@/lib/search/sanitize";

/**
 * GET /api/search/suggest?q=… — typeahead for the global nav search box.
 * Supersedes /api/directory/suggest, widened from the three directory
 * entities to all six searchable types: people (5), pods (3), projects (3),
 * events (3), local labs (2), cycles (2), in fixed group order.
 *
 * Members-only (withAuth — any signed-in member, matching the (dashboard)
 * layout gate). Visibility guards, column allowlists, and the service-client
 * security posture all live in lib/search/data.ts.
 */

export const GET = withAuth(async (request: NextRequest) => {
  const q = sanitizeQuery(request.nextUrl.searchParams.get("q") ?? "");
  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ results: [] });
  }

  const corpus = await fetchSearchDocs({ q, nowMs: Date.now() });
  const results = assembleResults(corpus, q, SUGGEST_LIMITS).map(toResult);

  return NextResponse.json({ results });
});
