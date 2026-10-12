/* A small Markdown reader for the guide's five steps (content/steps.ts). The
   steps use a deliberately narrow subset, so this stays a few dozen lines
   instead of a dependency: ## and ### headings, paragraphs, > quotes, - and
   1. lists, **bold**, *italic*, [links](url), and a built-in block on its own
   line (<!-- ladder -->). An unknown block name throws, naming it — the
   prototype failed its build the same way, so a typo can't ship silently.

   Pure module: parses to plain data; app/components/ambassador/step-body.tsx
   renders it. */

export const BLOCKS = ["ladder", "faq", "story", "asks", "present"] as const;
export type BlockName = (typeof BLOCKS)[number];

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; children: Inline[] }
  | { kind: "em"; children: Inline[] }
  | { kind: "link"; href: string; children: Inline[] };

export type Block =
  | { kind: "h2" | "h3"; children: Inline[] }
  | { kind: "p"; children: Inline[] }
  | { kind: "quote"; children: Inline[] }
  | { kind: "ul" | "ol"; items: Inline[][] }
  | { kind: "block"; name: BlockName };

const INLINE = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/;

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let rest = src;
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) {
      out.push({ kind: "text", text: rest });
      break;
    }
    if (m.index > 0) out.push({ kind: "text", text: rest.slice(0, m.index) });
    if (m[1] !== undefined) out.push({ kind: "strong", children: parseInline(m[1]) });
    else if (m[2] !== undefined) out.push({ kind: "em", children: parseInline(m[2]) });
    else out.push({ kind: "link", href: m[4], children: parseInline(m[3]) });
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

export function parseMarkdown(src: string, where = "step"): Block[] {
  const blocks: Block[] = [];
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  let para: string[] = [];
  let quote: string[] = [];
  let list: { kind: "ul" | "ol"; items: string[] } | null = null;

  const flush = () => {
    if (para.length) blocks.push({ kind: "p", children: parseInline(para.join(" ")) });
    if (quote.length) blocks.push({ kind: "quote", children: parseInline(quote.join(" ")) });
    if (list) blocks.push({ kind: list.kind, items: list.items.map(parseInline) });
    para = [];
    quote = [];
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const block = /^<!--\s*([a-z-]+)\s*-->$/.exec(line);
    if (block) {
      flush();
      const name = block[1];
      if (!(BLOCKS as readonly string[]).includes(name)) {
        throw new Error(`Unknown block <!-- ${name} --> in ${where}. Known: ${BLOCKS.join(", ")}.`);
      }
      blocks.push({ kind: "block", name: name as BlockName });
      continue;
    }
    const h = /^(#{2,3})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      blocks.push({ kind: h[1].length === 2 ? "h2" : "h3", children: parseInline(h[2]) });
      continue;
    }
    if (line.startsWith(">")) {
      if (para.length || list) flush();
      quote.push(line.replace(/^>\s?/, ""));
      continue;
    }
    const li = /^(?:([-*])|(\d+)\.)\s+(.*)$/.exec(line);
    if (li) {
      const kind = li[1] ? "ul" : "ol";
      if (para.length || quote.length || (list && list.kind !== kind)) flush();
      if (!list) list = { kind, items: [] };
      list.items.push(li[3]);
      continue;
    }
    if (quote.length || list) flush();
    para.push(line);
  }
  flush();
  return blocks;
}
