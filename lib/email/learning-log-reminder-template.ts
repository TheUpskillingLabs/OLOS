/* The Learning Log reminder — sent once per window, the first morning
   after the Friday cron arms the gate (Phase 1; replaces the pulse-check
   reminder ladder). One email, plain speech, never shaming: the gate is
   firm and instant to clear, and this says exactly that. */

export function logReminderSubject(): string {
  return "Your weekly Learning Log is due";
}

export function logReminderEmailHtml({
  dashboardUrl,
}: {
  dashboardUrl: string;
}): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F6F4EF;font-family:Helvetica,Arial,sans-serif;color:#00141B;">
    <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
      <h1 style="font-size:22px;line-height:28px;margin:0 0 12px;">Your weekly Learning Log is due</h1>
      <p style="font-size:15px;line-height:24px;margin:0 0 12px;color:#4A5557;">
        Two sliders, three quick prompts — five minutes, tops. Until you save
        one, your Labs account is parked on the dashboard. Save it and
        you&rsquo;re back in, instantly.
      </p>
      <p style="margin:24px 0;">
        <a href="${dashboardUrl}"
           style="display:inline-block;background:#007882;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:14px;">
          Save your log
        </a>
      </p>
      <p style="font-size:13px;line-height:20px;color:#748083;margin:24px 0 0;">
        Stuck on something? Say so in the log — the &ldquo;I&rsquo;m blocked&rdquo;
        note goes straight to your Poderator. That&rsquo;s always okay.
      </p>
    </div>
  </body>
</html>`;
}

export function logReminderEmailText({
  dashboardUrl,
}: {
  dashboardUrl: string;
}): string {
  return [
    "Your weekly Learning Log is due",
    "",
    "Two sliders, three quick prompts — five minutes, tops. Until you save",
    "one, your Labs account is parked on the dashboard. Save it and you're",
    "back in, instantly.",
    "",
    `Save your log: ${dashboardUrl}`,
    "",
    "Stuck on something? Say so in the log — the \"I'm blocked\" note goes",
    "straight to your Poderator. That's always okay.",
  ].join("\n");
}
