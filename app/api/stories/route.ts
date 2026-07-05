import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { hashIp, requestIp, windowStart } from "@/lib/api/rate-limit";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { storySubmissionSchema } from "@/lib/validations/story-submission";

// Share your story (onboarding-proto's stories.html share modal). Public and
// unauthenticated: a submission lands as a spotlights row with
// status='submitted' — only name + story filled. The Labs team enriches the
// editorial fields and publishes from /admin/stories; nothing here goes live
// automatically (owner decision, concierge review). Per-IP throttle mirrors
// the event RSVP endpoint (lib/api/rate-limit).
const STORY_LIMIT = 3;
const STORY_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const ipHash = hashIp(requestIp(request));

  const { count } = await supabase
    .from("spotlights")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", windowStart(STORY_WINDOW_MS));
  if ((count ?? 0) >= STORY_LIMIT) {
    return NextResponse.json(
      { error: "Thanks — you've already sent a few. Try again a little later." },
      { status: 429 }
    );
  }

  const body = await parseBody(request, storySubmissionSchema);
  if (isErrorResponse(body)) return body;

  const email = body.email ? body.email.toLowerCase() : null;
  const { error } = await supabase.from("spotlights").insert({
    name: body.name,
    story: [body.story],
    submitter_email: email,
    status: "submitted",
    ip_hash: ipHash,
  });
  if (error) return dbError(error, "story-submit");

  return NextResponse.json({ submitted: true }, { status: 201 });
}
