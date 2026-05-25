export type WsChannelAccountConfig = {
  name?: string;
  enabled?: boolean;
  bridgeUrl?: string;
  bridgeSecret?: string;
  pollTimeoutMs?: number;
  allowFrom?: Array<string | number>;
  defaultTo?: string;
};

type WsChannelConfig = WsChannelAccountConfig & {
  accounts?: Record<string, Partial<WsChannelAccountConfig>>;
  defaultAccount?: string;
};

export type CoreConfig = {
  channels?: {
    "ws-channel"?: WsChannelConfig;
  };
  session?: { store?: string };
};

export type ResolvedWsChannelAccount = {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  name?: string;
  bridgeUrl: string;
  bridgeSecret: string;
  pollTimeoutMs: number;
  config: WsChannelAccountConfig;
};
