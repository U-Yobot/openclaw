import { createAccountListHelpers } from "openclaw/plugin-sdk/account-helpers";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "openclaw/plugin-sdk/account-id";
import { resolveMergedAccountConfig } from "openclaw/plugin-sdk/account-resolution-runtime";
import type { CoreConfig, ResolvedWsChannelAccount, WsChannelAccountConfig } from "./types.js";

export { DEFAULT_ACCOUNT_ID };

const DEFAULT_POLL_TIMEOUT_MS = 10_000;

const {
  listAccountIds: listWsChannelAccountIds,
  resolveDefaultAccountId: resolveDefaultWsChannelAccountId,
} = createAccountListHelpers("ws-channel", {
  normalizeAccountId,
  implicitDefaultAccount: { channelKeys: ["bridgeUrl"] },
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
  const bridgeUrl = merged.bridgeUrl?.trim() ?? "";
  const bridgeSecret = merged.bridgeSecret?.trim() ?? "";
  return {
    accountId,
    enabled,
    configured: Boolean(bridgeUrl && bridgeSecret),
    name: merged.name,
    bridgeUrl,
    bridgeSecret,
    pollTimeoutMs: merged.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS,
    config: { ...merged, allowFrom: merged.allowFrom ?? ["*"] },
  };
}

export function listEnabledWsChannelAccounts(cfg: CoreConfig): ResolvedWsChannelAccount[] {
  return listWsChannelAccountIds(cfg)
    .map((accountId) => resolveWsChannelAccount({ cfg, accountId }))
    .filter((account) => account.enabled);
}

export type { ResolvedWsChannelAccount } from "./types.js";
