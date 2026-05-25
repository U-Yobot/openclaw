#!/usr/bin/env node
/**
 * E2E smoke test: sends a message via WebSocket and waits for a reply from OpenClaw.
 *
 * Prerequisites:
 *   1. Bridge running: BRIDGE_SECRET=<secret> npm start
 *   2. OpenClaw gateway running with ws-channel plugin installed and configured:
 *      channels.ws-channel.bridgeUrl = http://localhost:8766
 *      channels.ws-channel.bridgeSecret = <secret>
 *
 * Run: node --import tsx/esm src/e2e-smoke.ts
 *      WS_PORT=8765 BRIDGE_SECRET=test node --import tsx/esm src/e2e-smoke.ts
 */
import WebSocket from "ws";

const WS_PORT = parseInt(process.env["WS_PORT"] ?? "8765", 10);
const SECRET = process.env["BRIDGE_SECRET"] ?? "";
const TIMEOUT_MS = parseInt(process.env["E2E_TIMEOUT_MS"] ?? "15000", 10);

if (!SECRET) {
  console.error("[e2e] BRIDGE_SECRET env var is required");
  process.exit(1);
}

const SESSION_ID = `smoke-${Date.now()}`;
const BRIDGE_WS = `ws://localhost:${WS_PORT}`;

async function run(): Promise<void> {
  console.log(`[e2e] Connecting to ${BRIDGE_WS} (session: ${SESSION_ID})`);

  const ws = new WebSocket(BRIDGE_WS, {
    headers: { authorization: `Bearer ${SECRET}` },
  });

  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", (err) => reject(new Error(`WS connect failed: ${String(err)}`)));
    setTimeout(() => reject(new Error("WS connect timeout (5s)")), 5_000);
  });
  console.log("[e2e] Connected");

  const replyPromise = new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`No reply received in ${TIMEOUT_MS}ms`)),
      TIMEOUT_MS,
    );
    ws.on("message", (data) => {
      const frame = JSON.parse(data.toString()) as {
        type: string;
        sessionId?: string;
        text?: string;
      };
      if (frame.type === "reply" && frame.sessionId === SESSION_ID) {
        clearTimeout(timer);
        resolve(frame.text ?? "");
      } else if (frame.type === "error") {
        clearTimeout(timer);
        reject(new Error(`Bridge error: ${JSON.stringify(frame)}`));
      }
    });
  });

  const outgoing = { type: "message", sessionId: SESSION_ID, text: "ping" };
  ws.send(JSON.stringify(outgoing));
  console.log(`[e2e] Sent: ${JSON.stringify(outgoing)}`);

  const reply = await replyPromise;
  ws.close();

  if (!reply.trim()) {
    throw new Error("Received empty reply");
  }

  console.log(`[e2e] Got reply: "${reply}"`);
  console.log("[e2e] PASS ✓");
}

run().catch((err) => {
  console.error("[e2e] FAIL:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
