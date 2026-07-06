#!/usr/bin/env node
// Fails if two migrations share the same numeric prefix. This is the parallel-work
// hazard supabase/CLAUDE.md warns about ("never reuse a migration number") — two
// contributors both grabbing 000NN on separate branches collide silently on merge.
// Wired into CI so the collision goes red at PR-open, not at merge. Zero-dep.
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "supabase",
  "migrations"
);

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

let ok = true;
const byNumber = new Map(); // integer prefix -> [filenames]

for (const f of files) {
  const m = f.match(/^(\d+)/);
  if (!m) {
    console.error(`✗ migration has no leading number: ${f}`);
    ok = false;
    continue;
  }
  const n = Number(m[1]); // normalize so 0048 and 00048 collide
  if (!byNumber.has(n)) byNumber.set(n, []);
  byNumber.get(n).push(f);
}

const dupes = [...byNumber.entries()].filter(([, fs]) => fs.length > 1);
if (dupes.length) {
  console.error("✗ Duplicate migration numbers — renumber before merging:");
  for (const [n, fs] of dupes.sort((a, b) => a[0] - b[0])) {
    console.error(`    ${String(n).padStart(5, "0")}: ${fs.join(", ")}`);
  }
  console.error("\n  Each migration needs a unique numeric prefix — see supabase/CLAUDE.md.");
  ok = false;
}

if (!ok) process.exit(1);
console.log(`✓ ${files.length} migrations — all numeric prefixes unique.`);
