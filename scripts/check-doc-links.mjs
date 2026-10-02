#!/usr/bin/env node
// Relative-link checker for Markdown — the "Links" rule in
// .github/workflows/docs-check.yml (see docs/roadmap/documentation-framework.md §7.1).
//
// Usage:
//   node scripts/check-doc-links.mjs                 # every tracked *.md
//   node scripts/check-doc-links.mjs a.md b.md       # only these files
//
// Checks every `[text](target)` whose target is a relative path (not http(s),
// mailto, tel, a bare #anchor, a `/site-absolute` path, or a `{{template}}`
// placeholder) and fails if the target file or directory does not exist.
// Anchors (#…) are stripped; URL-encoding is decoded; one level of balanced
// parentheses inside the target is allowed so `app/(dashboard)/x.tsx` works.
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, resolve, join, relative } from "node:path";

const root = process.cwd();

// Targets that are intentionally not in git (large spreadsheets, local-only files).
const ALLOWLIST = [
  /Upskiller Community Manager( CSV)?\.(xlsx|csv)$/i,
];

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : execSync("git ls-files '*.md' '**/*.md'", { encoding: "utf8" }).trim().split("\n").filter(Boolean);

// `[label](target "title")` with one nesting level of parens in target.
const LINK_RE = /\[[^\]]*\]\(((?:[^()\s]|\([^()\s]*\))+)(?:\s+"[^"]*")?\)/g;

const broken = [];
for (const f of files) {
  if (!f.endsWith(".md") || !existsSync(join(root, f))) continue;
  // docs/archive/ holds frozen session artifacts whose code links are historical by design.
  if (f.startsWith("docs/archive/")) continue;
  const text = readFileSync(join(root, f), "utf8");
  let m;
  while ((m = LINK_RE.exec(text))) {
    let target = m[1];
    if (/^(https?:|mailto:|tel:|#|\/|\{\{)/.test(target)) continue;
    if (target === "url" || target === "link") continue; // prose placeholders
    target = target.split("#")[0];
    if (!target) continue;
    try { target = decodeURIComponent(target); } catch { /* keep raw */ }
    if (ALLOWLIST.some((re) => re.test(target))) continue;
    const abs = resolve(dirname(join(root, f)), target);
    if (!existsSync(abs)) broken.push({ file: f, target: m[1], resolved: relative(root, abs) });
  }
}

if (broken.length) {
  console.error(`✗ ${broken.length} broken relative link(s):`);
  for (const b of broken) console.error(`  ${b.file}: (${b.target}) → ${b.resolved}`);
  process.exit(1);
}
console.log(`✓ relative links resolve in ${files.length} Markdown file(s)`);
