import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendWsChannelReply } from "./outbound.js";
import type { ResolvedWsChannelAccount } from "./types.js";

const account: ResolvedWsChannelAccount = {
  accountId: "default",
  enabled: true,
  configured: true,
  bridgeUrl: "http://localhost:8766",
  bridgeSecret: "secret",
  pollTimeoutMs: 10_000,
  config: { allowFrom: ["*"] },
};

describe("sendWsChannelReply", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("POSTs to /outbound with correct URL and auth header", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }));
    await sendWsChannelReply({ account, sessionId: "s1", text: "hello", messageId: "r1" });
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8766/outbound",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer secret" }),
      }),
    );
  });

  it("sends correct JSON body", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }));
    await sendWsChannelReply({ account, sessionId: "s1", text: "hello", messageId: "r1" });
    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(call[1]?.body as string);
    expect(body).toEqual({ accountId: "default", sessionId: "s1", text: "hello", messageId: "r1" });
  });

  it("throws on non-ok HTTP response", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 500 }));
    await expect(
      sendWsChannelReply({ account, sessionId: "s1", text: "hi", messageId: "r1" }),
    ).rejects.toThrow("Bridge outbound failed: 500");
  });
});
