/* Slack integration (issue #189) — server-side only. SLACK_BOT_TOKEN must
   never reach the client.

   Mirrors the Luma integration (lib/integrations/luma.ts): env-gated so an
   absent token makes every Slack path a quiet no-op, `fetch` with header auth,
   defensive shape parsing, best-effort — a Slack hiccup must never throw into a
   member's request path (callers wrap these in try/catch and collect errors[]).

   We hand-roll the Web API over `fetch` (no @slack/web-api dependency) to match
   the Luma precedent. Every Web API method returns `{ ok: boolean, error?, … }`;
   a falsy `ok` (or a non-2xx) surfaces as a thrown Error the caller handles.

   The API base is overridable for the same reason Luma's is — so a test or a
   proxy can point elsewhere without a deploy. */

const SLACK_API_BASE = process.env.SLACK_API_BASE || "https://slack.com/api";

export function slackEnabled(): boolean {
  return Boolean(process.env.SLACK_BOT_TOKEN);
}

function authHeader(): string {
  return `Bearer ${process.env.SLACK_BOT_TOKEN as string}`;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/* Write methods (chat.postMessage, views.open, conversations.open) accept a
   JSON body with a bearer token. */
async function slackPost(
  method: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(`${SLACK_API_BASE}/${method}`, {
    method: "POST",
    headers: {
      authorization: authHeader(),
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = asRecord(await res.json().catch(() => null)) ?? {};
  if (!res.ok || data.ok !== true) {
    const err = typeof data.error === "string" ? data.error : `http_${res.status}`;
    throw new Error(`Slack ${method} failed: ${err}`);
  }
  return data;
}

/* Read methods (users.lookupByEmail, conversations.history) take query params,
   not a JSON body. */
async function slackGet(
  method: string,
  params: Record<string, string>
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${SLACK_API_BASE}/${method}?${qs}`, {
    headers: { authorization: authHeader() },
    cache: "no-store",
  });
  const data = asRecord(await res.json().catch(() => null)) ?? {};
  if (!res.ok || data.ok !== true) {
    const err = typeof data.error === "string" ? data.error : `http_${res.status}`;
    throw new Error(`Slack ${method} failed: ${err}`);
  }
  return data;
}

/* Resolve a member's Slack user id from their email. Returns null when Slack
   has no such user (an expected "no match", not an error) so the verification
   loop can carry on; other failures (bad token, rate limit) throw. */
export async function lookupUserByEmail(email: string): Promise<string | null> {
  try {
    const data = await slackGet("users.lookupByEmail", { email });
    const user = asRecord(data.user);
    return user && typeof user.id === "string" ? user.id : null;
  } catch (e) {
    if (e instanceof Error && e.message.includes("users_not_found")) return null;
    throw e;
  }
}

/* Open (or reuse) the bot's DM channel with a user and return its channel id. */
export async function openDm(slackUserId: string): Promise<string> {
  const data = await slackPost("conversations.open", { users: slackUserId });
  const channel = asRecord(data.channel);
  const id = channel && typeof channel.id === "string" ? channel.id : null;
  if (!id) throw new Error("Slack conversations.open returned no channel id");
  return id;
}

export async function postMessage(
  channel: string,
  text: string,
  blocks?: unknown[]
): Promise<void> {
  await slackPost(
    "chat.postMessage",
    blocks ? { channel, text, blocks } : { channel, text }
  );
}

/* Convenience: DM a user by their Slack id (open channel + post). */
export async function sendDirectMessage(
  slackUserId: string,
  text: string,
  blocks?: unknown[]
): Promise<void> {
  const channel = await openDm(slackUserId);
  await postMessage(channel, text, blocks);
}

/* Open a modal in response to a slash command. `view` is a Block Kit modal. */
export async function openModal(
  triggerId: string,
  view: unknown
): Promise<void> {
  await slackPost("views.open", { trigger_id: triggerId, view });
}

/* The set of Slack user ids who authored a real (non-system) message in a
   channel since `oldestTs`. One paginated read per verification run; callers
   then match many participants against the set — the same "fetch once, then
   reconcile" shape as Luma's guest-list sync. Channel-join and other subtyped
   messages are skipped so only a human intro post counts. */
export async function getChannelAuthorIds(
  channelId: string,
  oldestTs?: string
): Promise<Set<string>> {
  const authors = new Set<string>();
  let cursor: string | null = null;

  // Page cap is a runaway guard, not a throughput concern.
  for (let page = 0; page < 50; page++) {
    const params: Record<string, string> = { channel: channelId, limit: "200" };
    if (oldestTs) params.oldest = oldestTs;
    if (cursor) params.cursor = cursor;

    const data = await slackGet("conversations.history", params);
    const messages = Array.isArray(data.messages) ? data.messages : [];
    for (const m of messages) {
      const rec = asRecord(m);
      if (rec && typeof rec.user === "string" && !rec.subtype) {
        authors.add(rec.user);
      }
    }

    const meta = asRecord(data.response_metadata);
    cursor =
      meta && typeof meta.next_cursor === "string" && meta.next_cursor
        ? meta.next_cursor
        : null;
    if (!cursor) break;
  }

  return authors;
}
