import type { IncomingMessage, ServerResponse } from "node:http";
import type { OutboundBody } from "./protocol.js";
import type { SessionStore } from "./session-store.js";
import { deliverReply, pollMessages } from "./session-store.js";

const POLL_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 1_048_576;

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(text ? (JSON.parse(text) as unknown) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function isAuthorized(req: IncomingMessage, secret: string): boolean {
  return req.headers["authorization"] === `Bearer ${secret}`;
}

export function createHttpHandler(
  store: SessionStore,
  secret: string,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    if (!isAuthorized(req, secret)) {
      writeJson(res, 401, { error: "Unauthorized" });
      return;
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method === "GET" && url.pathname === "/health") {
      writeJson(res, 200, { ok: true });
      return;
    }
    if (req.method === "GET" && url.pathname === "/poll") {
      const cursor = parseInt(url.searchParams.get("cursor") ?? "0", 10) || 0;
      try {
        const result = await pollMessages(store, cursor, POLL_TIMEOUT_MS);
        writeJson(res, 200, result);
      } catch (err) {
        writeJson(res, 500, { error: String(err) });
      }
      return;
    }
    if (req.method === "POST" && url.pathname === "/outbound") {
      try {
        const body = (await readJsonBody(req)) as Partial<OutboundBody>;
        if (!body.sessionId || !body.text) {
          writeJson(res, 400, { error: "sessionId and text required" });
          return;
        }
        deliverReply(store, body.sessionId, body.text, body.messageId ?? "");
        writeJson(res, 200, { ok: true });
      } catch (err) {
        writeJson(res, 500, { error: String(err) });
      }
      return;
    }
    writeJson(res, 404, { error: "Not found" });
  };
}
