import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifySlackSignature } from "@/lib/integrations/slack-signature";
import { learningLogSchema } from "@/lib/validations/learning-logs";
import { createLearningLog } from "@/lib/learning-logs/logs";
import {
  parseLearningLogModalState,
  MODAL_ERROR_BLOCK,
} from "@/lib/integrations/slack-messages";

/* Slack interactivity endpoint (issue #189) — receives the Learning Log modal
   submission opened by /learninglog. Like the slash command it authenticates
   via the Slack signature over the RAW body, then maps the submitting Slack
   user to a participant and reuses createLearningLog (the same path as the web
   form). A `view_submission` response of empty 200 closes the modal;
   `{ response_action: "errors", … }` keeps it open with inline errors. */

interface SlackElementState {
  value?: string;
  selected_option?: { value?: string } | null;
  selected_options?: { value?: string }[];
}
interface ViewSubmissionPayload {
  type?: string;
  user?: { id?: string };
  view?: {
    callback_id?: string;
    state?: { values?: Record<string, Record<string, SlackElementState>> };
  };
}

// Fresh response per request — a Response object must not be reused/shared.
const ack = () => new NextResponse(null, { status: 200 });

function modalError(message: string): NextResponse {
  return NextResponse.json({
    response_action: "errors",
    errors: { [MODAL_ERROR_BLOCK]: message },
  });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const ok = verifySlackSignature({
    signingSecret: process.env.SLACK_SIGNING_SECRET ?? "",
    rawBody,
    timestamp: request.headers.get("x-slack-request-timestamp"),
    signature: request.headers.get("x-slack-signature"),
  });
  if (!ok) return new NextResponse("invalid signature", { status: 401 });

  const params = new URLSearchParams(rawBody);
  const payloadRaw = params.get("payload");
  if (!payloadRaw) return ack();

  let payload: ViewSubmissionPayload;
  try {
    payload = JSON.parse(payloadRaw) as ViewSubmissionPayload;
  } catch {
    return ack();
  }

  // Only the Learning Log submission is handled; ignore everything else.
  if (
    payload.type !== "view_submission" ||
    payload.view?.callback_id !== "learning_log_submit"
  ) {
    return ack();
  }

  const slackUserId = payload.user?.id;
  if (!slackUserId) return modalError("Couldn't read your Slack identity.");

  const service = createServiceClient();
  const { data: participant } = await service
    .from("participants")
    .select("id")
    .eq("slack_user_id", slackUserId)
    .maybeSingle();
  if (!participant) {
    return modalError(
      "We couldn't link your Slack account to OLOS. Join the Slack with your OLOS email and try again after the next sync."
    );
  }

  const raw = parseLearningLogModalState(payload.view?.state?.values ?? {});
  const parsed = learningLogSchema.safeParse(raw);
  if (!parsed.success) {
    return modalError("Please set clarity and alignment (1–5) before saving.");
  }

  try {
    await createLearningLog(participant.id as number, parsed.data);
  } catch (e) {
    console.error(
      "[slack-interactivity] create failed:",
      e instanceof Error ? e.message : e
    );
    return modalError("Something went wrong saving your log. Try again.");
  }

  // Empty 200 closes the modal.
  return ack();
}
