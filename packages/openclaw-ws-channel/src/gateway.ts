import { createServer } from "node:http";
import type { ChannelGatewayContext } from "openclaw/plugin-sdk/channel-contract";
import { WebSocketServer } from "ws";
import { handleWsInbound } from "./inbound.js";
import type { InboundWsFrame } from "./protocol.js";
import { wsConnections } from "./runtime.js";
import type { CoreConfig, ResolvedWsChannelAccount } from "./types.js";

export async function startWsGatewayAccount(
  ctx: ChannelGatewayContext<ResolvedWsChannelAccount>,
): Promise<void> {
  const account = ctx.account;
  if (!account.configured) {
    throw new Error(`ws-channel: account "${account.accountId}" not configured`);
  }

  ctx.setStatus({
    accountId: account.accountId,
    running: true,
    configured: true,
    enabled: account.enabled,
  });

  const httpServer = createServer();
  const wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", (ws, req) => {
    const authHeader = req.headers["authorization"] ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (token !== account.wsSecret) {
      ws.close(1008, "Unauthorized");
      return;
    }

    ws.on("message", (data) => {
      let frame: InboundWsFrame;
      try {
        frame = JSON.parse(data.toString()) as InboundWsFrame;
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
        return;
      }

      if (frame.type !== "message" || !frame.sessionId || !frame.text) {
        ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
        return;
      }

      wsConnections.set(frame.sessionId, ws);
      ws.once("close", () => wsConnections.delete(frame.sessionId));

      console.log(`[ws-channel] inbound session=${frame.sessionId} text="${frame.text}"`);

      handleWsInbound({
        account,
        config: ctx.cfg as CoreConfig,
        message: {
          messageId: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          sessionId: frame.sessionId,
          text: frame.text,
        },
      }).catch((err) => {
        console.error(`[ws-channel] inbound error:`, err);
        ws.send(JSON.stringify({ type: "error", message: String(err) }));
      });
    });
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(account.wsPort, account.wsHost, resolve);
  });

  console.log(`[ws-channel] listening on ${account.wsHost}:${account.wsPort}`);

  await new Promise<void>((resolve) => {
    ctx.abortSignal.addEventListener("abort", () => {
      wss.close();
      httpServer.close(() => resolve());
    });
  });

  ctx.setStatus({ accountId: account.accountId, running: false });
}
