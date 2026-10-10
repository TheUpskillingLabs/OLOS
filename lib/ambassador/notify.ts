import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { postToSlack } from "@/lib/slack/post";
import { coordinatorMessage, type CoordinatorEvent } from "./notify-message";

/* Tell the coordinators' Slack channel that something is waiting. Runs after the
   response (next/server `after`), so it never slows or fails a request. Words:
   notify-message.ts. Transport and dry-run default: lib/slack/post.ts.
   Env: SLACK_AMBASSADOR_CHANNEL_ID (the channel id, e.g. C0123456789). */

export function notifyCoordinators(event: CoordinatorEvent, labId: number | null): void {
  const channel = process.env.SLACK_AMBASSADOR_CHANNEL_ID;
  after(async () => {
    let labName: string | null = null;
    if (labId != null) {
      const { data } = await createServiceClient().from("metros").select("name").eq("id", labId).maybeSingle();
      labName = (data?.name as string | undefined) ?? null;
    }
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://theupskillinglabs.org";
    await postToSlack(channel, coordinatorMessage(event, { labName, baseUrl }));
  });
}
