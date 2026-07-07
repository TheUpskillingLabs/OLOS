import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HQ_SECTOR_SLUG, resolveHqSectorId } from "./org-sector";

function fakeClient(row: { id: number } | null, sawSlug: { value?: string }): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: (_col: string, value: string) => {
          sawSlug.value = value;
          return { maybeSingle: async () => ({ data: row }) };
        },
      }),
    }),
  } as unknown as SupabaseClient;
}

describe("resolveHqSectorId", () => {
  it("returns the sector id when the seed row exists", async () => {
    const sawSlug: { value?: string } = {};
    const client = fakeClient({ id: 42 }, sawSlug);
    expect(await resolveHqSectorId(client)).toBe(42);
    expect(sawSlug.value).toBe(HQ_SECTOR_SLUG);
  });

  it("returns null when the seed sector is missing", async () => {
    const client = fakeClient(null, {});
    expect(await resolveHqSectorId(client)).toBeNull();
  });
});
