import type { ChannelGatewayContext } from "openclaw/plugin-sdk/channel-contract";
import { handleWsInbound } from "./inbound.js";
import type { PollResponse } from "./protocol.js";
import type { CoreConfig, ResolvedWsChannelAccount } from "./types.js";

const BACKOFF_INITIAL_MS = 100;
const BACKOFF_MAX_MS = 5_000;

async function pollBridge(params: {
  bridgeUrl: string;
  bridgeSecret: string;
  cursor: number;
  signal: AbortSignal;
}): Promise<PollResponse> {
  const url = new URL(`/poll?cursor=${params.cursor}`, params.bridgeUrl).toString();
  const resp = await fetch(url, {
    headers: { authorization: `Bearer ${params.bridgeSecret}` },
    signal: params.signal,
  });
  if (!resp.ok) {
    throw new Error(`Bridge poll failed: ${resp.status}`);
  }
  return resp.json() as Promise<PollResponse>;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

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
  let cursor = 0;
  let backoffMs = BACKOFF_INITIAL_MS;

  try {
    while (!ctx.abortSignal.aborted) {
      try {
        const result = await pollBridge({
          bridgeUrl: account.bridgeUrl,
          bridgeSecret: account.bridgeSecret,
          cursor,
          signal: ctx.abortSignal,
        });
        cursor = result.cursor;
        backoffMs = BACKOFF_INITIAL_MS;
        for (const msg of result.messages) {
          if (ctx.abortSignal.aborted) break;
          await handleWsInbound({ account, config: ctx.cfg as CoreConfig, message: msg });
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") throw err;
        console.error(`[ws-channel] poll error, retrying in ${backoffMs}ms:`, err);
        await sleep(backoffMs, ctx.abortSignal);
        backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX_MS);
      }
    }
  } catch (err) {
    if (!(err instanceof Error) || err.name !== "AbortError") throw err;
  }

  ctx.setStatus({ accountId: account.accountId, running: false });
}
