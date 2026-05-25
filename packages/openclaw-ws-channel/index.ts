import { defineChannelPluginEntry } from "openclaw/plugin-sdk/channel-core";
import { wsChannelPlugin } from "./src/channel.js";
import { setWsChannelRuntime } from "./src/runtime.js";

export default defineChannelPluginEntry({
  id: "ws-channel",
  name: "WebSocket Channel",
  description: "Connects OpenClaw agents to external apps over WebSocket via a bridge server.",
  plugin: wsChannelPlugin,
  setRuntime: setWsChannelRuntime,
});
