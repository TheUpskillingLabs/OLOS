import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import {
  entityLinkCreateSchema,
  entityLinkDeleteSchema,
} from "@/lib/validations/showcase";
import { resolveEntityCurator } from "@/lib/showcase/curator";

/**
 * Social/external links for showcase pages (and, later, user/cycle pages).
 *   POST   { owner_type, owner_id, platform, url, label? } — add/replace a link
 *   DELETE { owner_type, owner_id, platform }             — remove a link
 * Curator-gated per owner via resolveEntityCurator (the four-branch write gate).
 * One row per (owner_type, owner_id, platform); the URL scheme is validated
 * http/https-only in the zod schema (these render as raw <a href>).
 */

export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, entityLinkCreateSchema);
    if (isErrorResponse(body)) return body;

    const guard = await resolveEntityCurator(
      auth.user,
      body.owner_type,
      body.owner_id,
      auth.supabase
    );
    if (guard) return guard;

    const service = createServiceClient();
    const { data, error } = await service
      .from("entity_links")
      .upsert(
        {
          owner_type: body.owner_type,
          owner_id: body.owner_id,
          platform: body.platform,
          url: body.url,
          label: body.label ?? null,
        },
        { onConflict: "owner_type,owner_id,platform" }
      )
      .select("id, owner_type, owner_id, platform, url, label, sort_order")
      .single();
    if (error) return dbError(error, "entity-link-upsert");

    return NextResponse.json(data);
  }
);

export const DELETE = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, entityLinkDeleteSchema);
    if (isErrorResponse(body)) return body;

    const guard = await resolveEntityCurator(
      auth.user,
      body.owner_type,
      body.owner_id,
      auth.supabase
    );
    if (guard) return guard;

    const service = createServiceClient();
    const { error } = await service
      .from("entity_links")
      .delete()
      .eq("owner_type", body.owner_type)
      .eq("owner_id", body.owner_id)
      .eq("platform", body.platform);
    if (error) return dbError(error, "entity-link-delete");

    return NextResponse.json({ deleted: true });
  }
);
