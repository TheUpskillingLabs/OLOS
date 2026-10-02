#!/usr/bin/env node
// Publish OLOS documentation artifacts to the team knowledge repository.
// Design: docs/roadmap/documentation-topology.md. Manifest: docs/publish.manifest.json.
//
// Usage
//   node scripts/publish-artifacts.mjs --out <dir> [--tag v2026.10.10] [--dry-run]
//   --force            rewrite unchanged files too (refresh every provenance header)
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
import { execSync } from "node:child_process";
import { dirname, join, relative, posix } from "node:path";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const flag = (k) => args.includes(k);
const OUT = opt("--out");
const TAG = opt("--tag");
const DRY = flag("--dry-run");
const FORCE = flag("--force"); // rewrite every file even when its content is unchanged (refreshes provenance headers)
const PRUNE_PLAN = flag("--prune-plan");

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, "docs/publish.manifest.json"), "utf8"));
const sha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
const shortSha = sha.slice(0, 7);
// Provenance names HEAD, so publishing from a dirty tree would pin links to a commit that
// does not contain what was copied. CI always runs on a clean checkout; warn by hand.
if (execSync("git status --porcelain -- docs CHANGELOG.md SCHEMA.md", { encoding: "utf8" }).trim()) {
  console.warn(`! uncommitted changes under docs/, CHANGELOG.md, or SCHEMA.md: provenance will name ${shortSha}, which may not contain them — commit first`);
}
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

// A published file is rewritten only when its content changed. Bodies are compared with
// the provenance header, the generated-copy line, and the publishing sha removed, so the
// knowledge repo's history shows real edits only; an unchanged file keeps its links pinned
// to the sha that last changed it.
const HEADER_RE = /^<!-- Published from[^\n]*-->\n\n/;
const GENERATED_RE = /^> \*\*Generated copy\.\*\*[^\n]*\n/m;
const SHA_RE = /\/(blob|commit)\/[0-9a-f]{40}(\/|\))/g;
function normalized(text) {
  return String(text).replace(HEADER_RE, "").replace(GENERATED_RE, "").replace(SHA_RE, "/$1/SHA$2");
}
function unchangedMarkdown(target, out) {
  return !FORCE && existsSync(target) && normalized(readFileSync(target, "utf8")) === normalized(out);
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
    const same = p.src.endsWith(".md")
      ? unchangedMarkdown(target, transformMarkdown(readFileSync(p.src, "utf8"), p.rel, p.dest))
      : readFileSync(target).equals(readFileSync(p.src));
    if (same) eligible.push(p.rel);
  }
  console.log(eligible.join("\n"));
  process.exit(0);
}

// 4. Publish.
if (!OUT) { console.error("--out <dir> is required"); process.exit(2); }
let written = 0;
let unchanged = 0;
const index = [];
const folders = manifest.folders || {};
// A folder listed in `folders` gets a generated README (the meta-documentation). When
// OLOS publishes its own README into that folder, the generated file embeds it instead
// of the two overwriting each other.
const sourceReadmes = new Map();
for (const p of pairs) {
  const target = join(OUT, p.dest);
  mkdirSync(dirname(target), { recursive: true });
  if (p.src.endsWith(".md")) {
    let text = readFileSync(p.src, "utf8");
    if (p.mode === "snapshot" && p.rule.section === "latest") text = latestChangelogSection(text);
    const out = transformMarkdown(text, p.rel, p.dest);
    const folder = posix.dirname(p.dest) + "/";
    if (posix.basename(p.dest) === "README.md" && folders[folder]) {
      sourceReadmes.set(folder, { rel: p.rel, body: out.replace(HEADER_RE, "").trimEnd() });
      index.push({ rel: p.rel, dest: p.dest, mode: p.mode });
      continue;
    }
    if (unchangedMarkdown(target, out)) unchanged++;
    else { written++; if (!DRY) writeFileSync(target, out); }
  } else if (existsSync(target) && readFileSync(target).equals(readFileSync(p.src))) {
    unchanged++;
  } else {
    written++;
    if (!DRY) copyFileSync(p.src, target);
  }
  index.push({ rel: p.rel, dest: p.dest, mode: p.mode });
}
// Per-folder README.md — the meta-documentation (manifest `folders`): what is here and
// why it matters, plus a file table with provenance, plus the folder's own OLOS README
// when one is published. Written only for listed folders.
for (const [folder, meta] of Object.entries(folders)) {
  const inFolder = index.filter((i) => i.dest.startsWith(folder));
  const direct = inFolder.filter((i) => !i.dest.slice(folder.length).includes("/"));
  const subdirs = [...new Set(inFolder.filter((i) => i.dest.slice(folder.length).includes("/")).map((i) => i.dest.slice(folder.length).split("/")[0]))].sort();
  if (!inFolder.length && !Object.keys(folders).some((f) => f !== folder && f.startsWith(folder))) continue;
  const rows = direct.sort((a, b) => a.dest.localeCompare(b.dest)).map((i) => {
    const name = i.dest.slice(folder.length);
    return `| [\`${name}\`](${encodeURI(name)}) | [\`${i.rel}\`](${OLOS_URL}/blob/${sha}/${i.rel}) | ${i.mode} |`;
  });
  const src = sourceReadmes.get(folder);
  const subs = subdirs.map((d) => { const meta2 = folders[folder + d + "/"]; return `- [\`${d}/\`](${d}/)${meta2 ? " — " + meta2.title : ""}`; });
  const md = [
    `# ${meta.title}`, "",
    `> **Generated copy.** Published from [TheUpskillingLabs/OLOS](${OLOS_URL}) at [\`${shortSha}\`](${OLOS_URL}/commit/${sha}) on ${today}. Edit the source in OLOS by pull request; this file and everything listed here is overwritten on the next publish.`, "",
    "## What this is, and why it matters", "", meta.relevance, "",
    ...(subs.length ? ["## Folders", "", ...subs, ""] : []),
    ...(rows.length ? ["## Files", "", "| File | Source in OLOS | Mode |", "|---|---|---|", ...rows, ""] : []),
    ...(src ? ["---", "", `## From OLOS \`${src.rel}\``, "", `> The folder's own README in OLOS, published with it. Edit it there.`, "", src.body, ""] : []),
  ].join("\n");
  const target = join(OUT, folder, "README.md");
  mkdirSync(dirname(target), { recursive: true });
  if (unchangedMarkdown(target, md)) unchanged++;
  else { written++; if (!DRY) writeFileSync(target, md); }
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
console.log(`${DRY ? "(dry run) " : ""}published ${written} file(s) from ${shortSha} → ${OUT} (${unchanged} unchanged, left as published)${TAG ? ` [tag ${TAG}]` : ""}`);
