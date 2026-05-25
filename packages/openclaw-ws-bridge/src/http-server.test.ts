import { createServer } from "node:http";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHttpHandler } from "./http-server.js";
import { createSessionStore, enqueueInboundMessage } from "./session-store.js";

const SECRET = "test-secret";

async function request(
  port: number,
  method: string,
  path: string,
  body?: unknown,
  authOverride?: string,
): Promise<{ status: number; body: unknown }> {
  const auth = authOverride ?? `Bearer ${SECRET}`;
  const resp = await fetch(`http://localhost:${port}${path}`, {
    method,
    headers: {
      authorization: auth,
      "content-type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: resp.status, body: await resp.json() };
}

describe("HTTP server", () => {
  let server: ReturnType<typeof createServer>;
  let port: number;
  let store: ReturnType<typeof createSessionStore>;

  beforeEach(
    () =>
      new Promise<void>((resolve) => {
        store = createSessionStore();
        server = createServer(createHttpHandler(store, SECRET));
        server.listen(0, () => {
          port = (server.address() as { port: number }).port;
          resolve();
        });
      }),
  );

  afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("GET /health returns 200", async () => {
    const { status, body } = await request(port, "GET", "/health");
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  it("returns 401 without valid auth", async () => {
    const resp = await fetch(`http://localhost:${port}/health`, {
      headers: { authorization: "Bearer wrong" },
    });
    expect(resp.status).toBe(401);
  });

  it("GET /poll returns messages immediately when queued", async () => {
    enqueueInboundMessage(store, "s1", "hello");
    const { status, body } = await request(port, "GET", "/poll?cursor=0");
    expect(status).toBe(200);
    const parsed = body as { messages: unknown[]; cursor: number };
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.cursor).toBe(1);
  });

  it("POST /outbound buffers reply for offline session", async () => {
    const { status } = await request(port, "POST", "/outbound", {
      accountId: "default",
      sessionId: "s1",
      text: "AI reply",
      messageId: "r1",
    });
    expect(status).toBe(200);
    expect(store.sessions.get("s1")?.replyBuffer).toHaveLength(1);
  });

  it("POST /outbound returns 400 when sessionId missing", async () => {
    const { status } = await request(port, "POST", "/outbound", {
      accountId: "default",
      text: "AI reply",
      messageId: "r1",
    });
    expect(status).toBe(400);
  });

  it("unknown path returns 404", async () => {
    const { status } = await request(port, "GET", "/unknown");
    expect(status).toBe(404);
  });
});
