/* The Leadership Log reminder (docs/ORG_CYCLES.md §4a) — a day-aware nudge to
   the org lead tiers on their target day (workstream leads Thursday, lab leads
   Friday). NON-BLOCKING: unlike the Learning Log reminder there is NO "your
   account is parked" language — the leadership log never locks the dashboard.
   One email per lead per run of the reminder. */

type Tier = "workstream_lead" | "lab_lead";

/** Joins names into prose: "A" · "A and B" · "A, B, and C". */
export function formatScopeList(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

const noun = (tier: Tier) => (tier === "lab_lead" ? "lab" : "workstream");

export function leadershipReminderSubject(tier: Tier): string {
  return tier === "lab_lead"
    ? "Your Lab Leadership Log is due"
    : "Your Workstream Leadership Log is due";
}

export function leadershipReminderEmailHtml({
  dashboardUrl,
  tier,
  scopeNames,
}: {
  dashboardUrl: string;
  tier: Tier;
  scopeNames: string[];
}): string {
  const list = formatScopeList(scopeNames);
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F6F4EF;font-family:Helvetica,Arial,sans-serif;color:#00141B;">
    <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
      <h1 style="font-size:22px;line-height:28px;margin:0 0 12px;">Your Leadership Log for ${list} is ready</h1>
      <p style="font-size:15px;line-height:24px;margin:0 0 12px;color:#4A5557;">
        A quick weekly reflection on your ${noun(tier)} — how it&rsquo;s going,
        what&rsquo;s in the way, and what you need. It sits next to your team&rsquo;s
        own logs from this week, so you&rsquo;re writing with their words in front
        of you. Five minutes.
      </p>
      <p style="margin:24px 0;">
        <a href="${dashboardUrl}"
           style="display:inline-block;background:#007882;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:14px;">
          Write your log
        </a>
      </p>
      <p style="font-size:13px;line-height:20px;color:#748083;margin:24px 0 0;">
        This one never locks your dashboard — it&rsquo;s how HQ hears from the
        people running the work.
      </p>
    </div>
  </body>
</html>`;
}

export function leadershipReminderEmailText({
  dashboardUrl,
  tier,
  scopeNames,
}: {
  dashboardUrl: string;
  tier: Tier;
  scopeNames: string[];
}): string {
  const list = formatScopeList(scopeNames);
  return [
    `Your Leadership Log for ${list} is ready`,
    "",
    `A quick weekly reflection on your ${noun(tier)} — how it's going, what's in`,
    "the way, and what you need. It sits next to your team's own logs from this",
    "week, so you're writing with their words in front of you. Five minutes.",
    "",
    `Write your log: ${dashboardUrl}`,
    "",
    "This one never locks your dashboard — it's how HQ hears from the people",
    "running the work.",
  ].join("\n");
}
