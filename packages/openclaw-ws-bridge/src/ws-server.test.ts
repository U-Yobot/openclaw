import { createServer } from "node:http";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import WebSocket from "ws";
import { createSessionStore, deliverReply } from "./session-store.js";
import { createWsHandler } from "./ws-server.js";

const SECRET = "test-secret";

function openWs(port: number, withAuth = true): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`, {
      headers: withAuth ? { authorization: `Bearer ${SECRET}` } : {},
    });
    ws.once("open", resolve.bind(null, ws));
    ws.once("error", reject);
    setTimeout(() => reject(new Error("WS connect timeout")), 3_000);
  });
}

function nextMessage(ws: WebSocket): Promise<unknown> {
  return new Promise((resolve) => {
    ws.once("message", (data) => resolve(JSON.parse(data.toString())));
  });
}

describe("WebSocket server", () => {
  let server: ReturnType<typeof createServer>;
  let port: number;
  let store: ReturnType<typeof createSessionStore>;

  beforeEach(
    () =>
      new Promise<void>((resolve) => {
        store = createSessionStore();
        const { handleUpgrade } = createWsHandler(store, SECRET);
        server = createServer();
        server.on("upgrade", (req, socket, head) => {
          handleUpgrade(req, socket as import("node:stream").Duplex, head);
        });
        server.listen(0, () => {
          port = (server.address() as { port: number }).port;
          resolve();
        });
      }),
  );

  afterEach(
    () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  );

  it("rejects connection without auth — socket closes", async () => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    const result = await new Promise<
      { type: "close"; code: number } | { type: "error"; message: string }
    >((resolve) => {
      ws.once("close", (code) => resolve({ type: "close", code }));
      ws.once("error", (err) => resolve({ type: "error", message: err.message }));
    });
    if (result.type === "close") {
      expect(result.code).toBeGreaterThan(0);
    } else {
      // ws throws "Unexpected server response: 401" on auth failure — that's valid rejection
      expect(result.message).toMatch(/401/);
    }
  });

  it("accepts connection with correct secret", async () => {
    const ws = await openWs(port);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  it("enqueues inbound message on message frame", async () => {
    const ws = await openWs(port);
    ws.send(JSON.stringify({ type: "message", sessionId: "s1", text: "hello" }));
    await new Promise((r) => setTimeout(r, 50));
    expect(store.inboundQueue).toHaveLength(1);
    expect(store.inboundQueue[0].text).toBe("hello");
    ws.close();
  });

  it("pushes reply frame to connected client via deliverReply", async () => {
    const ws = await openWs(port);
    ws.send(JSON.stringify({ type: "message", sessionId: "s1", text: "hi" }));
    await new Promise((r) => setTimeout(r, 50));
    const msgPromise = nextMessage(ws);
    deliverReply(store, "s1", "AI reply", "r1");
    const frame = await msgPromise;
    expect(frame).toEqual({ type: "reply", sessionId: "s1", text: "AI reply" });
    ws.close();
  });

  it("sends buffered replies on reconnect after associating with session", async () => {
    deliverReply(store, "s1", "buffered reply", "r1");
    const ws = await openWs(port);
    const msgPromise = nextMessage(ws);
    ws.send(JSON.stringify({ type: "message", sessionId: "s1", text: "reconnect" }));
    const frame = await msgPromise;
    expect(frame).toEqual({ type: "reply", sessionId: "s1", text: "buffered reply" });
    ws.close();
  });

  it("sends error frame on malformed JSON", async () => {
    const ws = await openWs(port);
    const msgPromise = nextMessage(ws);
    ws.send("not json");
    const frame = await msgPromise;
    expect((frame as { type: string }).type).toBe("error");
    ws.close();
  });
});
