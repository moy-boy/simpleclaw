import {
  resolveAgentDir,
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
} from "../../agents/agent-scope.js";
import { externalCliDiscoveryForProviderAuth } from "../../agents/auth-profiles.js";
import {
  listProfilesForProvider,
  promoteAuthProfileInOrder,
  upsertAuthProfileWithLock,
} from "../../agents/auth-profiles/profiles.js";
import { loadAuthProfileStoreForRuntime } from "../../agents/auth-profiles/store.js";
import type { AuthProfileCredential } from "../../agents/auth-profiles/types.js";
import { clearAuthProfileCooldown } from "../../agents/auth-profiles/usage.js";
import { normalizeProviderId } from "../../agents/model-selection-normalize.js";
import { resolveDefaultAgentWorkspaceDir } from "../../agents/workspace.js";
import { formatCliCommand } from "../../cli/command-format.js";
import { logConfigUpdated } from "../../config/logging.js";
import { normalizeAgentModelRefForConfig } from "../../config/model-input.js";
import type { OpenClawConfig } from "../../config/types.openclaw.js";
import {
  applyProviderAuthConfigPatch,
  applyDefaultModel,
  pickAuthMethod,
  restorePriorAgentsDefaultsModelUnlessOptIn,
  resolveProviderMatch,
} from "../../plugins/provider-auth-choice-helpers.js";
import { applyAuthProfileConfig } from "../../plugins/provider-auth-helpers.js";
import { createVpsAwareOAuthHandlers } from "../../plugins/provider-oauth-flow.js";
import { resolvePluginProviders } from "../../plugins/providers.runtime.js";
import {
  resolvePluginSetupProvider,
  resolvePluginSetupRegistry,
} from "../../plugins/setup-registry.js";
import type {
  ProviderAuthMethod,
  ProviderAuthResult,
  ProviderPlugin,
} from "../../plugins/types.js";
import type { RuntimeEnv } from "../../runtime.js";
import { normalizeOptionalString } from "../../shared/string-coerce.js";
import { createClackPrompter } from "../../wizard/clack-prompter.js";
import { repairCodexRuntimePluginInstallForModelSelection } from "../codex-runtime-plugin-install.js";
import { isRemoteEnvironment } from "../oauth-env.js";
import {
  formatUnsupportedModelProviderMessage,
  isSupportedModelProviderId,
  shouldEnforceSupportedModelProviderIds,
} from "../supported-surface.js";
import { loadValidConfigOrThrow, resolveKnownAgentId, updateConfig } from "./shared.js";

type UpsertAuthProfileParams = Parameters<typeof upsertAuthProfileWithLock>[0];

type ResolvedModelsAuthContext = {
  config: OpenClawConfig;
  agentDir: string;
  workspaceDir: string;
  providers: ProviderPlugin[];
};

function listProvidersWithAuthMethods(providers: ProviderPlugin[]): ProviderPlugin[] {
  return providers.filter((provider) => provider.auth.length > 0);
}

function isSubscriptionAuthMethod(method: ProviderAuthMethod): boolean {
  return method.kind === "oauth" || method.kind === "device_code";
}

function filterSupportedSubscriptionProviders(
  providers: readonly ProviderPlugin[],
): ProviderPlugin[] {
  return providers
    .filter((provider) => isSupportedModelProviderId(provider.id))
    .map((provider) =>
      Object.assign({}, provider, { auth: provider.auth.filter(isSubscriptionAuthMethod) }),
    )
    .filter((provider) => provider.auth.length > 0);
}

function assertSupportedRequestedProvider(params: {
  config: OpenClawConfig;
  provider?: string;
}): void {
  const provider = normalizeOptionalString(params.provider);
  if (
    !provider ||
    !shouldEnforceSupportedModelProviderIds(params.config) ||
    isSupportedModelProviderId(provider)
  ) {
    return;
  }
  throw new Error(formatUnsupportedModelProviderMessage(provider));
}

function mergeSetupProviders(
  providers: readonly ProviderPlugin[],
  setupProviders: readonly ProviderPlugin[],
): ProviderPlugin[] {
  if (setupProviders.length === 0) {
    return [...providers];
  }
  const setupById = new Map(
    setupProviders.map((provider) => [normalizeProviderId(provider.id), provider] as const),
  );
  const merged = providers.map(
    (provider) => setupById.get(normalizeProviderId(provider.id)) ?? provider,
  );
  const existing = new Set(merged.map((provider) => normalizeProviderId(provider.id)));
  for (const provider of setupProviders) {
    if (!existing.has(normalizeProviderId(provider.id))) {
      merged.push(provider);
    }
  }
  return merged;
}

function preferSetupAuthProviders(params: {
  providers: readonly ProviderPlugin[];
  config: OpenClawConfig;
  workspaceDir: string;
  requestedProvider?: string;
}): ProviderPlugin[] {
  const requestedProvider = params.requestedProvider?.trim();
  if (requestedProvider) {
    const setupProvider = resolvePluginSetupProvider({
      provider: requestedProvider,
      config: params.config,
      workspaceDir: params.workspaceDir,
    });
    return setupProvider ? [setupProvider] : [...params.providers];
  }

  const setupProviders = resolvePluginSetupRegistry({
    config: params.config,
    workspaceDir: params.workspaceDir,
  }).providers.map((entry) => entry.provider);
  return mergeSetupProviders(params.providers, setupProviders);
}

async function resolveModelsAuthContext(params?: {
  requestedProvider?: string;
  rawAgentId?: string | null;
}): Promise<ResolvedModelsAuthContext> {
  const config = await loadValidConfigOrThrow();
  assertSupportedRequestedProvider({ config, provider: params?.requestedProvider });
  const agentId =
    resolveKnownAgentId({ cfg: config, rawAgentId: params?.rawAgentId }) ??
    resolveDefaultAgentId(config);
  const agentDir = resolveAgentDir(config, agentId);
  const workspaceDir =
    resolveAgentWorkspaceDir(config, agentId) ?? resolveDefaultAgentWorkspaceDir();
  const providers = resolvePluginProviders({
    config,
    workspaceDir,
    mode: "setup",
    includeUntrustedWorkspacePlugins: false,
    bundledProviderAllowlistCompat: true,
    bundledProviderVitestCompat: true,
    ...(params?.requestedProvider?.trim()
      ? { providerRefs: [params.requestedProvider], activate: true }
      : {}),
  });
  const authProviders = preferSetupAuthProviders({
    providers,
    config,
    workspaceDir,
    requestedProvider: params?.requestedProvider,
  });
  return {
    config,
    agentDir,
    workspaceDir,
    providers: shouldEnforceSupportedModelProviderIds(config)
      ? filterSupportedSubscriptionProviders(authProviders)
      : authProviders,
  };
}

function resolveRequestedProviderOrThrow(
  providers: ProviderPlugin[],
  rawProvider?: string,
): ProviderPlugin | null {
  const requested = rawProvider?.trim();
  if (!requested) {
    return null;
  }
  const matched = resolveProviderMatch(providers, requested);
  if (matched) {
    return matched;
  }
  const available = providers
    .map((provider) => provider.id)
    .filter(Boolean)
    .toSorted((a, b) => a.localeCompare(b));
  const availableText = available.length > 0 ? available.join(", ") : "(none)";
  throw new Error(
    `Unknown provider "${requested}". Loaded providers: ${availableText}. Verify plugins via \`${formatCliCommand("openclaw plugins list --json")}\`.`,
  );
}

async function pickProviderAuthMethod(params: {
  provider: ProviderPlugin;
  requestedMethod?: string;
  prompter: ReturnType<typeof createClackPrompter>;
}) {
  const rawRequestedMethod = params.requestedMethod?.trim();
  if (rawRequestedMethod) {
    return pickAuthMethod(params.provider, rawRequestedMethod);
  }
  const oauthMethod = params.provider.auth.find((method) => method.kind === "oauth");
  if (oauthMethod) {
    return oauthMethod;
  }
  if (params.provider.auth.length === 1) {
    return params.provider.auth[0] ?? null;
  }
  return await params.prompter
    .select({
      message: `Auth method for ${params.provider.label}`,
      options: params.provider.auth.map((method) => ({
        value: method.id,
        label: method.label,
        hint: method.hint,
      })),
    })
    .then((id) => params.provider.auth.find((method) => method.id === id) ?? null);
}

async function persistProviderAuthResult(params: {
  result: ProviderAuthResult;
  profiles?: ProviderAuthResult["profiles"];
  agentDir: string;
  runtime: RuntimeEnv;
  prompter: ReturnType<typeof createClackPrompter>;
  setDefault?: boolean;
}) {
  const defaultModel = params.result.defaultModel
    ? normalizeAgentModelRefForConfig(params.result.defaultModel)
    : undefined;
  const profiles = params.profiles ?? params.result.profiles;

  for (const profile of profiles) {
    await upsertAuthProfileWithLockOrThrow({
      profileId: profile.profileId,
      credential: profile.credential,
      agentDir: params.agentDir,
    });
    await promoteAuthProfileInOrder({
      agentDir: params.agentDir,
      provider: profile.credential.provider,
      profileId: profile.profileId,
    });
  }

  const updated = await updateConfig((cfg) => {
    const priorAgentsDefaultsModel = cfg.agents?.defaults?.model;
    let next = cfg;
    if (params.result.configPatch) {
      next = applyProviderAuthConfigPatch(next, params.result.configPatch, {
        replaceDefaultModels: params.result.replaceDefaultModels,
      });
    }
    for (const profile of profiles) {
      next = applyAuthProfileConfig(next, {
        profileId: profile.profileId,
        provider: profile.credential.provider,
        mode: credentialMode(profile.credential),
      });
    }
    next = restorePriorAgentsDefaultsModelUnlessOptIn({
      cfg: next,
      priorAgentsDefaultsModel,
      setDefault: params.setDefault,
    });
    if (params.setDefault && defaultModel) {
      next = applyDefaultModel(next, defaultModel);
    }
    return next;
  });
  if (defaultModel) {
    const repaired = await repairCodexRuntimePluginInstallForModelSelection({
      cfg: updated,
      model: defaultModel,
    });
    for (const warning of repaired.warnings) {
      params.runtime.error?.(warning);
    }
  }

  logConfigUpdated(params.runtime);
  for (const profile of profiles) {
    params.runtime.log(
      `Auth profile: ${profile.profileId} (${profile.credential.provider}/${credentialMode(profile.credential)})`,
    );
  }
  if (defaultModel) {
    params.runtime.log(
      params.setDefault
        ? `Default model set to ${defaultModel}`
        : `Default model available: ${defaultModel} (use --set-default to apply)`,
    );
  }
  if (params.result.notes && params.result.notes.length > 0) {
    await params.prompter.note(params.result.notes.join("\n"), "Provider notes");
  }
}

async function runProviderAuthMethod(params: {
  config: OpenClawConfig;
  agentDir: string;
  workspaceDir: string;
  provider: ProviderPlugin;
  method: ProviderAuthMethod;
  runtime: RuntimeEnv;
  prompter: ReturnType<typeof createClackPrompter>;
  profileId?: string;
  setDefault?: boolean;
}) {
  const selectedProviderId = normalizeProviderId(params.provider.id);
  await clearStaleProfileLockouts(selectedProviderId, params.agentDir);

  const result = await params.method.run({
    config: params.config,
    env: process.env,
    agentDir: params.agentDir,
    workspaceDir: params.workspaceDir,
    prompter: params.prompter,
    runtime: params.runtime,
    allowSecretRefPrompt: false,
    isRemote: isRemoteEnvironment(),
    openUrl: async (url) => {
      const { openUrl } = await import("../onboard-helpers.js");
      await openUrl(url);
    },
    oauth: {
      createVpsAwareHandlers: (runtimeParams) => createVpsAwareOAuthHandlers(runtimeParams),
    },
  });
  const resultProviderIds = new Set(
    result.profiles.map((profile) => normalizeProviderId(profile.credential.provider)),
  );
  for (const providerId of resultProviderIds) {
    if (providerId && providerId !== selectedProviderId) {
      await clearStaleProfileLockouts(providerId, params.agentDir);
    }
  }

  const profiles = resolveLoginProfiles({
    result,
    requestedProfileId: params.profileId,
  });

  await persistProviderAuthResult({
    result,
    profiles,
    agentDir: params.agentDir,
    runtime: params.runtime,
    prompter: params.prompter,
    setDefault: params.setDefault,
  });
}

async function upsertAuthProfileWithLockOrThrow(params: UpsertAuthProfileParams): Promise<void> {
  const updated = await upsertAuthProfileWithLock(params);
  if (!updated) {
    throw new Error(
      "Failed to update auth profile store; the auth store lock may be busy. Wait a moment and retry.",
    );
  }
}

export async function modelsAuthAddCommand(opts: { agent?: string }, runtime: RuntimeEnv) {
  await modelsAuthLoginCommand({ provider: "openai", agent: opts.agent }, runtime);
}

type LoginOptions = {
  provider?: string;
  method?: string;
  profileId?: string;
  setDefault?: boolean;
  yes?: boolean;
  agent?: string;
};

/**
 * Clear stale cooldown/disabled state for all profiles matching a provider.
 * When a user explicitly runs `models auth login`, they intend to fix auth —
 * stale `auth_permanent` / `billing` lockouts should not persist across
 * a deliberate re-authentication attempt.
 */
async function clearStaleProfileLockouts(provider: string, agentDir: string): Promise<void> {
  try {
    const store = loadAuthProfileStoreForRuntime(agentDir, {
      externalCli: externalCliDiscoveryForProviderAuth({ provider }),
    });
    const profileIds = listProfilesForProvider(store, provider);
    for (const profileId of profileIds) {
      await clearAuthProfileCooldown({ store, profileId, agentDir });
    }
  } catch {
    // Best-effort housekeeping — never block re-authentication.
  }
}

export function resolveRequestedLoginProviderOrThrow(
  providers: ProviderPlugin[],
  rawProvider?: string,
): ProviderPlugin | null {
  return resolveRequestedProviderOrThrow(providers, rawProvider);
}

function credentialMode(credential: AuthProfileCredential): "api_key" | "oauth" | "token" {
  if (credential.type === "api_key") {
    return "api_key";
  }
  if (credential.type === "token") {
    return "token";
  }
  return "oauth";
}

export function resolveLoginProfiles(params: {
  result: ProviderAuthResult;
  requestedProfileId?: string;
}): ProviderAuthResult["profiles"] {
  const requestedProfileId = params.requestedProfileId?.trim();
  if (!requestedProfileId) {
    return params.result.profiles;
  }

  if (params.result.profiles.length !== 1) {
    throw new Error(
      "--profile-id requires exactly one returned auth profile from the selected auth method.",
    );
  }

  const [profile] = params.result.profiles;
  return [{ ...profile, profileId: requestedProfileId }];
}

function maybeLogOpenAICodexNativeSearchTip(runtime: RuntimeEnv, providerId: string) {
  if (providerId !== "openai-codex") {
    return;
  }
  runtime.log(
    "Tip: Codex-capable models can use native Codex web search. Enable it with openclaw configure --section web (recommended mode: cached). Docs: https://docs.openclaw.ai/tools/web",
  );
}

export async function modelsAuthLoginCommand(opts: LoginOptions, runtime: RuntimeEnv) {
  if (!process.stdin.isTTY) {
    throw new Error("models auth login requires an interactive TTY for OpenAI subscription auth.");
  }

  const { config, agentDir, workspaceDir, providers } = await resolveModelsAuthContext({
    requestedProvider: opts.provider,
    rawAgentId: opts.agent,
  });
  const prompter = createClackPrompter();
  const authProviders = listProvidersWithAuthMethods(providers);
  if (authProviders.length === 0) {
    throw new Error(
      `No provider plugins found. Install one via \`${formatCliCommand("openclaw plugins install")}\`.`,
    );
  }

  const requestedProvider = resolveRequestedLoginProviderOrThrow(authProviders, opts.provider);
  const selectedProvider =
    requestedProvider ??
    (await prompter
      .select({
        message: "Select a provider",
        options: authProviders.map((provider) => ({
          value: provider.id,
          label: provider.label,
          hint: provider.docsPath ? `Docs: ${provider.docsPath}` : undefined,
        })),
      })
      .then((id) => resolveProviderMatch(authProviders, id)));

  if (!selectedProvider) {
    throw new Error(
      `Unknown provider. Run ${formatCliCommand("openclaw models status")} or ${formatCliCommand("openclaw plugins list")} to see available provider plugins.`,
    );
  }
  const chosenMethod = await pickProviderAuthMethod({
    provider: selectedProvider,
    requestedMethod: opts.method,
    prompter,
  });

  if (!chosenMethod) {
    throw new Error(
      `Unknown auth method. Run ${formatCliCommand("openclaw models auth login --provider " + selectedProvider.id)} without --method to choose interactively.`,
    );
  }
  if (shouldEnforceSupportedModelProviderIds(config) && !isSubscriptionAuthMethod(chosenMethod)) {
    throw new Error(
      "This setup supports OpenAI subscription login only. Use --method oauth or --device-code.",
    );
  }

  await runProviderAuthMethod({
    config,
    agentDir,
    workspaceDir,
    provider: selectedProvider,
    method: chosenMethod,
    runtime,
    prompter,
    profileId: opts.profileId,
    setDefault: opts.setDefault,
  });
  maybeLogOpenAICodexNativeSearchTip(runtime, selectedProvider.id);
}
