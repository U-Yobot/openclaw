import { describe, it, expect, vi } from "vitest";
import {
  createSessionStore,
  enqueueInboundMessage,
  pollMessages,
  deliverReply,
  addWsClient,
  removeWsClient,
} from "./session-store.js";

describe("enqueueInboundMessage", () => {
  it("adds message to inboundQueue with incrementing cursor", () => {
    const store = createSessionStore();
    const msg = enqueueInboundMessage(store, "session-1", "hello");
    expect(msg.sessionId).toBe("session-1");
    expect(msg.text).toBe("hello");
    expect(msg.cursor).toBe(1);
    expect(store.inboundQueue).toHaveLength(1);
  });

  it("wakes a registered waiter", async () => {
    const store = createSessionStore();
    const pollPromise = pollMessages(store, 0, 5000);
    enqueueInboundMessage(store, "session-1", "hello");
    const result = await pollPromise;
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].text).toBe("hello");
  });
});

describe("pollMessages", () => {
  it("returns immediately if messages already queued past cursor", async () => {
    const store = createSessionStore();
    enqueueInboundMessage(store, "s1", "msg1");
    const result = await pollMessages(store, 0, 1000);
    expect(result.messages).toHaveLength(1);
  });

  it("returns empty after timeout when no messages", async () => {
    vi.useFakeTimers();
    const store = createSessionStore();
    const p = pollMessages(store, 0, 100);
    vi.advanceTimersByTime(200);
    const result = await p;
    expect(result.messages).toHaveLength(0);
    vi.useRealTimers();
  });
});

describe("deliverReply", () => {
  it("buffers reply when no WS client connected", () => {
    const store = createSessionStore();
    deliverReply(store, "session-1", "hello reply", "msg-1");
    const session = store.sessions.get("session-1");
    expect(session?.replyBuffer).toHaveLength(1);
    expect(session?.replyBuffer[0].text).toBe("hello reply");
  });

  it("drops oldest reply when buffer exceeds 100", () => {
    const store = createSessionStore();
    for (let i = 0; i < 101; i++) {
      deliverReply(store, "s1", `reply-${i}`, `msg-${i}`);
    }
    const session = store.sessions.get("s1");
    expect(session?.replyBuffer).toHaveLength(100);
    expect(session?.replyBuffer[0].text).toBe("reply-1");
  });

  it("sends directly to connected WS client", () => {
    const store = createSessionStore();
    const ws = { send: vi.fn(), readyState: 1 } as unknown as import("ws").WebSocket;
    addWsClient(store, "s1", ws);
    deliverReply(store, "s1", "live reply", "msg-1");
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "reply", sessionId: "s1", text: "live reply" }),
    );
    expect(store.sessions.get("s1")?.replyBuffer).toHaveLength(0);
  });
});

describe("addWsClient", () => {
  it("flushes buffered replies on connect", () => {
    const store = createSessionStore();
    deliverReply(store, "s1", "buffered", "msg-1");
    const ws = { send: vi.fn(), readyState: 1 } as unknown as import("ws").WebSocket;
    addWsClient(store, "s1", ws);
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "reply", sessionId: "s1", text: "buffered" }),
    );
    expect(store.sessions.get("s1")?.replyBuffer).toHaveLength(0);
  });
});

describe("removeWsClient", () => {
  it("removes client from session and deletes idle session with empty buffer", () => {
    const store = createSessionStore();
    const ws = { send: vi.fn(), readyState: 1 } as unknown as import("ws").WebSocket;
    addWsClient(store, "s1", ws);
    removeWsClient(store, "s1", ws);
    // Session is deleted when no clients remain and reply buffer is empty.
    expect(store.sessions.has("s1")).toBe(false);
  });

  it("keeps session when reply buffer is non-empty after client removal", () => {
    const store = createSessionStore();
    const ws = { send: vi.fn(), readyState: 1 } as unknown as import("ws").WebSocket;
    addWsClient(store, "s1", ws);
    // Add a reply to the buffer of a second (hypothetical) scenario:
    // deliver after the client is registered so it goes live, but simulate
    // a pending buffer by poking it directly.
    store.sessions.get("s1")!.replyBuffer.push({ text: "pending", messageId: "m1" });
    removeWsClient(store, "s1", ws);
    // Session must survive because the reply buffer still has data.
    expect(store.sessions.has("s1")).toBe(true);
    expect(store.sessions.get("s1")?.replyBuffer).toHaveLength(1);
  });
});
