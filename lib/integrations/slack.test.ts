import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  slackEnabled,
  lookupUserByEmail,
  getChannelAuthorIds,
} from "./slack";

/* Mock a single global `fetch` returning one JSON payload. `httpOk` is the
   transport-level res.ok; the Slack-level `ok` lives inside the JSON body. */
function stubFetch(json: unknown, httpOk = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: httpOk,
      status,
      json: async () => json,
    })
  );
}

describe("slackEnabled", () => {
  const prev = process.env.SLACK_BOT_TOKEN;
  afterEach(() => {
    if (prev === undefined) delete process.env.SLACK_BOT_TOKEN;
    else process.env.SLACK_BOT_TOKEN = prev;
  });

  it("is false without a token", () => {
    delete process.env.SLACK_BOT_TOKEN;
    expect(slackEnabled()).toBe(false);
  });

  it("is true with a token", () => {
    process.env.SLACK_BOT_TOKEN = "xoxb-test";
    expect(slackEnabled()).toBe(true);
  });
});

describe("lookupUserByEmail", () => {
  beforeEach(() => {
    process.env.SLACK_BOT_TOKEN = "xoxb-test";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns the user id on a match", async () => {
    stubFetch({ ok: true, user: { id: "U123" } });
    expect(await lookupUserByEmail("a@b.com")).toBe("U123");
  });

  it("returns null when Slack reports users_not_found", async () => {
    stubFetch({ ok: false, error: "users_not_found" });
    expect(await lookupUserByEmail("nobody@b.com")).toBeNull();
  });

  it("throws on other Slack errors (bad token, rate limit)", async () => {
    stubFetch({ ok: false, error: "invalid_auth" });
    await expect(lookupUserByEmail("a@b.com")).rejects.toThrow(/invalid_auth/);
  });
});

describe("getChannelAuthorIds", () => {
  beforeEach(() => {
    process.env.SLACK_BOT_TOKEN = "xoxb-test";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("collects distinct human author ids and skips subtyped/system messages", async () => {
    stubFetch({
      ok: true,
      messages: [
        { user: "U1", text: "hi, I'm Alice" },
        { user: "U2", text: "hey all" },
        { user: "U1", text: "second post" },
        { user: "U3", subtype: "channel_join", text: "has joined" },
        { subtype: "bot_message", text: "reminder" },
      ],
      response_metadata: { next_cursor: "" },
    });
    const ids = await getChannelAuthorIds("C1");
    expect([...ids].sort()).toEqual(["U1", "U2"]);
  });

  it("returns an empty set for an empty channel", async () => {
    stubFetch({ ok: true, messages: [], response_metadata: { next_cursor: "" } });
    const ids = await getChannelAuthorIds("C1");
    expect(ids.size).toBe(0);
  });
});
