import { createAccountListHelpers } from "openclaw/plugin-sdk/account-helpers";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "openclaw/plugin-sdk/account-id";
import { resolveMergedAccountConfig } from "openclaw/plugin-sdk/account-resolution-runtime";
import type { CoreConfig, ResolvedWsChannelAccount, WsChannelAccountConfig } from "./types.js";

export { DEFAULT_ACCOUNT_ID };

const DEFAULT_WS_PORT = 8765;
const DEFAULT_WS_HOST = "0.0.0.0";

const {
  listAccountIds: listWsChannelAccountIds,
  resolveDefaultAccountId: resolveDefaultWsChannelAccountId,
} = createAccountListHelpers("ws-channel", {
  normalizeAccountId,
  implicitDefaultAccount: { channelKeys: ["wsSecret"] },
});

export { listWsChannelAccountIds, resolveDefaultWsChannelAccountId };

export function resolveWsChannelAccount(params: {
  cfg: CoreConfig;
  accountId?: string | null;
}): ResolvedWsChannelAccount {
  const accountId = normalizeAccountId(params.accountId);
  const merged = resolveMergedAccountConfig<WsChannelAccountConfig>({
    channelConfig: params.cfg.channels?.["ws-channel"] as WsChannelAccountConfig | undefined,
    accounts: params.cfg.channels?.["ws-channel"]?.accounts,
    accountId,
    omitKeys: ["defaultAccount"],
    normalizeAccountId,
  });
  const enabled =
    params.cfg.channels?.["ws-channel"]?.enabled !== false && merged.enabled !== false;
  const wsSecret = merged.wsSecret?.trim() ?? "";
  const wsPort = merged.wsPort ?? DEFAULT_WS_PORT;
  const wsHost = merged.wsHost?.trim() ?? DEFAULT_WS_HOST;
  return {
    accountId,
    enabled,
    configured: Boolean(wsSecret),
    name: merged.name,
    wsPort,
    wsHost,
    wsSecret,
    config: { ...merged, allowFrom: merged.allowFrom ?? ["*"] },
  };
}

export function listEnabledWsChannelAccounts(cfg: CoreConfig): ResolvedWsChannelAccount[] {
  return listWsChannelAccountIds(cfg)
    .map((accountId) => resolveWsChannelAccount({ cfg, accountId }))
    .filter((account) => account.enabled);
}

export type { ResolvedWsChannelAccount } from "./types.js";
