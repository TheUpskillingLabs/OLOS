#!/usr/bin/env node
// Publish OLOS documentation artifacts to the team knowledge repository.
// Design: docs/roadmap/documentation-topology.md. Manifest: docs/publish.manifest.json.
//
// Usage
//   node scripts/publish-artifacts.mjs --out <dir> [--tag v2026.10.10] [--dry-run]
//   node scripts/publish-artifacts.mjs --prune-plan            # files eligible for the sweep PR
//
// --out is a checkout of the knowledge repo (or any directory for a dry run). The script
// never commits or pushes; the workflow does that. What it does per rule:
//   mirror        copy every file under `source` to `dest`, stamping Markdown with a
//                 provenance header and rewriting relative links that leave the published
//                 set into absolute, sha-pinned GitHub links.
//   mirror+prune  same as mirror; additionally listed by --prune-plan when the copy in
//                 --out has identical content (the sweep PR deletes them from OLOS).
//   snapshot      only when --tag is given: copy to a dated/tagged filename. With
//                 "section": "latest", copy just the newest dated section of CHANGELOG.md.
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { dirname, join, relative, resolve, posix } from "node:path";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const flag = (k) => args.includes(k);
const OUT = opt("--out");
const TAG = opt("--tag");
const DRY = flag("--dry-run");
const PRUNE_PLAN = flag("--prune-plan");

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, "docs/publish.manifest.json"), "utf8"));
const sha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
const shortSha = sha.slice(0, 7);
const today = new Date().toISOString().slice(0, 10);
const OLOS_URL = "https://github.com/TheUpskillingLabs/OLOS";

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name === ".obsidian" || e.name === ".trash") continue; out.push(...walk(p)); }
    else out.push(p);
  }
  return out;
}

// 1. Resolve every rule to concrete (src, dest) pairs.
const pairs = [];  // { src (abs), rel (repo-relative), dest (relative to OUT), mode, rule }
for (const rule of manifest.rules) {
  const srcAbs = join(root, rule.source);
  if (!existsSync(srcAbs)) { if (rule.optional) continue; console.warn(`! source missing: ${rule.source}`); continue; }
  if (rule.mode === "snapshot") {
    if (!TAG) continue;
    pairs.push({ src: srcAbs, rel: rule.source, dest: rule.dest.replace("{tag}", TAG), mode: rule.mode, rule });
    continue;
  }
  if (statSync(srcAbs).isDirectory()) {
    for (const f of walk(srcAbs)) {
      const rel = relative(root, f);
      pairs.push({ src: f, rel, dest: posix.join(rule.dest, relative(srcAbs, f).split("\\").join("/")), mode: rule.mode, rule });
    }
  } else {
    pairs.push({ src: srcAbs, rel: rule.source, dest: rule.dest, mode: rule.mode, rule });
  }
}
const publishedRel = new Set(pairs.map((p) => p.rel));
const destByRel = new Map(pairs.filter((p) => p.mode !== "snapshot").map((p) => [p.rel, p.dest]));

// 2. Transform Markdown: provenance header + link rewriting.
const LINK_RE = /(\]\()((?:[^()\s]|\([^()\s]*\))+)(\))/g;
function transformMarkdown(text, rel, dest) {
  const header = `<!-- Published from ${OLOS_URL}/blob/${sha}/${rel} on ${today} (${shortSha}). This copy is read-only: edit it in OLOS via a pull request; the next publish overwrites it. -->\n\n`;
  const body = text.replace(LINK_RE, (m, open, target, close) => {
    if (/^(https?:|mailto:|tel:|#|\/|\{\{)/.test(target) || target === "url") return m;
    const [path, anchor] = target.split("#");
    let olosPath;
    try { olosPath = posix.normalize(posix.join(posix.dirname(rel), decodeURIComponent(path))); } catch { return m; }
    if (destByRel.has(olosPath)) {
      // Link into the published set → relative link between the two destinations.
      const to = posix.relative(posix.dirname(dest), destByRel.get(olosPath));
      return `${open}${to}${anchor ? "#" + anchor : ""}${close}`;
    }
    return `${open}${OLOS_URL}/blob/${sha}/${olosPath}${anchor ? "#" + anchor : ""}${close}`;
  });
  return header + body;
}

function latestChangelogSection(text) {
  const m = text.match(/\n## \[\d{4}\.\d{2}\.\d{2}\][\s\S]*?(?=\n## \[|\n---\n|$)/);
  return m ? m[0].trim() + "\n" : text;
}

// 3. Prune plan: mirror+prune files whose published copy is byte-identical (post-transform).
if (PRUNE_PLAN) {
  if (!OUT) { console.error("--prune-plan needs --out <knowledge-repo checkout>"); process.exit(2); }
  const eligible = [];
  for (const p of pairs.filter((x) => x.mode === "mirror+prune")) {
    const target = join(OUT, p.dest);
    if (!existsSync(target)) continue;
    if (p.rule.keepIndex && /(^|\/)README\.md$/.test(p.rel)) continue;
    const expected = p.src.endsWith(".md") ? transformMarkdown(readFileSync(p.src, "utf8"), p.rel, p.dest) : readFileSync(p.src);
    const a = createHash("sha256").update(expected).digest("hex");
    const b = createHash("sha256").update(readFileSync(target)).digest("hex");
    // The provenance header carries the publishing sha, so compare bodies only.
    const strip = (buf) => Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf).replace(/^<!-- Published from[^\n]*-->\n\n/, ""));
    const a2 = createHash("sha256").update(strip(expected)).digest("hex");
    const b2 = createHash("sha256").update(strip(readFileSync(target, p.src.endsWith(".md") ? "utf8" : null))).digest("hex");
    if (a === b || a2 === b2) eligible.push(p.rel);
  }
  console.log(eligible.join("\n"));
  process.exit(0);
}

// 4. Publish.
if (!OUT) { console.error("--out <dir> is required"); process.exit(2); }
let written = 0;
const index = [];
for (const p of pairs) {
  const target = join(OUT, p.dest);
  mkdirSync(dirname(target), { recursive: true });
  if (p.src.endsWith(".md")) {
    let text = readFileSync(p.src, "utf8");
    if (p.mode === "snapshot" && p.rule.section === "latest") text = latestChangelogSection(text);
    const out = transformMarkdown(text, p.rel, p.dest);
    if (!DRY) writeFileSync(target, out);
  } else if (!DRY) {
    copyFileSync(p.src, target);
  }
  written++;
  index.push({ rel: p.rel, dest: p.dest, mode: p.mode });
}
// PUBLISHED.md — the human index of what came from OLOS and when.
const byDest = new Map();
for (const i of index) byDest.set(i.dest, i);
const lines = [
  "# Published from OLOS",
  "",
  `Last publish: ${today} from [\`${shortSha}\`](${OLOS_URL}/commit/${sha})${TAG ? ` (tag \`${TAG}\`)` : ""}.`,
  "These files are generated copies. **Edit them in OLOS** (`docs/…`) via a pull request; the publish workflow overwrites them.",
  "",
  "| Knowledge repo path | Source in OLOS | Mode |",
  "|---|---|---|",
  ...[...byDest.values()].sort((a, b) => a.dest.localeCompare(b.dest)).map((i) => `| \`${i.dest}\` | [\`${i.rel}\`](${OLOS_URL}/blob/${sha}/${i.rel}) | ${i.mode} |`),
  "",
];
if (!DRY) { mkdirSync(join(OUT, "olos"), { recursive: true }); writeFileSync(join(OUT, "olos/PUBLISHED.md"), lines.join("\n")); }
console.log(`${DRY ? "(dry run) " : ""}published ${written} file(s) from ${shortSha} → ${OUT}${TAG ? ` [tag ${TAG}]` : ""}`);
