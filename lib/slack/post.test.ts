import { afterEach, describe, expect, it, vi } from "vitest";
import { postToSlack } from "./post";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("postToSlack", () => {
  it("does nothing without a channel", async () => {
    expect(await postToSlack(undefined, "hi")).toEqual({ sent: false, reason: "no_channel" });
  });

  it("is a dry run unless SLACK_NOTIFY_ENABLED is exactly true", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.stubEnv("SLACK_NOTIFY_ENABLED", "1");
    expect(await postToSlack("C1", "hi")).toEqual({ sent: false, reason: "dry_run" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("needs a token once enabled", async () => {
    vi.stubEnv("SLACK_NOTIFY_ENABLED", "true");
    vi.stubEnv("SLACK_BOT_TOKEN", "");
    expect(await postToSlack("C1", "hi")).toEqual({ sent: false, reason: "no_token" });
  });

  it("posts with the bot token and reports success", async () => {
    vi.stubEnv("SLACK_NOTIFY_ENABLED", "true");
    vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await postToSlack("C1", "hi")).toEqual({ sent: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://slack.com/api/chat.postMessage");
    expect(init.headers.Authorization).toBe("Bearer xoxb-test");
    expect(JSON.parse(init.body)).toMatchObject({ channel: "C1", text: "hi" });
  });

  it("never throws: a Slack error or network failure is reported", async () => {
    vi.stubEnv("SLACK_NOTIFY_ENABLED", "true");
    vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: false, error: "not_in_channel" }) }));
    expect(await postToSlack("C1", "hi")).toEqual({ sent: false, reason: "slack_error" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    expect(await postToSlack("C1", "hi")).toEqual({ sent: false, reason: "network" });
  });
});
