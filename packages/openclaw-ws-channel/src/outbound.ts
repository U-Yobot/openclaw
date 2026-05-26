import { wsConnections } from "./runtime.js";
import type { ResolvedWsChannelAccount } from "./types.js";

export async function sendWsChannelReply(params: {
  account: ResolvedWsChannelAccount;
  sessionId: string;
  text: string;
  messageId: string;
}): Promise<void> {
  const ws = wsConnections.get(params.sessionId);
  if (!ws) {
    console.warn(`[ws-channel] no active connection for session ${params.sessionId}`);
    return;
  }
  ws.send(JSON.stringify({ type: "reply", sessionId: params.sessionId, text: params.text }));
}
