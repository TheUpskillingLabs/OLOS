/* Post one message to a Slack channel through the bot (chat.postMessage).

   Staff-facing only (coordinator and admin channels). OLOS does not DM members
   from here: that needs the Slack identity work in ADR-0003 and each person's
   consent. A channel is opted into by joining it.

   Safe by default, like the email drip:
     - Off unless SLACK_NOTIFY_ENABLED is exactly "true". Off, it logs what it
       would have sent and returns { sent: false, reason: "dry_run" }.
     - Never throws. A Slack outage must not fail a coordinator's request, so the
       result says what happened and the caller ignores it.

   Env: SLACK_BOT_TOKEN (xoxb-…, scope chat:write, bot invited to the channel),
   SLACK_NOTIFY_ENABLED. Channel ids are set by the caller's feature. */

export type SlackPostResult = { sent: true } | { sent: false; reason: "dry_run" | "no_token" | "no_channel" | "slack_error" | "network" };

const TIMEOUT_MS = 4000;

export async function postToSlack(channel: string | undefined, text: string): Promise<SlackPostResult> {
  if (!channel) return { sent: false, reason: "no_channel" };
  if (process.env.SLACK_NOTIFY_ENABLED !== "true") {
    console.info(`[slack:dry-run] #${channel}: ${text}`);
    return { sent: false, reason: "dry_run" };
  }
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return { sent: false, reason: "no_token" };

  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ channel, text, unfurl_links: false, unfurl_media: false }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      console.error(`[slack] post failed: ${json?.error ?? res.status}`);
      return { sent: false, reason: "slack_error" };
    }
    return { sent: true };
  } catch (e) {
    console.error("[slack] post failed:", e instanceof Error ? e.message : e);
    return { sent: false, reason: "network" };
  }
}
