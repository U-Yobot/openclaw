import {
  buildChannelOutboundSessionRoute,
  createChatChannelPlugin,
} from "openclaw/plugin-sdk/channel-core";
import type { ChannelPlugin } from "openclaw/plugin-sdk/channel-core";
import { getChatChannelMeta } from "openclaw/plugin-sdk/channel-plugin-common";
import {
  DEFAULT_ACCOUNT_ID,
  listWsChannelAccountIds,
  resolveDefaultWsChannelAccountId,
  resolveWsChannelAccount,
} from "./accounts.js";
import { startWsGatewayAccount } from "./gateway.js";
import type { CoreConfig, ResolvedWsChannelAccount } from "./types.js";

const CHANNEL_ID = "ws-channel" as const;
const meta = { ...getChatChannelMeta(CHANNEL_ID) };

export const wsChannelPlugin: ChannelPlugin<ResolvedWsChannelAccount> = createChatChannelPlugin({
  base: {
    id: CHANNEL_ID,
    meta,
    capabilities: {
      chatTypes: ["direct"],
    },
    reload: { configPrefixes: ["channels.ws-channel"] },
    config: {
      listAccountIds: (cfg) => listWsChannelAccountIds(cfg as CoreConfig),
      resolveAccount: (cfg, accountId) =>
        resolveWsChannelAccount({ cfg: cfg as CoreConfig, accountId }),
      defaultAccountId: (cfg) => resolveDefaultWsChannelAccountId(cfg as CoreConfig),
      isConfigured: (account) => account.configured,
      resolveAllowFrom: ({ cfg, accountId }) =>
        resolveWsChannelAccount({ cfg: cfg as CoreConfig, accountId }).config.allowFrom ?? ["*"],
      resolveDefaultTo: ({ cfg, accountId }) =>
        resolveWsChannelAccount({ cfg: cfg as CoreConfig, accountId }).config.defaultTo,
    },
    messaging: {
      normalizeTarget: (target) => target.trim(),
      inferTargetChatType: () => "direct",
      targetResolver: {
        looksLikeId: (raw) => raw.trim().length > 0,
        hint: "<session-id>",
      },
      resolveOutboundSessionRoute: ({ cfg, agentId, accountId, target }) =>
        buildChannelOutboundSessionRoute({
          cfg,
          agentId,
          channel: CHANNEL_ID,
          accountId,
          peer: { kind: "direct", id: target.trim() },
          chatType: "direct",
          from: `ws-channel:${accountId ?? DEFAULT_ACCOUNT_ID}`,
          to: target.trim(),
        }),
    },
    gateway: {
      startAccount: async (ctx) => startWsGatewayAccount(ctx),
    },
  },
});
