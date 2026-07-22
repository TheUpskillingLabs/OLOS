/* The Learning Log reminder — sent once per window, the first morning
   after the Friday cron arms the gate (Phase 1; replaces the pulse-check
   reminder ladder). One email per participant per run, plain speech,
   never shaming: the gate is firm and instant to clear, and this says
   exactly that. Org cycles (migration 00060) mean a dual-enrolled member
   can have more than one cycle due at once — B-4 names every due cycle in
   the single email instead of sending a generic, unnamed nag. */

/** Joins cycle names into human prose: "A" · "A and B" · "A, B, and C". */
export function formatCycleList(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function logReminderSubject(cycleNames: string[]): string {
  return `Your Learning Log for ${formatCycleList(cycleNames)} is due`;
}

export function logReminderEmailHtml({
  dashboardUrl,
  cycleNames,
}: {
  dashboardUrl: string;
  cycleNames: string[];
}): string {
  const cycleList = formatCycleList(cycleNames);
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F6F4EF;font-family:Helvetica,Arial,sans-serif;color:#00141B;">
    <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
      <h1 style="font-size:22px;line-height:28px;margin:0 0 12px;">Your Learning Log for ${cycleList} is due</h1>
      <p style="font-size:15px;line-height:24px;margin:0 0 12px;color:#4A5557;">
        A few quick questions — five minutes, tops. Until you save one for
        ${cycleList}, your Labs account is parked on the dashboard.
        Save it and you&rsquo;re back in, instantly.
      </p>
      <p style="margin:24px 0;">
        <a href="${dashboardUrl}"
           style="display:inline-block;background:#007882;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:14px;">
          Save your log
        </a>
      </p>
      <p style="font-size:13px;line-height:20px;color:#748083;margin:24px 0 0;">
        Stuck on something? Say so in the log — what you&rsquo;ve tried and
        what would help goes straight to your Poderator. That&rsquo;s always
        okay.
      </p>
    </div>
  </body>
</html>`;
}

export function logReminderEmailText({
  dashboardUrl,
  cycleNames,
}: {
  dashboardUrl: string;
  cycleNames: string[];
}): string {
  const cycleList = formatCycleList(cycleNames);
  return [
    `Your Learning Log for ${cycleList} is due`,
    "",
    `A few quick questions — five minutes, tops. Until you save one for`,
    `${cycleList}, your Labs account is parked on the dashboard.`,
    "Save it and you're back in, instantly.",
    "",
    `Save your log: ${dashboardUrl}`,
    "",
    "Stuck on something? Say so in the log — what you've tried and what",
    "would help goes straight to your Poderator. That's always okay.",
  ].join("\n");
}
