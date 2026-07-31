import type { ReactNode } from "react";

/* A deliberately tiny markdown renderer for Luma's About text (events.about,
   00094): paragraphs, "- " lists, **bold**, *italic* / _italic_,
   [text](url) links, and bare URLs. Nothing else — no headings, images,
   HTML, or nesting; if Luma copy outgrows this subset, reach for a real
   renderer instead of growing this one. Server-safe, dependency-free, and
   everything passes through React's escaping (no dangerouslySetInnerHTML,
   ever — this renders third-party text).

   Links open in a new tab: they leave the site by definition. */

const INLINE =
  /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|_([^_\n]+)_|(https?:\/\/[^\s<>()[\]]+)/g;

function Anchor({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: "var(--teal-deep)", fontWeight: 600 }}
    >
      {children}
    </a>
  );
}

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(INLINE)) {
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    if (m[1] && m[2]) {
      out.push(
        <Anchor key={key++} href={m[2]}>
          {m[1]}
        </Anchor>
      );
    } else if (m[3]) {
      out.push(<strong key={key++}>{m[3]}</strong>);
    } else if (m[4]) {
      out.push(<em key={key++}>{m[4]}</em>);
    } else if (m[5]) {
      out.push(<em key={key++}>{m[5]}</em>);
    } else if (m[6]) {
      // Bare URL. Trailing punctuation belongs to the sentence, not the link.
      const url = m[6].replace(/[.,;:!?]+$/, "");
      out.push(
        <Anchor key={key++} href={url}>
          {url}
        </Anchor>
      );
      if (url.length < m[6].length) out.push(m[6].slice(url.length));
    }
    last = i + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Lines within one paragraph keep their breaks (Luma uses single newlines
    inside a block for things like "Bio:" over the name). */
function renderLines(block: string): ReactNode[] {
  const lines = block.split("\n");
  const out: ReactNode[] = [];
  lines.forEach((line, i) => {
    if (i > 0) out.push(<br key={`br-${i}`} />);
    out.push(...renderInline(line));
  });
  return out;
}

export function renderMarkdown(text: string): ReactNode {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split("\n").map((l) => l.trim());
        if (lines.length > 0 && lines.every((l) => /^[-*]\s+/.test(l))) {
          return (
            <ul
              key={i}
              className="t-body"
              style={{
                color: "var(--slate)",
                paddingLeft: 20,
                marginBottom: 14,
                listStyle: "disc",
              }}
            >
              {lines.map((l, j) => (
                <li key={j} style={{ marginBottom: 6 }}>
                  {renderInline(l.replace(/^[-*]\s+/, ""))}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p
            key={i}
            className="t-body"
            style={{ color: "var(--slate)", marginBottom: 14 }}
          >
            {renderLines(block)}
          </p>
        );
      })}
    </>
  );
}
