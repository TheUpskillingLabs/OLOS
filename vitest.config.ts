import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests live next to the code they test (lib/**/*.test.ts). The suite
// targets pure/mockable logic — no DB, no network; anything needing a
// Supabase client gets a hand-rolled mock (see reconciler.test.ts).
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
