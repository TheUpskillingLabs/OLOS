#!/usr/bin/env node
// Frontmatter validator for the decision vault (docs/vault/**, PR #391 conventions;
// docs/roadmap/documentation-framework.md §7.1). Exits 0 when the vault does not
// exist yet, so the workflow is safe to merge before #391 lands.
//
// Required keys: title, date (YYYY-MM-DD), status ∈ {proposed, accepted, superseded},
// kind ∈ {decision, divergence, workflow, index}. Templates are skipped.
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const STATUS = new Set(["proposed", "accepted", "superseded"]);
const KIND = new Set(["decision", "divergence", "workflow", "index"]);

if (!existsSync("docs/vault")) {
  console.log("· docs/vault/ not present — nothing to check");
  process.exit(0);
}
const files = execSync("git ls-files 'docs/vault/**/*.md' 'docs/vault/*.md'", { encoding: "utf8" })
  .trim().split("\n").filter((f) => f && !f.includes("/templates/") && !f.endsWith("CLAUDE.md"));

const errors = [];
for (const f of files) {
  const text = readFileSync(f, "utf8");
  const fm = text.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) { errors.push(`${f}: missing frontmatter`); continue; }
  const get = (k) => (fm[1].match(new RegExp(`^${k}:\\s*(.*)$`, "m")) || [])[1]?.trim();
  if (!get("title")) errors.push(`${f}: missing title`);
  const date = get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push(`${f}: date must be YYYY-MM-DD (got ${date ?? "nothing"})`);
  const kind = get("kind");
  if (!KIND.has(kind)) errors.push(`${f}: kind must be one of ${[...KIND].join("|")} (got ${kind ?? "nothing"})`);
  if (kind !== "index") {
    const status = (get("status") || "").split(/\s+#/)[0].trim();
    if (!STATUS.has(status)) errors.push(`${f}: status must be one of ${[...STATUS].join("|")} (got ${status || "nothing"})`);
  }
}
if (errors.length) { console.error(`✗ vault frontmatter:\n  ${errors.join("\n  ")}`); process.exit(1); }
console.log(`✓ vault frontmatter valid in ${files.length} note(s)`);
