type AlreadyRegisteredEmailProps = {
  loginUrl: string;
};

export function alreadyRegisteredHtml({
  loginUrl,
}: AlreadyRegisteredEmailProps): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>The Upskilling Labs</title>
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
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">
                You already have an account
              </h1>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:rgba(200,210,230,0.75);">
                It looks like you've already registered with The Upskilling Labs.
                You can sign in anytime to access your dashboard.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="border-radius:8px;background-color:#0094a0;">
                    <a href="${loginUrl}"
                       style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.01em;border-radius:8px;">
                      Sign in &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 16px;font-size:12px;color:rgba(200,210,230,0.45);line-height:1.6;">
                If the button doesn't work, paste this link into your browser:<br />
                <a href="${loginUrl}" style="color:#00b8c8;word-break:break-all;">${loginUrl}</a>
              </p>
              <p style="margin:0;font-size:12px;color:rgba(200,210,230,0.45);line-height:1.6;border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;">
                If you didn't attempt to register, you can safely ignore this email.
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

export function alreadyRegisteredText({
  loginUrl,
}: AlreadyRegisteredEmailProps): string {
  return `You already have an account at The Upskilling Labs.

You can sign in anytime to access your dashboard:
${loginUrl}

If you didn't attempt to register, you can safely ignore this email.`;
}
