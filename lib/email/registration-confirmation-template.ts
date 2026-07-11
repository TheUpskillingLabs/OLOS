type RegistrationEmailProps = {
  firstName: string;
  cycleName?: string | null;
  cycleJoinUrl?: string | null;
};

export function registrationConfirmationHtml({
  firstName,
  cycleName,
  cycleJoinUrl,
}: RegistrationEmailProps): string {
  const hasActiveCycle = cycleName && cycleJoinUrl;

  const bodyContent = hasActiveCycle
    ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:rgba(200,210,230,0.85);">
        Hello <strong style="color:#ffffff;">${firstName}</strong>,
      </p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:rgba(200,210,230,0.75);">
        We received your registration to The Upskilling Labs.
      </p>
      <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:rgba(200,210,230,0.75);">
        If you would like to join the current cycle, <strong style="color:#ffffff;">${cycleName}</strong>, please complete the form by clicking the button below, and then choose your pods.
      </p>
      <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
        <tr>
          <td style="border-radius:8px;background-color:#0094a0;">
            <a href="${cycleJoinUrl}"
               style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.01em;border-radius:8px;">
              Complete the form
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 24px;font-size:12px;color:rgba(200,210,230,0.45);line-height:1.6;">
        If the button doesn't work, paste this link into your browser:<br />
        <a href="${cycleJoinUrl}" style="color:#00b8c8;word-break:break-all;">${cycleJoinUrl}</a>
      </p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:rgba(200,210,230,0.75);">
        If you have any questions, please write to <a href="mailto:olos-help@theupskillinglabs.org" style="color:#00b8c8;">olos-help@theupskillinglabs.org</a> and we will be glad to help.
      </p>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:rgba(200,210,230,0.75);">
        Best regards,<br />
        The Upskilling Labs team
      </p>`
    : `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:rgba(200,210,230,0.85);">
        Hello <strong style="color:#ffffff;">${firstName}</strong>,
      </p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:rgba(200,210,230,0.75);">
        We received your registration to The Upskilling Labs.
      </p>
      <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:rgba(200,210,230,0.75);">
        There is no Build Cycle currently open for new participants. We will email you when the next cycle opens, and you will be able to join from there.
      </p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:rgba(200,210,230,0.75);">
        If you have any questions, please write to <a href="mailto:olos-help@theupskillinglabs.org" style="color:#00b8c8;">olos-help@theupskillinglabs.org</a> and we will be glad to help.
      </p>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:rgba(200,210,230,0.75);">
        Best regards,<br />
        The Upskilling Labs team
      </p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to The Upskilling Labs</title>
</head>
<body style="margin:0;padding:0;background-color:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f1117;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="padding-bottom:32px;">
              <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">
                The Upskilling Labs
              </span>
            </td>
          </tr>
          <tr>
            <td style="background-color:#1a1d27;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:40px 36px;">
              ${bodyContent}
              <p style="margin:0;font-size:12px;color:rgba(200,210,230,0.45);line-height:1.6;border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;">
                You received this email because you registered at The Upskilling Labs.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:rgba(200,210,230,0.35);line-height:1.6;">
                If you didn't register, you can safely ignore this email.
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

export function registrationConfirmationText({
  firstName,
  cycleName,
  cycleJoinUrl,
}: RegistrationEmailProps): string {
  if (cycleName && cycleJoinUrl) {
    return `Hello ${firstName},

We received your registration to The Upskilling Labs.

If you would like to join the current cycle, ${cycleName}, please complete the form using the link below, and then choose your pods.

Complete the form: ${cycleJoinUrl}

If you have any questions, please write to olos-help@theupskillinglabs.org and we will be glad to help.

Best regards,
The Upskilling Labs team

You received this email because you registered at The Upskilling Labs.
If you didn't register, you can safely ignore this email.`;
  }

  return `Hello ${firstName},

We received your registration to The Upskilling Labs.

There is no Build Cycle currently open for new participants. We will email you when the next cycle opens, and you will be able to join from there.

If you have any questions, please write to olos-help@theupskillinglabs.org and we will be glad to help.

Best regards,
The Upskilling Labs team

You received this email because you registered at The Upskilling Labs.
If you didn't register, you can safely ignore this email.`;
}
