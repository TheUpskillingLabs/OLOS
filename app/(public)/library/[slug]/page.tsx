import { notFound } from "next/navigation";
import {
  MediaFrame,
  ResourceTeaser,
} from "@/app/components/content/teasers";
import { getResource, getResources } from "@/lib/content/queries";
import { CONTENT_TYPE_LABEL } from "@/lib/content/format";
import type { ResourceRow } from "@/lib/content/queries";

/* The resource detail page — the prototype generator's resourcePage():
   .detail grid (media + copy + commons provenance + sticky action aside),
   then "More from the library" recirculation. */

function actionLabel(contentType: ResourceRow["content_type"]): string {
  return contentType === "recording"
    ? "Watch now"
    : contentType === "course"
      ? "Start the course"
      : "Open it";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const r = await getResource(slug);
  if (!r) return { title: "Learning Library · The Upskilling Labs" };
  return {
    title: `${r.title} · The Upskilling Labs`,
    description: r.summary || "",
    openGraph: {
      title: r.title,
      description: r.summary || "",
      type: "article",
    },
  };
}

export default async function ResourcePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const r = await getResource(slug);
  if (!r) notFound();

  const typeLabel = CONTENT_TYPE_LABEL[r.content_type] || "Guide";
  const action = actionLabel(r.content_type);

  // Related: up to 3 published resources sharing a tag, backfilled with
  // whatever else the library has (the generator's related+fill pair).
  const others = (await getResources()).filter((x) => x.slug !== r.slug);
  const related = others
    .filter((x) => (x.tags || []).some((t) => (r.tags || []).includes(t)))
    .slice(0, 3);
  const fill =
    related.length < 3
      ? others.filter((x) => !related.includes(x)).slice(0, 3 - related.length)
      : [];
  const recirculation = related.concat(fill);

  return (
    <>
      <div className="container">
        <div className="detail" style={{ marginTop: 16 }}>
          <div className="detail-main">
            <MediaFrame img={r.img} grad={r.grad} tag={typeLabel} />
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                marginTop: 20,
              }}
            >
              <span className="lbl lbl-teal">{typeLabel}</span>
              <span className="lbl">{r.meta || ""}</span>
            </div>
            <h1 className="t-h1">{r.title}</h1>
            <p className="t-lede" style={{ marginBottom: 20 }}>
              {r.summary || ""}
            </p>
            {(r.body || []).map((p, i) => (
              <p key={i} className="t-body" style={{ marginBottom: 14 }}>
                {p}
              </p>
            ))}
            {r.from_line && (
              <div
                className="lcard"
                style={{
                  padding: "18px 20px",
                  marginTop: 24,
                  borderLeft: "3px solid var(--teal)",
                }}
              >
                <div className="lbl lbl-teal" style={{ marginBottom: 6 }}>
                  From the commons
                </div>
                <p className="t-body">{r.from_line}</p>
                <p className="t-small" style={{ marginTop: 6 }}>
                  Built in a cycle, returned to everyone — MIT code · CC BY 4.0
                  content, yours to build on.
                </p>
              </div>
            )}
            <div className="detail-bottom">
              <a className="btn btn-teal btn-block" href={r.url || "#"}>
                {action}
              </a>
            </div>
          </div>
          <aside className="detail-aside">
            <div className="lcard" style={{ padding: 24 }}>
              <div className="t-h3" style={{ marginBottom: 4 }}>
                Free
              </div>
              <p className="t-small" style={{ marginBottom: 16 }}>
                {r.meta || ""}
              </p>
              <a className="btn btn-teal btn-block" href={r.url || "#"}>
                {action}
              </a>
              <div style={{ marginTop: 16 }}>
                <div className="kv">
                  <span className="k lbl">By</span>
                  <span className="t-small">
                    {r.author || "The Upskilling Labs"}
                  </span>
                </div>
                <div className="kv">
                  <span className="k lbl">License</span>
                  <span className="t-small">{r.license || "CC BY 4.0"}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
      {recirculation.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                  More like this
                </div>
                <h2 className="t-h3">More from the library</h2>
              </div>
            </div>
            <div className="cards dense">
              {recirculation.map((x) => (
                <ResourceTeaser key={x.slug} resource={x} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
