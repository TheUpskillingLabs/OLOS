/**
 * Warning email sent by the two-stage revocation cron (#110 Phase C)
 * three days before any actual revocation. Mirrors the structure of
 * pulse-check-reminder-template.ts so subject/HTML/text are consumed
 * the same way by the cron's Resend integration.
 *
 * Two variants today, distinguishing the WHY behind the warning:
 *
 *   - 'not_in_pod'    — pod_registration_close has passed and the
 *                       participant still has no active pod
 *   - 'missed_pulses' — participant has the configured number of
 *                       consecutive missed pulses
 *
 * Tone is firm but recoverable. The deadline language is intentionally
 * concrete: "your access will be paused in 3 days" rather than "your
 * account will be revoked." Aligns with the architecture brief invariant
 * #5 ("soft delete everywhere") and the architectural intent that an
 * inactive participant can be reactivated by re-engagement.
 */

export type RevocationWarningReason = "not_in_pod" | "missed_pulses";

type WarningProps = {
  reason: RevocationWarningReason;
  /** URL the participant should visit to act on the warning. */
  actionUrl: string;
  /** Display name to address the email to (preferred_name or first_name). */
  firstName: string;
};

function variantCopy(reason: RevocationWarningReason): {
  subject: string;
  heading: string;
  lede: string;
  cta: string;
} {
  switch (reason) {
    case "not_in_pod":
      return {
        subject: "Your Upskilling Labs cohort access pauses in 3 days",
        heading: "You haven't joined a pod yet",
        lede:
          "Pod registration for this cycle has closed and you haven't joined a pod. To stay active in the cohort, please reach out to your cycle organizer or accept a pod invitation in the next <strong style=\"color:#ffffff;\">3 days</strong>. After that your cohort access will be paused.",
        cta: "Open your dashboard →",
      };
    case "missed_pulses":
      return {
        subject: "Your Upskilling Labs cohort access pauses in 3 days",
        heading: "We haven't heard from you in a while",
        lede:
          "You've missed your last two pulse checks. To stay active in the cohort, please submit a pulse check in the next <strong style=\"color:#ffffff;\">3 days</strong>. After that your cohort access will be paused — but you can rejoin anytime.",
        cta: "Submit pulse check →",
      };
  }
}

function variantTextLede(reason: RevocationWarningReason): string {
  switch (reason) {
    case "not_in_pod":
      return "Pod registration for this cycle has closed and you haven't joined a pod. To stay active in the cohort, please reach out to your cycle organizer or accept a pod invitation in the next 3 days. After that your cohort access will be paused.";
    case "missed_pulses":
      return "You've missed your last two pulse checks. To stay active in the cohort, please submit a pulse check in the next 3 days. After that your cohort access will be paused — but you can rejoin anytime.";
  }
}

export function revocationWarningSubject(
  reason: RevocationWarningReason
): string {
  return variantCopy(reason).subject;
}

export function revocationWarningHtml({
  reason,
  actionUrl,
  firstName,
}: WarningProps): string {
  const { heading, lede, cta } = variantCopy(reason);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#0b1016;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',sans-serif;color:#e6e6e6;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0b1016;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:32px;">
          <tr>
            <td>
              <p style="margin:0 0 8px;font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:#4dbbc2;">
                Upskilling Labs
              </p>
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#ffffff;line-height:1.3;letter-spacing:-0.01em;">
                ${heading}
              </h1>
              <p style="margin:0 0 16px;font-size:15px;color:#e6e6e6;line-height:1.6;">
                Hi ${firstName},
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#e6e6e6;line-height:1.6;">
                ${lede}
              </p>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
                <tr>
                  <td align="left" style="background:#0094a0;border-radius:8px;">
                    <a href="${actionUrl}"
                       style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.01em;border-radius:8px;">
                      ${cta}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:0 0 16px;font-size:12px;color:rgba(200,210,230,0.45);line-height:1.6;">
                If the button doesn't work, paste this link into your browser:<br />
                <a href="${actionUrl}" style="color:#00b8c8;word-break:break-all;">${actionUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:rgba(200,210,230,0.35);line-height:1.6;">
                You're receiving this because you're enrolled in an active Upskilling Labs cycle. If you'd prefer to step away, no action needed — your access will pause automatically.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function revocationWarningText({
  reason,
  actionUrl,
  firstName,
}: WarningProps): string {
  const { heading } = variantCopy(reason);
  return `${heading}

Hi ${firstName},

${variantTextLede(reason)}

Open the platform here:
${actionUrl}

You're receiving this because you're enrolled in an active Upskilling Labs cycle. If you'd prefer to step away, no action needed — your access will pause automatically.`;
}
