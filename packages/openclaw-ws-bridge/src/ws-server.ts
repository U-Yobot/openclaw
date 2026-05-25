import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import type { WsInboundFrame } from "./protocol.js";
import type { SessionStore } from "./session-store.js";
import { addWsClient, enqueueInboundMessage, removeWsClient } from "./session-store.js";

function sendError(ws: WebSocket, sessionId: string, message: string): void {
  try {
    ws.send(JSON.stringify({ type: "error", sessionId, message }));
  } catch {
    // client disconnected
  }
}

export function createWsHandler(
  store: SessionStore,
  secret: string,
): {
  handleUpgrade: (req: IncomingMessage, socket: Duplex, head: Buffer) => void;
} {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket) => {
    let currentSessionId: string | undefined;

    ws.on("message", (data) => {
      let frame: WsInboundFrame;
      try {
        frame = JSON.parse(data.toString()) as WsInboundFrame;
      } catch {
        sendError(ws, currentSessionId ?? "", "Invalid JSON");
        return;
      }

      if (frame.type === "message") {
        if (!frame.sessionId?.trim() || !frame.text?.trim()) {
          sendError(ws, frame.sessionId ?? "", "sessionId and text required");
          return;
        }
        if (currentSessionId !== frame.sessionId) {
          if (currentSessionId) removeWsClient(store, currentSessionId, ws);
          currentSessionId = frame.sessionId;
          addWsClient(store, currentSessionId, ws);
        }
        enqueueInboundMessage(store, frame.sessionId, frame.text);
        return;
      }

      if (frame.type === "close") {
        if (frame.sessionId && currentSessionId === frame.sessionId) {
          removeWsClient(store, currentSessionId, ws);
          currentSessionId = undefined;
        }
      }
    });

    ws.on("close", () => {
      if (currentSessionId) removeWsClient(store, currentSessionId, ws);
    });
  });

  return {
    handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
      if (req.headers["authorization"] !== `Bearer ${secret}`) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    },
  };
}
