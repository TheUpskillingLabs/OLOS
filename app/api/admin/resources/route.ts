import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { resourceCreateSchema } from "@/lib/validations/resource-admin";
import { slugifyHandle } from "@/lib/participants/handle";

// Create a Learning Library resource (the /admin/content Library surface).
// Admin-gated, service-role. The slug is the /library/[slug] URL contract —
// derived from the title (or an explicit override) and made unique so two
// docs with the same title don't collide. Everything else maps straight to
// the resources columns (migration 00033).

/** First free slug in the `base`, `base-2`, `base-3`, … series. */
async function uniqueSlug(
  service: ReturnType<typeof createServiceClient>,
  base: string
): Promise<string> {
  const { data } = await service
    .from("resources")
    .select("slug")
    .like("slug", `${base}%`);
  const taken = new Set((data ?? []).map((r) => (r as { slug: string }).slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export const POST = withAdminAuth(async (request: NextRequest) => {
  const body = await parseBody(request, resourceCreateSchema);
  if (isErrorResponse(body)) return body;

  const service = createServiceClient();
  const base = slugifyHandle(body.slug || body.title);
  const slug = await uniqueSlug(service, base);

  const { data, error } = await service
    .from("resources")
    .insert({
      slug,
      title: body.title,
      url: body.url,
      content_type: body.content_type,
      summary: body.summary ?? null,
      meta: body.meta ?? null,
      author: body.author ?? null,
      status: body.status,
    })
    .select(
      "id, slug, title, content_type, url, summary, meta, author, status, created_at"
    )
    .single();
  if (error) return dbError(error, "resource-create");

  return NextResponse.json(data, { status: 201 });
});
