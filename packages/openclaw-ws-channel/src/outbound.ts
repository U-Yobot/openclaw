import type { OutboundBody } from "./protocol.js";
import type { ResolvedWsChannelAccount } from "./types.js";

export async function sendWsChannelReply(params: {
  account: ResolvedWsChannelAccount;
  sessionId: string;
  text: string;
  messageId: string;
}): Promise<void> {
  const body: OutboundBody = {
    accountId: params.account.accountId,
    sessionId: params.sessionId,
    text: params.text,
    messageId: params.messageId,
  };
  const url = new URL("/outbound", params.account.bridgeUrl).toString();
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${params.account.bridgeSecret}`,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    throw new Error(`Bridge outbound failed: ${resp.status}`);
  }
}
