import { DEFAULT_PROVIDER } from "./agents/defaults.js";
import {
  buildModelAliasIndex,
  modelKey,
  resolveModelRefFromString,
} from "./agents/model-selection.js";
import type { OpenClawConfig } from "./config/types.openclaw.js";
import { normalizeOptionalString } from "./shared/string-coerce.js";
import {
  formatUnsupportedModelRefMessage,
  isSupportedModelRef,
  shouldEnforceSupportedModelProviderIds,
} from "./supported-surface.js";

export function resolveModelKeyForSupportedPolicy(params: {
  cfg: OpenClawConfig;
  raw: string;
  defaultProvider?: string;
}): string {
  const normalized = normalizeOptionalString(params.raw);
  if (!normalized) {
    return params.raw;
  }
  const defaultProvider = params.defaultProvider ?? DEFAULT_PROVIDER;
  const aliasIndex = buildModelAliasIndex({
    cfg: params.cfg,
    defaultProvider,
  });
  const resolved = resolveModelRefFromString({
    raw: normalized,
    defaultProvider,
    aliasIndex,
  });
  return resolved ? modelKey(resolved.ref.provider, resolved.ref.model) : normalized;
}

export function formatUnsupportedResolvedModelRefMessage(params: {
  cfg: OpenClawConfig;
  raw: string | undefined;
  defaultProvider?: string;
}): string | undefined {
  const raw = normalizeOptionalString(params.raw);
  if (!raw || !shouldEnforceSupportedModelProviderIds(params.cfg)) {
    return undefined;
  }
  const resolvedKey = resolveModelKeyForSupportedPolicy({
    cfg: params.cfg,
    raw,
    defaultProvider: params.defaultProvider,
  });
  return isSupportedModelRef(resolvedKey)
    ? undefined
    : formatUnsupportedModelRefMessage(resolvedKey);
}

export function assertSupportedResolvedModelRef(params: {
  cfg: OpenClawConfig;
  raw: string | undefined;
  defaultProvider?: string;
}): void {
  const message = formatUnsupportedResolvedModelRefMessage(params);
  if (message) {
    throw new Error(message);
  }
}
