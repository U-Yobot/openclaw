import { resolveStableChannelMessageIngress } from "openclaw/plugin-sdk/channel-ingress-runtime";
import type { OpenClawConfig } from "openclaw/plugin-sdk/config-contracts";
import { resolveInboundRouteEnvelopeBuilderWithRuntime } from "openclaw/plugin-sdk/inbound-envelope";
import { sendWsChannelReply } from "./outbound.js";
import type { InboundQueueMessage } from "./protocol.js";
import { getWsChannelRuntime } from "./runtime.js";
import type { CoreConfig, ResolvedWsChannelAccount } from "./types.js";

const CHANNEL_ID = "ws-channel" as const;

export async function handleWsInbound(params: {
  account: ResolvedWsChannelAccount;
  config: CoreConfig;
  message: InboundQueueMessage;
}): Promise<void> {
  const { account, config, message } = params;
  const runtime = getWsChannelRuntime();
  const { sessionId, text, messageId } = message;

  const { route, buildEnvelope } = resolveInboundRouteEnvelopeBuilderWithRuntime({
    cfg: config as OpenClawConfig,
    channel: CHANNEL_ID,
    accountId: account.accountId,
    peer: { kind: "direct", id: sessionId },
    runtime: runtime.channel,
    sessionStore: config.session?.store,
  });

  const access = await resolveStableChannelMessageIngress({
    channelId: CHANNEL_ID,
    accountId: account.accountId,
    identity: { key: "sender", entryIdPrefix: "ws-entry" },
    groupAllowFromFallbackToAllowFrom: true,
    subject: { stableId: sessionId },
    conversation: { kind: "direct", id: sessionId },
    dmPolicy: "open",
    groupPolicy: "disabled",
    policy: { activation: undefined },
    allowFrom: account.config.allowFrom ?? ["*"],
  });

  if (access.ingress.admission !== "dispatch") {
    return;
  }

  const { storePath, body } = buildEnvelope({
    channel: CHANNEL_ID,
    from: sessionId,
    timestamp: Date.now(),
    body: text,
  });

  const ctxPayload = runtime.channel.reply.finalizeInboundContext({
    Body: body,
    BodyForAgent: text,
    RawBody: text,
    CommandBody: text,
    From: sessionId,
    To: sessionId,
    SessionKey: route.sessionKey,
    AccountId: route.accountId ?? account.accountId,
    ChatType: "direct",
    WasMentioned: undefined,
    ConversationLabel: sessionId,
    NativeChannelId: sessionId,
    MessageThreadId: undefined,
    SenderName: sessionId,
    SenderId: sessionId,
    Provider: CHANNEL_ID,
    Surface: CHANNEL_ID,
    MessageSid: messageId,
    MessageSidFull: messageId,
    ReplyToId: undefined,
    Timestamp: Date.now(),
    OriginatingChannel: CHANNEL_ID,
    OriginatingTo: sessionId,
    CommandAuthorized: true,
  });

  await runtime.channel.turn.runAssembled({
    cfg: config as OpenClawConfig,
    channel: CHANNEL_ID,
    accountId: account.accountId,
    agentId: route.agentId,
    routeSessionKey: route.sessionKey,
    storePath,
    ctxPayload,
    recordInboundSession: runtime.channel.session.recordInboundSession,
    dispatchReplyWithBufferedBlockDispatcher:
      runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher,
    delivery: {
      deliver: async (payload) => {
        const replyText =
          payload && typeof payload === "object" && "text" in payload
            ? ((payload as { text?: string }).text ?? "")
            : "";
        if (!replyText.trim()) return;
        await sendWsChannelReply({
          account,
          sessionId,
          text: replyText,
          messageId: `reply-${messageId}`,
        });
      },
      onError: (error) => {
        throw error instanceof Error
          ? error
          : new Error(`ws-channel delivery failed: ${String(error)}`);
      },
    },
  });
}
