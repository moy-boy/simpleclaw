import type { OpenClawConfig } from "./config/types.openclaw.js";
import { normalizeOptionalLowercaseString } from "./shared/string-coerce.js";

export const SUPPORTED_CHANNEL_IDS = ["telegram", "discord", "slack"] as const;
export const SUPPORTED_PLUGIN_IDS = [
  "telegram",
  "discord",
  "slack",
  "openai",
  "codex",
  "anthropic",
] as const;
export const SUPPORTED_MODEL_PROVIDER_IDS = [
  "openai",
  "openai-codex",
  "claude-cli",
  "anthropic",
] as const;
export const SUPPORTED_SUBSCRIPTION_AUTH_CHOICES = [
  "openai-codex",
  "openai-codex-device-code",
  "anthropic-cli",
] as const;

const supportedAuthChoices = new Set<string>(SUPPORTED_SUBSCRIPTION_AUTH_CHOICES);
const supportedChannelIds = new Set<string>(SUPPORTED_CHANNEL_IDS);
const supportedPluginIds = new Set<string>(SUPPORTED_PLUGIN_IDS);
const supportedModelProviderIds = new Set<string>(SUPPORTED_MODEL_PROVIDER_IDS);

function hasExplicitPluginSurface(plugins: OpenClawConfig["plugins"]): boolean {
  if (!plugins) {
    return false;
  }
  if (typeof plugins.enabled === "boolean") {
    return true;
  }
  if (Array.isArray(plugins.allow) && plugins.allow.length > 0) {
    return true;
  }
  if (Array.isArray(plugins.deny) && plugins.deny.length > 0) {
    return true;
  }
  if (plugins.bundledDiscovery !== undefined) {
    return true;
  }
  if (Array.isArray(plugins.load?.paths) && plugins.load.paths.length > 0) {
    return true;
  }
  if (plugins.slots && Object.keys(plugins.slots).length > 0) {
    return true;
  }
  if (plugins.entries && Object.keys(plugins.entries).length > 0) {
    return true;
  }
  return false;
}

export function applySupportedPluginDefaults(config: OpenClawConfig): OpenClawConfig {
  if (hasExplicitPluginSurface(config.plugins)) {
    return config;
  }
  return {
    ...config,
    plugins: {
      ...config.plugins,
      allow: [...SUPPORTED_PLUGIN_IDS],
      bundledDiscovery: "allowlist",
    },
  };
}

export function isSupportedSubscriptionAuthChoice(choice: string): boolean {
  return supportedAuthChoices.has(choice);
}

export function isSupportedOnboardAuthChoice(choice: string | undefined): boolean {
  return choice === undefined || choice === "skip" || isSupportedSubscriptionAuthChoice(choice);
}

export function formatUnsupportedOnboardAuthChoice(choice: string): string {
  return [
    `Unsupported --auth-choice "${choice}".`,
    "This setup supports subscription login only: openai-codex, openai-codex-device-code, anthropic-cli, or skip.",
  ].join("\n");
}

export function isSupportedChannelId(channel: string): boolean {
  const normalized = normalizeOptionalLowercaseString(channel);
  return Boolean(normalized && supportedChannelIds.has(normalized));
}

export function formatUnsupportedChannelMessage(channel: string): string {
  return `Unsupported channel "${channel}". This setup supports Telegram, Discord, and Slack only.`;
}

export function shouldEnforceSupportedSurface(config: OpenClawConfig): boolean {
  void config;
  return true;
}

export function shouldEnforceSupportedChannelIds(config: OpenClawConfig): boolean {
  return shouldEnforceSupportedSurface(config);
}

export function shouldEnforceSupportedPluginIds(config: OpenClawConfig): boolean {
  return shouldEnforceSupportedSurface(config);
}

export function shouldEnforceSupportedModelProviderIds(config: OpenClawConfig): boolean {
  return shouldEnforceSupportedSurface(config);
}

export function listSupportedChannelIds(): string[] {
  return [...SUPPORTED_CHANNEL_IDS];
}

export function isSupportedPluginId(pluginId: string): boolean {
  const normalized = normalizeOptionalLowercaseString(pluginId);
  return Boolean(normalized && supportedPluginIds.has(normalized));
}

export function isSupportedModelProviderId(provider: string): boolean {
  const normalized = normalizeOptionalLowercaseString(provider);
  return Boolean(normalized && supportedModelProviderIds.has(normalized));
}

export function isSupportedModelRef(modelRef: string): boolean {
  const normalized = normalizeOptionalLowercaseString(modelRef);
  if (!normalized) {
    return false;
  }
  const slashIndex = normalized.indexOf("/");
  if (slashIndex === -1) {
    return true;
  }
  return isSupportedModelProviderId(normalized.slice(0, slashIndex));
}

export function formatUnsupportedModelProviderMessage(provider: string): string {
  return [
    `Unsupported provider "${provider}".`,
    "This setup supports subscription-backed providers only: openai, openai-codex, anthropic, or claude-cli.",
  ].join("\n");
}

export function formatUnsupportedModelRefMessage(modelRef: string): string {
  return [
    `Unsupported model "${modelRef}".`,
    "This setup supports subscription-backed model refs only, such as openai/gpt-5.4, anthropic/claude-opus-4-7, or claude-cli/claude-opus-4-7.",
  ].join("\n");
}
