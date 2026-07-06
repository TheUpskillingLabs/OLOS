import { notFound } from "next/navigation";
import { Crumbs } from "@/app/components/content/teasers";
import { getOpenFieldSurvey } from "@/lib/content/surveys";
import SurveyForm from "./survey-form";

/* The public field survey (SENSEMAKING_FLOW.md §3) — account-free, anonymous
   by default, the bedrock evidence layer that feeds the Data Sensemaker.
   Replaces the Civics & Elections Google Form. One instrument per share_slug;
   the survey-specific lede comes from the row, the "what is the Labs / where do
   insights go" copy is boilerplate here. */

// Reads the instrument per request (public, auth-aware nav); never prerendered.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const survey = await getOpenFieldSurvey(slug);
  if (!survey) return { title: "Field survey · The Upskilling Labs" };
  return {
    title: `${survey.title} · The Upskilling Labs`,
    description:
      survey.about ??
      "Share what you're seeing in the field — the observations that shape what we build.",
  };
}

export default async function SurveyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const survey = await getOpenFieldSurvey(slug);
  if (!survey) notFound();

  const domain = survey.problem_domain ?? "the field";

  return (
    <>
      <div className="container">
        <Crumbs trail={[["Home", "/"], ["Field survey", null]]} />
      </div>

      {/* Dark hero */}
      <section className="grain" style={{ background: "var(--ink)", color: "#fff" }}>
        <div
          className="container"
          style={{ maxWidth: 760, paddingTop: 56, paddingBottom: 56 }}
        >
          {survey.problem_domain && (
            <div className="lbl lbl-teal" style={{ marginBottom: 16 }}>
              {survey.problem_domain} · field survey
            </div>
          )}
          <h1 className="t-h1" style={{ maxWidth: "22ch" }}>
            {survey.title}
          </h1>
          {survey.about && (
            <p
              className="t-lede"
              style={{ marginTop: 18, maxWidth: "58ch", color: "var(--od2)" }}
            >
              {survey.about}
            </p>
          )}
        </div>
      </section>

      {/* Context + the form */}
      <section className="section">
        <div className="container" style={{ maxWidth: 760 }}>
          {/* Two boilerplate context blocks — constant across surveys */}
          <div className="lcard" style={{ padding: 28, marginBottom: 28 }}>
            <h2 className="t-h4" style={{ marginBottom: 8 }}>
              What is The Upskilling Labs?
            </h2>
            <p className="t-body text-meta" style={{ marginBottom: 20 }}>
              The Upskilling Labs is a free workforce-development and community
              organization that helps professionals build not just AI literacy,
              but the skills and capacity to identify problems, lead initiatives,
              and drive real outcomes in the age of AI. Its flagship program is
              the quarterly Build Cycle — each one focused on a different
              sector-based theme, taking upskillers from understanding a problem
              as a community, to prototyping solutions in small teams, to a
              public showcase.
            </p>
            <h2 className="t-h4" style={{ marginBottom: 8 }}>
              Where do my insights go?
            </h2>
            <p className="t-body text-meta" style={{ margin: 0 }}>
              Your insights help shape the problems Upskillers choose to explore
              in the upcoming {domain} Build Cycle. They join an open insights
              repository — contributed by subject-matter experts, practitioners,
              and members of the public — that participants draw on as they form
              their problem frames. Everything Upskillers produce is accessible
              and open-source. Submissions are voluntary and anonymous unless you
              choose to share your contact information.
            </p>
          </div>

          <SurveyForm slug={survey.share_slug} domain={domain} />
        </div>
      </section>
    </>
  );
}
