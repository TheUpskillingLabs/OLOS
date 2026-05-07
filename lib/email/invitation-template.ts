type InvitationEmailProps = {
  magicLink: string;
  rolePreset?: string | null;
  cycleName?: string | null;
};

export function invitationEmailHtml({
  magicLink,
  rolePreset,
  cycleName,
}: InvitationEmailProps): string {
  const roleLabel = rolePreset
    ? rolePreset.charAt(0).toUpperCase() + rolePreset.slice(1)
    : null;

  const contextLine = cycleName
    ? `You've been invited to join <strong>${cycleName}</strong>${roleLabel ? ` as a <strong>${roleLabel}</strong>` : ""}.`
    : roleLabel
      ? `You've been invited to join as a <strong>${roleLabel}</strong>.`
      : "You've been invited to join The Upskilling Labs.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're invited to The Upskilling Labs</title>
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
                You're invited
              </h1>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:rgba(200,210,230,0.75);">
                ${contextLine}
                <br /><br />
                Click the button below to accept your invitation and set up your account. This link expires in <strong style="color:#ffffff;">7 days</strong>.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="border-radius:8px;background-color:#0094a0;">
                    <a href="${magicLink}"
                       style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.01em;border-radius:8px;">
                      Accept invitation →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:0 0 16px;font-size:12px;color:rgba(200,210,230,0.45);line-height:1.6;">
                If the button doesn't work, paste this link into your browser:<br />
                <a href="${magicLink}" style="color:#00b8c8;word-break:break-all;">${magicLink}</a>
              </p>

              <!-- Google login note -->
              <p style="margin:0;font-size:12px;color:rgba(200,210,230,0.45);line-height:1.6;border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;">
                Note: you can only sign in using a Google-hosted email address (Gmail or Google Workspace).
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:rgba(200,210,230,0.35);line-height:1.6;">
                You received this email because an admin sent you an invitation.
                If you weren't expecting this, you can safely ignore it.
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

export function invitationEmailText({
  magicLink,
  rolePreset,
  cycleName,
}: InvitationEmailProps): string {
  const roleLabel = rolePreset
    ? rolePreset.charAt(0).toUpperCase() + rolePreset.slice(1)
    : null;

  const contextLine = cycleName
    ? `You've been invited to join ${cycleName}${roleLabel ? ` as a ${roleLabel}` : ""}.`
    : roleLabel
      ? `You've been invited to join as a ${roleLabel}.`
      : "You've been invited to join The Upskilling Labs.";

  return `You're invited to The Upskilling Labs

${contextLine}

Accept your invitation here (expires in 7 days):
${magicLink}

Note: you can only sign in using a Google-hosted email address (Gmail or Google Workspace).

If you weren't expecting this email, you can safely ignore it.`;
}
