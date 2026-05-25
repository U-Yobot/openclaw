# openclaw-ws-channel

OpenClaw channel plugin that connects agents to external apps over WebSocket via a bridge server.

## Architecture

```
Your App  <──WebSocket──>  openclaw-ws-bridge  <──HTTP poll/POST──>  openclaw-ws-channel (OpenClaw plugin)
```

## Setup

### 1. Start the bridge

```bash
cd packages/openclaw-ws-bridge
BRIDGE_SECRET=your-secret WS_PORT=8765 HTTP_PORT=8766 npm start
```

### 2. Install the channel plugin

```bash
openclaw plugins install ./packages/openclaw-ws-channel
```

### 3. Configure OpenClaw

Add to `~/.openclaw/config.yaml`:

```yaml
channels:
  ws-channel:
    bridgeUrl: "http://localhost:8766"
    bridgeSecret: "your-secret"
```

### 4. Start OpenClaw gateway

```bash
openclaw gateway start
```

### 5. Connect your app

```javascript
const ws = new WebSocket("ws://localhost:8765", {
  headers: { authorization: "Bearer your-secret" },
});

ws.on("open", () => {
  ws.send(JSON.stringify({ type: "message", sessionId: "my-session", text: "Hello!" }));
});

ws.on("message", (data) => {
  const frame = JSON.parse(data);
  if (frame.type === "reply") {
    console.log("AI says:", frame.text);
  }
});
```

## E2E smoke test

With bridge and OpenClaw gateway running:

```bash
cd packages/openclaw-ws-bridge
BRIDGE_SECRET=your-secret node --import tsx/esm src/e2e-smoke.ts
```
