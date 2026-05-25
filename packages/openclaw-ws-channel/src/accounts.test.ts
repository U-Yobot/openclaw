import { describe, it, expect } from "vitest";
import { resolveWsChannelAccount } from "./accounts.js";
import type { CoreConfig } from "./types.js";

describe("resolveWsChannelAccount", () => {
  it("returns configured=false when bridgeUrl missing", () => {
    const cfg: CoreConfig = {};
    const account = resolveWsChannelAccount({ cfg, accountId: "default" });
    expect(account.configured).toBe(false);
  });

  it("returns configured=false when bridgeSecret missing", () => {
    const cfg: CoreConfig = {
      channels: { "ws-channel": { bridgeUrl: "http://localhost:8766" } },
    };
    const account = resolveWsChannelAccount({ cfg, accountId: "default" });
    expect(account.configured).toBe(false);
  });

  it("returns configured=true when both bridgeUrl and bridgeSecret are set", () => {
    const cfg: CoreConfig = {
      channels: {
        "ws-channel": {
          bridgeUrl: "http://localhost:8766",
          bridgeSecret: "s3cr3t",
        },
      },
    };
    const account = resolveWsChannelAccount({ cfg, accountId: "default" });
    expect(account.configured).toBe(true);
    expect(account.bridgeUrl).toBe("http://localhost:8766");
    expect(account.bridgeSecret).toBe("s3cr3t");
  });

  it("defaults pollTimeoutMs to 10000", () => {
    const cfg: CoreConfig = {
      channels: {
        "ws-channel": { bridgeUrl: "http://localhost:8766", bridgeSecret: "s" },
      },
    };
    const account = resolveWsChannelAccount({ cfg, accountId: "default" });
    expect(account.pollTimeoutMs).toBe(10_000);
  });

  it("respects enabled=false at top level", () => {
    const cfg: CoreConfig = {
      channels: {
        "ws-channel": {
          enabled: false,
          bridgeUrl: "http://localhost:8766",
          bridgeSecret: "s",
        },
      },
    };
    const account = resolveWsChannelAccount({ cfg, accountId: "default" });
    expect(account.enabled).toBe(false);
  });

  it("defaults allowFrom to ['*']", () => {
    const cfg: CoreConfig = {
      channels: {
        "ws-channel": { bridgeUrl: "http://localhost:8766", bridgeSecret: "s" },
      },
    };
    const account = resolveWsChannelAccount({ cfg, accountId: "default" });
    expect(account.config.allowFrom).toEqual(["*"]);
  });
});
