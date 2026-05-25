import type { WebSocket } from "ws";
import type { InboundQueueMessage } from "./protocol.js";

const MAX_REPLY_BUFFER = 100;
const MAX_INBOUND_QUEUE_SAFETY = 1000;

type ReplyEntry = { text: string; messageId: string };

type SessionEntry = {
  replyBuffer: ReplyEntry[];
  wsClients: Set<WebSocket>;
};

type Waiter = {
  minCursor: number;
  resolve: (result: PollResult) => void;
  timer: ReturnType<typeof setTimeout>;
};

export type PollResult = {
  messages: InboundQueueMessage[];
  cursor: number;
};

export type SessionStore = {
  sessions: Map<string, SessionEntry>;
  inboundQueue: InboundQueueMessage[];
  globalCursor: number;
  waiters: Waiter[];
};

export function createSessionStore(): SessionStore {
  return { sessions: new Map(), inboundQueue: [], globalCursor: 0, waiters: [] };
}

function getOrCreateSession(store: SessionStore, sessionId: string): SessionEntry {
  let entry = store.sessions.get(sessionId);
  if (!entry) {
    entry = { replyBuffer: [], wsClients: new Set() };
    store.sessions.set(sessionId, entry);
  }
  return entry;
}

export function enqueueInboundMessage(
  store: SessionStore,
  sessionId: string,
  text: string,
): InboundQueueMessage {
  const cursor = ++store.globalCursor;
  const messageId = `msg-${cursor}`;
  const msg: InboundQueueMessage = { messageId, sessionId, text, cursor };
  store.inboundQueue.push(msg);
  const toWake = store.waiters.filter((w) => w.minCursor < cursor);
  store.waiters = store.waiters.filter((w) => w.minCursor >= cursor);
  for (const waiter of toWake) {
    clearTimeout(waiter.timer);
    waiter.resolve({
      messages: store.inboundQueue.filter((m) => m.cursor > waiter.minCursor),
      cursor: store.globalCursor,
    });
  }

  // Prune messages no remaining waiter will ever request.
  if (store.waiters.length > 0) {
    const minCursor = Math.min(...store.waiters.map((w) => w.minCursor));
    store.inboundQueue = store.inboundQueue.filter((m) => m.cursor > minCursor);
  } else {
    // No waiters: keep only the most recent safety-net window for late pollers.
    if (store.inboundQueue.length > MAX_INBOUND_QUEUE_SAFETY) {
      store.inboundQueue = store.inboundQueue.slice(-MAX_INBOUND_QUEUE_SAFETY);
    }
  }

  return msg;
}

export function pollMessages(
  store: SessionStore,
  cursor: number,
  timeoutMs: number,
): Promise<PollResult> {
  const available = store.inboundQueue.filter((m) => m.cursor > cursor);
  if (available.length > 0) {
    return Promise.resolve({ messages: available, cursor: store.globalCursor });
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      store.waiters = store.waiters.filter((w) => w.resolve !== resolve);
      resolve({ messages: [], cursor: store.globalCursor });
    }, timeoutMs);
    timer.unref?.();
    store.waiters.push({ minCursor: cursor, resolve, timer });
  });
}

export function deliverReply(
  store: SessionStore,
  sessionId: string,
  text: string,
  messageId: string,
): void {
  const session = getOrCreateSession(store, sessionId);
  if (session.wsClients.size === 0) {
    if (session.replyBuffer.length >= MAX_REPLY_BUFFER) {
      session.replyBuffer.shift();
    }
    session.replyBuffer.push({ text, messageId });
    return;
  }
  const frame = JSON.stringify({ type: "reply", sessionId, text });
  for (const client of session.wsClients) {
    try {
      client.send(frame);
    } catch {
      session.wsClients.delete(client);
    }
  }
}

export function addWsClient(store: SessionStore, sessionId: string, ws: WebSocket): void {
  const session = getOrCreateSession(store, sessionId);
  session.wsClients.add(ws);
  const buffered = session.replyBuffer.splice(0);
  for (const { text } of buffered) {
    try {
      ws.send(JSON.stringify({ type: "reply", sessionId, text }));
    } catch {
      session.wsClients.delete(ws);
      break;
    }
  }
}

export function removeWsClient(store: SessionStore, sessionId: string, ws: WebSocket): void {
  const session = store.sessions.get(sessionId);
  if (!session) return;
  session.wsClients.delete(ws);
  if (session.wsClients.size === 0 && session.replyBuffer.length === 0) {
    store.sessions.delete(sessionId);
  }
}
