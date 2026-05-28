export const SUPPORTED_BUNDLED_PLUGIN_ID_LIST: string[];
export const SUPPORTED_BUNDLED_PLUGIN_IDS: Set<string>;
export const PRIVATE_QA_BUNDLED_PLUGIN_IDS: Set<string>;
export const SUPPORTED_CHANNEL_IDS: Set<string>;
export function isSupportedBundledPluginId(pluginId: string): boolean;
export function listSupportedBundledPluginIds(): string[];
export function listSupportedBundledPluginRoots(rootDir?: string): string[];
export function shouldIncludeBundledPluginId(pluginId: string, env?: NodeJS.ProcessEnv): boolean;
export function isSupportedChannelId(channelId: string): boolean;
