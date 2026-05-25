import { createServer } from "node:http";
import type { Duplex } from "node:stream";
import { createHttpHandler } from "./http-server.js";
import { createSessionStore } from "./session-store.js";
import { createWsHandler } from "./ws-server.js";

const WS_PORT = parseInt(process.env["WS_PORT"] ?? "8765", 10);
const HTTP_PORT = parseInt(process.env["HTTP_PORT"] ?? "8766", 10);
const SECRET = process.env["BRIDGE_SECRET"] ?? "";

if (!SECRET) {
  console.error("[bridge] BRIDGE_SECRET env var is required");
  process.exit(1);
}

const store = createSessionStore();

// HTTP server for the OpenClaw channel plugin
const httpServer = createServer(createHttpHandler(store, SECRET));
httpServer.listen(HTTP_PORT, () => {
  console.log(`[bridge] HTTP server listening on port ${HTTP_PORT}`);
});

// WebSocket server for the external application
const { handleUpgrade } = createWsHandler(store, SECRET);
const wsHttpServer = createServer((_req, res) => {
  res.writeHead(426, "Upgrade Required");
  res.end("WebSocket upgrade required");
});
wsHttpServer.on("upgrade", (req, socket, head) => {
  handleUpgrade(req, socket as Duplex, head);
});
wsHttpServer.listen(WS_PORT, () => {
  console.log(`[bridge] WebSocket server listening on port ${WS_PORT}`);
});
