import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { OWNER_REGISTRY, getLifecycleDescriptor, isOwnerEntityKey } from "./registry";
import * as archiveHelpers from "./archive";

/* The registry is the allowlist the API route dispatches off. This pins its
   internal consistency so a descriptor can never name a verb implementation that
   doesn't exist: every RPC name must be shipped by a migration, and every archive
   helper must be an exported function in archive.ts. */

const MIGRATIONS_SQL = (() => {
  const dir = join(process.cwd(), "supabase", "migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n")
    .toLowerCase();
})();

function migrationDefinesFunction(name: string): boolean {
  return MIGRATIONS_SQL.includes(`function ${name.toLowerCase()}(`);
}

describe("owner registry consistency", () => {
  const entries = Object.values(OWNER_REGISTRY).filter(
    (d): d is NonNullable<typeof d> => d != null
  );

  it("has at least the participants entry (Phase 1)", () => {
    expect(isOwnerEntityKey("participants")).toBe(true);
    expect(getLifecycleDescriptor("participants")).not.toBeNull();
  });

  it("keys match each descriptor's own key", () => {
    for (const [key, descriptor] of Object.entries(OWNER_REGISTRY)) {
      expect(descriptor?.key).toBe(key);
    }
  });

  it("every reset/delete RPC is defined by a migration", () => {
    for (const d of entries) {
      for (const spec of [d.reset, d.delete]) {
        if (spec?.kind === "rpc") {
          expect(
            migrationDefinesFunction(spec.fn),
            `registry names RPC "${spec.fn}" but no migration defines it`
          ).toBe(true);
        }
      }
    }
  });

  it("every archive helper is an exported function", () => {
    for (const d of entries) {
      if (d.archive?.kind === "helper") {
        const fn = (archiveHelpers as Record<string, unknown>)[d.archive.fn];
        expect(typeof fn, `archive helper "${d.archive.fn}" is not exported`).toBe("function");
      }
    }
  });

  it("rejects unknown / untrusted keys", () => {
    expect(isOwnerEntityKey("participants; drop table")).toBe(false);
    expect(isOwnerEntityKey(null)).toBe(false);
    expect(getLifecycleDescriptor("nonexistent")).toBeNull();
  });
});
