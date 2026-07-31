import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderMarkdown } from "./markdown";

const html = (s: string) => renderToStaticMarkup(<>{renderMarkdown(s)}</>);

describe("renderMarkdown", () => {
  it("splits blank-line paragraphs and keeps single newlines as breaks", () => {
    const out = html("First para.\n\nBio:\nAda Lovelace");
    expect(out.match(/<p/g)?.length).toBe(2);
    expect(out).toContain("<br/>");
  });

  it("renders bold, italic, and markdown links", () => {
    const out = html("**Working Backwards,** led by *someone* at [WW](https://ww.org/) now.");
    expect(out).toContain("<strong>Working Backwards,</strong>");
    expect(out).toContain("<em>someone</em>");
    expect(out).toContain('href="https://ww.org/"');
    expect(out).toContain('target="_blank"');
  });

  /* The Volunteer Orientation regression (owner flag, 2026-07-31): the author
     bolded a whole sentence containing a link, the bold match swallowed the
     link, and the reader saw a raw docs.google.com URL in brackets. */
  it("renders a link nested inside bold", () => {
    const out = html(
      "We have needs: **Please [sign up here](https://forms.example.org/x) if you can.**"
    );
    expect(out).toContain('href="https://forms.example.org/x"');
    expect(out).toContain("sign up here");
    expect(out).not.toContain("[sign up here]");
    expect(out).not.toContain("](");
  });

  it("renders bold nested inside a link label", () => {
    const out = html("Read [**the guide**](https://ww.org/guide) first.");
    expect(out).toContain('href="https://ww.org/guide"');
    expect(out).toContain("<strong>the guide</strong>");
    expect(out).not.toContain("**");
  });

  it("renders a bare URL nested inside bold", () => {
    const out = html("**Sign up at https://forms.example.org/y today.**");
    expect(out).toContain('href="https://forms.example.org/y"');
  });

  it("links bare URLs without swallowing trailing punctuation", () => {
    const out = html("Hosted by WW (https://www.whitman-walker.org/).");
    expect(out).toContain('href="https://www.whitman-walker.org/"');
    expect(out).toContain(")."); 
  });

  it("renders dash lists as ul/li", () => {
    const out = html("- one thing\n- two thing");
    expect(out.match(/<li/g)?.length).toBe(2);
  });

  it("escapes HTML in third-party text", () => {
    const out = html("hello <script>alert(1)</script>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });
});
