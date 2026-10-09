import Link from "next/link";
import { faq, ladder, ui, AMBASSADOR_PRESENT } from "@/lib/ambassador/content";
import { parseMarkdown, type Block, type Inline } from "@/lib/ambassador/markdown";
import type { AmbassadorSession } from "@/lib/ambassador/session";
import AskList from "./ask-list";
import { StoryCard } from "./story";

/* One guide step's body: its Markdown (lib/ambassador/content/steps.ts) with
   the built-in blocks put in place. */

function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.kind) {
          case "text":
            return <span key={i}>{n.text}</span>;
          case "strong":
            return <strong key={i}><Inlines nodes={n.children} /></strong>;
          case "em":
            return <em key={i}><Inlines nodes={n.children} /></em>;
          case "link": {
            const external = /^https?:/.test(n.href);
            return (
              <a key={i} href={n.href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
                <Inlines nodes={n.children} />
              </a>
            );
          }
        }
      })}
    </>
  );
}

export function Ladder() {
  return (
    <ol className="amb-ladder" aria-label="The ladder">
      {ladder.rungs.map((r, i) => (
        <li key={r.label}>
          <span className="amb-step-n" aria-hidden>{i + 1}</span>
          <span><b>{r.label}.</b> {r.detail}</span>
        </li>
      ))}
    </ol>
  );
}

export function FaqList() {
  return (
    <div className="amb-faq">
      {faq.map((f) => (
        <details key={f.id}>
          <summary>{f.question}</summary>
          <p>{f.answer}</p>
        </details>
      ))}
    </div>
  );
}

export function PresentLinks() {
  return (
    <div className="amb-row-actions">
      <Link className="btn btn-teal" href={AMBASSADOR_PRESENT}>{ui.step.present}</Link>
      <Link className="btn btn-ghost" href={`${AMBASSADOR_PRESENT}?short`}>{ui.step.short}</Link>
    </div>
  );
}

function BlockView({ block, session }: { block: Block; session: AmbassadorSession | null }) {
  switch (block.kind) {
    case "h2":
      return <h2><Inlines nodes={block.children} /></h2>;
    case "h3":
      return <h3><Inlines nodes={block.children} /></h3>;
    case "p":
      return <p><Inlines nodes={block.children} /></p>;
    case "quote":
      return <blockquote><Inlines nodes={block.children} /></blockquote>;
    case "ul":
    case "ol": {
      const Tag = block.kind;
      return (
        <Tag>
          {block.items.map((item, i) => (
            <li key={i}><Inlines nodes={item} /></li>
          ))}
        </Tag>
      );
    }
    case "block":
      switch (block.name) {
        case "ladder":
          return <Ladder />;
        case "faq":
          return <FaqList />;
        case "story":
          return <StoryCard />;
        case "asks":
          return <AskList session={session} />;
        case "present":
          return <PresentLinks />;
      }
  }
}

export default function StepBody({ body, stepId, session }: { body: string; stepId: string; session: AmbassadorSession | null }) {
  const blocks = parseMarkdown(body, stepId);
  return (
    <div className="amb-prose">
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} session={session} />
      ))}
    </div>
  );
}
