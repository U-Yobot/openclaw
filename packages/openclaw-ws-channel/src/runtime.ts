import { createPluginRuntimeStore } from "openclaw/plugin-sdk/runtime-store";
import type { PluginRuntime } from "openclaw/plugin-sdk/runtime-store";

const { setRuntime: setWsChannelRuntime, getRuntime: getWsChannelRuntime } =
  createPluginRuntimeStore<PluginRuntime>({
    pluginId: "ws-channel",
    errorMessage: "ws-channel runtime not initialized",
  });

export { getWsChannelRuntime, setWsChannelRuntime };
