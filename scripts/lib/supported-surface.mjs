export const SUPPORTED_BUNDLED_PLUGIN_ID_LIST = [
  "anthropic",
  "codex",
  "discord",
  "openai",
  "telegram",
];
export const SUPPORTED_BUNDLED_PLUGIN_IDS = new Set(SUPPORTED_BUNDLED_PLUGIN_ID_LIST);
export const PRIVATE_QA_BUNDLED_PLUGIN_IDS = new Set(["qa-channel", "qa-lab", "qa-matrix"]);

export const SUPPORTED_CHANNEL_IDS = new Set(["discord", "telegram"]);

function shouldIncludePrivateQaBundledPlugins(env = process.env) {
  return env.OPENCLAW_BUILD_PRIVATE_QA === "1";
}

export function isSupportedBundledPluginId(pluginId) {
  return SUPPORTED_BUNDLED_PLUGIN_IDS.has(pluginId);
}

export function listSupportedBundledPluginIds() {
  return [...SUPPORTED_BUNDLED_PLUGIN_ID_LIST];
}

export function listSupportedBundledPluginRoots(rootDir = "extensions") {
  return SUPPORTED_BUNDLED_PLUGIN_ID_LIST.map((pluginId) => `${rootDir}/${pluginId}`);
}

export function shouldIncludeBundledPluginId(pluginId, env = process.env) {
  return (
    isSupportedBundledPluginId(pluginId) ||
    (shouldIncludePrivateQaBundledPlugins(env) && PRIVATE_QA_BUNDLED_PLUGIN_IDS.has(pluginId))
  );
}

export function isSupportedChannelId(channelId) {
  return SUPPORTED_CHANNEL_IDS.has(channelId);
}
