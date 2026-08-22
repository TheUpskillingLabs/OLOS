/* The Learning Log compliance nudge email — the soft-nudge layer's email voice,
   for a member who has fallen behind on the weekly cadence but is not (yet) being
   revoked. It sits between two existing emails and must not duplicate either:

     learning-log-reminder      "this week's log is due"   (the <24h armed window)
     THIS ONE                   "you've fallen behind"     (missed weeks, soft)
     revocation-warning         "you're at risk of losing access" (the hard cron)

   It is a pure presenter: the copy (headline/body/CTA) is resolved upstream by
   logComplianceCopy (lib/learning-logs/compliance-logic.ts) so the email and the
   dashboard card say exactly the same thing in one voice. This file only wraps
   that copy in HTML/text. Styling mirrors learning-log-reminder-template.ts. */

export function complianceNudgeSubject(cycleName: string): string {
  return `A quick nudge on your ${cycleName} Learning Log`;
}

export function complianceNudgeEmailHtml({
  headline,
  body,
  dashboardUrl,
  ctaLabel,
  firstName,
}: {
  headline: string;
  body: string;
  dashboardUrl: string;
  ctaLabel: string;
  firstName?: string | null;
}): string {
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F6F4EF;font-family:Helvetica,Arial,sans-serif;color:#00141B;">
    <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
      <p style="font-size:15px;line-height:24px;margin:0 0 12px;color:#4A5557;">${greeting}</p>
      <h1 style="font-size:22px;line-height:28px;margin:0 0 12px;">${headline}</h1>
      <p style="font-size:15px;line-height:24px;margin:0 0 12px;color:#4A5557;">
        ${body}
      </p>
      <p style="margin:24px 0;">
        <a href="${dashboardUrl}"
           style="display:inline-block;background:#007882;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:14px;">
          ${ctaLabel}
        </a>
      </p>
      <p style="font-size:13px;line-height:20px;color:#748083;margin:24px 0 0;">
        Stuck on something? Say so in the log — what you&rsquo;ve tried and what
        would help goes straight to your Poderator. That&rsquo;s always okay.
      </p>
    </div>
  </body>
</html>`;
}

export function complianceNudgeEmailText({
  headline,
  body,
  dashboardUrl,
  ctaLabel,
  firstName,
}: {
  headline: string;
  body: string;
  dashboardUrl: string;
  ctaLabel: string;
  firstName?: string | null;
}): string {
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  return [
    greeting,
    "",
    headline,
    "",
    body,
    "",
    `${ctaLabel}: ${dashboardUrl}`,
    "",
    "Stuck on something? Say so in the log — what you've tried and what",
    "would help goes straight to your Poderator. That's always okay.",
  ].join("\n");
}
