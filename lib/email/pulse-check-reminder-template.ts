export type PulseReminderVariant = "three_day" | "one_day" | "final";

type PulseReminderProps = {
  variant: PulseReminderVariant;
  pulseCheckUrl: string;
};

function variantCopy(variant: PulseReminderVariant): {
  subject: string;
  heading: string;
  lede: string;
  cta: string;
} {
  switch (variant) {
    case "three_day":
      return {
        subject: "Pulse check due in 3 days",
        heading: "Quick check-in coming up",
        lede: "Your weekly pulse check is due in <strong style=\"color:#ffffff;\">3 days</strong>. It's a couple of minutes — what you learned, what's working, what got in the way.",
        cta: "Submit pulse check →",
      };
    case "one_day":
      return {
        subject: "Pulse check due tomorrow",
        heading: "One more day",
        lede: "Your weekly pulse check is due <strong style=\"color:#ffffff;\">tomorrow</strong>. Take two minutes now and it's off your plate.",
        cta: "Submit pulse check →",
      };
    case "final":
      return {
        subject: "Pulse check overdue",
        heading: "Pulse check overdue",
        lede: "Your weekly pulse check is now overdue. Submitting today keeps you active in your cohort and helps your moderator know how to support you.",
        cta: "Submit pulse check →",
      };
  }
}

function variantTextLede(variant: PulseReminderVariant): string {
  switch (variant) {
    case "three_day":
      return "Your weekly pulse check is due in 3 days. It's a couple of minutes — what you learned, what's working, what got in the way.";
    case "one_day":
      return "Your weekly pulse check is due tomorrow. Take two minutes now and it's off your plate.";
    case "final":
      return "Your weekly pulse check is now overdue. Submitting today keeps you active in your cohort and helps your moderator know how to support you.";
  }
}

export function pulseReminderEmailHtml({
  variant,
  pulseCheckUrl,
}: PulseReminderProps): string {
  const { heading, lede, cta } = variantCopy(variant);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f1117;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <!-- Logo / wordmark -->
          <tr>
            <td style="padding-bottom:32px;">
              <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">
                The Upskilling Labs
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#1a1d27;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:40px 36px;">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">
                ${heading}
              </h1>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:rgba(200,210,230,0.75);">
                ${lede}
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="border-radius:8px;background-color:#0094a0;">
                    <a href="${pulseCheckUrl}"
                       style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.01em;border-radius:8px;">
                      ${cta}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:0 0 16px;font-size:12px;color:rgba(200,210,230,0.45);line-height:1.6;">
                If the button doesn't work, paste this link into your browser:<br />
                <a href="${pulseCheckUrl}" style="color:#00b8c8;word-break:break-all;">${pulseCheckUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:rgba(200,210,230,0.35);line-height:1.6;">
                You're receiving this because you're an active participant in an Upskilling Labs cycle.
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

export function pulseReminderEmailText({
  variant,
  pulseCheckUrl,
}: PulseReminderProps): string {
  const { heading } = variantCopy(variant);
  return `${heading}

${variantTextLede(variant)}

Submit your pulse check here:
${pulseCheckUrl}

You're receiving this because you're an active participant in an Upskilling Labs cycle.`;
}

export function pulseReminderSubject(variant: PulseReminderVariant): string {
  return variantCopy(variant).subject;
}
