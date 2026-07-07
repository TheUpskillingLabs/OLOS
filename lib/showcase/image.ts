import { NextRequest, NextResponse } from "next/server";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { resolveEntityCurator } from "./curator";

/**
 * Shared logo/cover upload for pod & project showcase pages. The client resizes
 * before posting; we validate type + size and write to the public `showcase`
 * bucket (migration 00060) with the service role, then point the entity's
 * logo_url / cover_url at the public URL (cache-busted with ?v=).
 *
 * CRITICAL vs the avatar route: an entity has TWO images. Each is keyed per-kind
 * (`{table}/{id}/logo.{ext}` / `…/cover.{ext}`) and stale-cleanup is scoped to
 * the SAME kind, so uploading a logo can never delete the cover. Authz is the
 * shared curator gate (app-layer) → service-role write bypasses RLS.
 */

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB (covers are wider than avatars)
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type ImageKind = "logo" | "cover";
const COLUMN: Record<ImageKind, "logo_url" | "cover_url"> = {
  logo: "logo_url",
  cover: "cover_url",
};

type Owner = "pod" | "project";
const TABLE: Record<Owner, "pods" | "projects"> = {
  pod: "pods",
  project: "projects",
};

function parseKind(request: NextRequest): ImageKind | null {
  const k = request.nextUrl.searchParams.get("kind");
  return k === "logo" || k === "cover" ? k : null;
}

const kindPaths = (owner: Owner, id: number, kind: ImageKind) =>
  Object.values(EXT).map((e) => `${TABLE[owner]}/${id}/${kind}.${e}`);

export async function handleImageUpload(
  request: NextRequest,
  auth: AuthenticatedRequest,
  owner: Owner,
  id: number
): Promise<NextResponse> {
  const kind = parseKind(request);
  if (!kind) {
    return NextResponse.json(
      { error: "kind must be 'logo' or 'cover'" },
      { status: 400 }
    );
  }

  const guard = await resolveEntityCurator(auth.user, owner, id, auth.supabase);
  if (guard) return guard;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image uploaded." }, { status: 400 });
  }
  if (!EXT[file.type]) {
    return NextResponse.json(
      { error: "Use a JPEG, PNG, or WebP image." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image is too large (5 MB max)." },
      { status: 400 }
    );
  }

  const ext = EXT[file.type];
  const path = `${TABLE[owner]}/${id}/${kind}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const service = createServiceClient();

  const { error: upErr } = await service.storage
    .from("showcase")
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (upErr) {
    console.error("[showcase-image] upload failed:", upErr.message);
    return NextResponse.json({ error: "Upload failed. Try again." }, { status: 500 });
  }

  // Drop leftovers for THIS kind only (e.g. a png→jpg switch) — never touch the
  // other image, which lives under a different `{kind}.{ext}` key.
  const stale = kindPaths(owner, id, kind).filter((p) => p !== path);
  await service.storage.from("showcase").remove(stale);

  const { data: pub } = service.storage.from("showcase").getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  const { error: dbErr } = await service
    .from(TABLE[owner])
    .update({ [COLUMN[kind]]: url })
    .eq("id", id);
  if (dbErr) return dbError(dbErr, "showcase-image-set");

  return NextResponse.json({ kind, url });
}

export async function handleImageDelete(
  request: NextRequest,
  auth: AuthenticatedRequest,
  owner: Owner,
  id: number
): Promise<NextResponse> {
  const kind = parseKind(request);
  if (!kind) {
    return NextResponse.json(
      { error: "kind must be 'logo' or 'cover'" },
      { status: 400 }
    );
  }

  const guard = await resolveEntityCurator(auth.user, owner, id, auth.supabase);
  if (guard) return guard;

  const service = createServiceClient();
  await service.storage.from("showcase").remove(kindPaths(owner, id, kind));

  const { error: dbErr } = await service
    .from(TABLE[owner])
    .update({ [COLUMN[kind]]: null })
    .eq("id", id);
  if (dbErr) return dbError(dbErr, "showcase-image-clear");

  return NextResponse.json({ kind, url: null });
}
