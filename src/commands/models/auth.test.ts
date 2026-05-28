import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import type { ProviderPlugin } from "../../plugins/types.js";
import type { RuntimeEnv } from "../../runtime.js";

type UpsertAuthProfileCall = {
  agentDir?: string;
  credential?: {
    provider?: string;
    type?: string;
  };
  profileId?: string;
};

const mocks = vi.hoisted(() => ({
  clackCancel: vi.fn(),
  clackConfirm: vi.fn(),
  clackIsCancel: vi.fn((value: unknown) => value === Symbol.for("clack:cancel")),
  clackPassword: vi.fn(),
  clackSelect: vi.fn(),
  clackText: vi.fn(),
  resolveDefaultAgentId: vi.fn(),
  resolveAgentDir: vi.fn(),
  resolveAgentWorkspaceDir: vi.fn(),
  resolveDefaultAgentWorkspaceDir: vi.fn(),
  upsertAuthProfileWithLock: vi.fn(),
  resolvePluginProviders: vi.fn(),
  createClackPrompter: vi.fn(),
  loadValidConfigOrThrow: vi.fn(),
  updateConfig: vi.fn(),
  logConfigUpdated: vi.fn(),
  isRemoteEnvironment: vi.fn(() => false),
  loadAuthProfileStoreForRuntime: vi.fn(),
  listProfilesForProvider: vi.fn(),
  promoteAuthProfileInOrder: vi.fn(),
  clearAuthProfileCooldown: vi.fn(),
  resolvePluginSetupProvider: vi.fn(),
  resolvePluginSetupRegistry: vi.fn(),
  repairCodexRuntimePluginInstallForModelSelection: vi.fn(),
}));

vi.mock("@clack/prompts", () => ({
  cancel: mocks.clackCancel,
  confirm: mocks.clackConfirm,
  isCancel: mocks.clackIsCancel,
  password: mocks.clackPassword,
  select: mocks.clackSelect,
  text: mocks.clackText,
}));

vi.mock("../../agents/agent-scope.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../agents/agent-scope.js")>();
  return {
    ...actual,
    resolveDefaultAgentId: mocks.resolveDefaultAgentId,
    resolveAgentDir: mocks.resolveAgentDir,
    resolveAgentWorkspaceDir: mocks.resolveAgentWorkspaceDir,
  };
});

vi.mock("../../agents/auth-profiles/profiles.js", () => ({
  listProfilesForProvider: mocks.listProfilesForProvider,
  promoteAuthProfileInOrder: mocks.promoteAuthProfileInOrder,
  upsertAuthProfileWithLock: mocks.upsertAuthProfileWithLock,
}));

vi.mock("../../agents/auth-profiles/store.js", () => ({
  loadAuthProfileStoreForRuntime: mocks.loadAuthProfileStoreForRuntime,
}));

vi.mock("../../agents/auth-profiles/usage.js", () => ({
  clearAuthProfileCooldown: mocks.clearAuthProfileCooldown,
}));

vi.mock("../../agents/workspace.js", () => ({
  resolveDefaultAgentWorkspaceDir: mocks.resolveDefaultAgentWorkspaceDir,
}));

vi.mock("../../config/logging.js", () => ({
  logConfigUpdated: mocks.logConfigUpdated,
}));

vi.mock("../../plugins/provider-auth-helpers.js", () => ({
  applyAuthProfileConfig: (
    cfg: OpenClawConfig,
    params: {
      profileId: string;
      provider: string;
      mode: "api_key" | "aws-sdk" | "oauth" | "token";
    },
  ): OpenClawConfig => ({
    ...cfg,
    auth: {
      ...cfg.auth,
      profiles: {
        ...cfg.auth?.profiles,
        [params.profileId]: {
          provider: params.provider,
          mode: params.mode,
        },
      },
    },
  }),
}));

vi.mock("../../plugins/provider-auth-choice-helpers.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../plugins/provider-auth-choice-helpers.js")>();
  const normalize = (value: string | undefined) => value?.trim().toLowerCase() ?? "";

  return {
    ...actual,
    resolveProviderMatch: vi.fn((providers: ProviderPlugin[], rawProvider?: string) => {
      const requested = normalize(rawProvider);
      return (
        providers.find((provider) => normalize(provider.id) === requested) ??
        providers.find((provider) =>
          provider.aliases?.some((alias) => normalize(alias) === requested),
        ) ??
        null
      );
    }),
    pickAuthMethod: vi.fn((provider: ProviderPlugin, rawMethod?: string) => {
      const requested = normalize(rawMethod);
      return (
        provider.auth.find((method) => normalize(method.id) === requested) ??
        provider.auth.find((method) => normalize(method.label) === requested) ??
        null
      );
    }),
    applyProviderAuthConfigPatch: vi.fn((cfg: OpenClawConfig) => cfg),
    applyDefaultModel: vi.fn((cfg: OpenClawConfig, model: string) => ({
      ...cfg,
      agents: {
        ...cfg.agents,
        defaults: {
          ...cfg.agents?.defaults,
          models: {
            ...cfg.agents?.defaults?.models,
            [model]: cfg.agents?.defaults?.models?.[model] ?? {},
          },
          model: { primary: model },
        },
      },
    })),
  };
});

vi.mock("../../plugins/provider-oauth-flow.js", () => ({
  createVpsAwareOAuthHandlers: vi.fn(() => ({
    onAuth: vi.fn(),
    onPrompt: vi.fn(),
  })),
}));

vi.mock("../../plugins/providers.runtime.js", () => ({
  resolvePluginProviders: mocks.resolvePluginProviders,
}));

vi.mock("../../plugins/setup-registry.js", () => ({
  resolvePluginSetupProvider: mocks.resolvePluginSetupProvider,
  resolvePluginSetupRegistry: mocks.resolvePluginSetupRegistry,
}));

vi.mock("../../wizard/clack-prompter.js", () => ({
  createClackPrompter: mocks.createClackPrompter,
}));

vi.mock("../codex-runtime-plugin-install.js", () => ({
  repairCodexRuntimePluginInstallForModelSelection:
    mocks.repairCodexRuntimePluginInstallForModelSelection,
}));

vi.mock("../oauth-env.js", () => ({
  isRemoteEnvironment: mocks.isRemoteEnvironment,
}));

vi.mock("./shared.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./shared.js")>();
  return {
    ...actual,
    loadValidConfigOrThrow: mocks.loadValidConfigOrThrow,
    updateConfig: mocks.updateConfig,
  };
});

const { modelsAuthAddCommand, modelsAuthLoginCommand } = await import("./auth.js");

function createRuntime(): RuntimeEnv {
  return {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(),
  };
}

function withInteractiveStdin() {
  const stdin = process.stdin as NodeJS.ReadStream & { isTTY?: boolean };
  const hadOwnIsTTY = Object.prototype.hasOwnProperty.call(stdin, "isTTY");
  const previousIsTTYDescriptor = Object.getOwnPropertyDescriptor(stdin, "isTTY");
  Object.defineProperty(stdin, "isTTY", {
    configurable: true,
    enumerable: true,
    get: () => true,
  });
  return () => {
    if (previousIsTTYDescriptor) {
      Object.defineProperty(stdin, "isTTY", previousIsTTYDescriptor);
    } else if (!hadOwnIsTTY) {
      delete (stdin as { isTTY?: boolean }).isTTY;
    }
  };
}

function createProvider(params: {
  id: string;
  label?: string;
  auth?: ProviderPlugin["auth"];
  run: NonNullable<ProviderPlugin["auth"]>[number]["run"];
}): ProviderPlugin {
  return {
    id: params.id,
    label: params.label ?? params.id,
    auth: params.auth ?? [
      {
        id: "oauth",
        label: "OAuth",
        kind: "oauth",
        run: params.run,
      },
    ],
  };
}

function readFirstUpsertCall(): UpsertAuthProfileCall {
  const call = mocks.upsertAuthProfileWithLock.mock.calls[0]?.[0];
  if (!call) {
    throw new Error("Expected auth profile upsert");
  }
  return call as UpsertAuthProfileCall;
}

describe("models auth simplified surface", () => {
  let restoreStdin: (() => void) | null = null;
  let currentConfig: OpenClawConfig;
  let lastUpdatedConfig: OpenClawConfig | null;
  let runOpenAIAuth: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    restoreStdin = withInteractiveStdin();
    currentConfig = {};
    lastUpdatedConfig = null;
    mocks.resolveDefaultAgentId.mockReturnValue("main");
    mocks.resolveAgentDir.mockReturnValue("/tmp/openclaw/agents/main");
    mocks.resolveAgentWorkspaceDir.mockReturnValue("/tmp/openclaw/workspace");
    mocks.resolveDefaultAgentWorkspaceDir.mockReturnValue("/tmp/openclaw/workspace");
    mocks.loadValidConfigOrThrow.mockImplementation(async () => currentConfig);
    mocks.updateConfig.mockImplementation(
      async (mutator: (cfg: OpenClawConfig) => OpenClawConfig) => {
        lastUpdatedConfig = mutator(currentConfig);
        currentConfig = lastUpdatedConfig;
        return lastUpdatedConfig;
      },
    );
    mocks.createClackPrompter.mockReturnValue({
      note: vi.fn(async () => {}),
      select: vi.fn(),
    });
    mocks.upsertAuthProfileWithLock.mockResolvedValue({ version: 1, profiles: {} });
    mocks.loadAuthProfileStoreForRuntime.mockReturnValue({ profiles: {}, usageStats: {} });
    mocks.listProfilesForProvider.mockReturnValue([]);
    mocks.clearAuthProfileCooldown.mockResolvedValue(undefined);
    mocks.resolvePluginSetupRegistry.mockReturnValue({
      providers: [],
      cliBackends: [],
      configMigrations: [],
      autoEnableProbes: [],
      diagnostics: [],
    });
    mocks.repairCodexRuntimePluginInstallForModelSelection.mockResolvedValue({ warnings: [] });
    runOpenAIAuth = vi.fn().mockResolvedValue({
      profiles: [
        {
          profileId: "openai-codex:user@example.com",
          credential: {
            type: "oauth",
            provider: "openai-codex",
            access: "access-token",
            refresh: "refresh-token",
            expires: Date.now() + 60_000,
            email: "user@example.com",
          },
        },
      ],
      defaultModel: "openai-codex/gpt-5.5",
    });
    mocks.resolvePluginProviders.mockReturnValue([
      createProvider({
        id: "openai-codex",
        label: "OpenAI Codex",
        run: runOpenAIAuth as ProviderPlugin["auth"][number]["run"],
      }),
    ]);
    mocks.resolvePluginSetupProvider.mockReturnValue(undefined);
  });

  afterEach(() => {
    restoreStdin?.();
    restoreStdin = null;
  });

  it("runs OpenAI subscription login through the bundled Codex provider", async () => {
    const runtime = createRuntime();

    await modelsAuthLoginCommand({ provider: "openai-codex" }, runtime);

    expect(runOpenAIAuth).toHaveBeenCalledOnce();
    const upsertCall = readFirstUpsertCall();
    expect(upsertCall.profileId).toBe("openai-codex:user@example.com");
    expect(upsertCall.credential?.type).toBe("oauth");
    expect(upsertCall.credential?.provider).toBe("openai-codex");
    expect(upsertCall.agentDir).toBe("/tmp/openclaw/agents/main");
    expect(lastUpdatedConfig?.auth?.profiles?.["openai-codex:user@example.com"]).toEqual({
      provider: "openai-codex",
      mode: "oauth",
    });
    expect(runtime.log).toHaveBeenCalledWith(
      "Auth profile: openai-codex:user@example.com (openai-codex/oauth)",
    );
  });

  it("maps openai login to the subscription OAuth setup provider and filters API-key methods", async () => {
    const runtime = createRuntime();
    const runOauthAuth = vi.fn().mockResolvedValue({
      profiles: [
        {
          profileId: "openai-codex:user@example.com",
          credential: {
            type: "oauth",
            provider: "openai-codex",
            access: "access-token",
            refresh: "refresh-token",
          },
        },
      ],
    });
    const runApiKeyAuth = vi.fn().mockResolvedValue({ profiles: [] });
    mocks.resolvePluginProviders.mockReturnValue([]);
    mocks.resolvePluginSetupProvider.mockReturnValue(
      createProvider({
        id: "openai",
        label: "OpenAI",
        run: runOauthAuth as ProviderPlugin["auth"][number]["run"],
        auth: [
          {
            id: "oauth",
            label: "ChatGPT Login",
            kind: "oauth",
            run: runOauthAuth,
          },
          {
            id: "api-key",
            label: "OpenAI API Key",
            kind: "api_key",
            run: runApiKeyAuth,
          },
        ],
      }),
    );

    await modelsAuthLoginCommand({ provider: "openai" }, runtime);

    expect(runOauthAuth).toHaveBeenCalledOnce();
    expect(runApiKeyAuth).not.toHaveBeenCalled();
    await expect(
      modelsAuthLoginCommand({ provider: "openai", method: "api-key" }, runtime),
    ).rejects.toThrow("Unknown auth method");
  });

  it("rejects non-OpenAI model auth providers before loading plugins", async () => {
    const runtime = createRuntime();

    await expect(modelsAuthLoginCommand({ provider: "anthropic" }, runtime)).rejects.toThrow(
      'Unsupported provider "anthropic".',
    );
    expect(mocks.resolvePluginProviders).not.toHaveBeenCalled();
  });

  it("uses OpenAI login for interactive auth add", async () => {
    const runtime = createRuntime();
    mocks.resolvePluginProviders.mockReturnValue([]);
    mocks.resolvePluginSetupProvider.mockReturnValue(
      createProvider({
        id: "openai",
        label: "OpenAI",
        run: runOpenAIAuth as ProviderPlugin["auth"][number]["run"],
      }),
    );

    await modelsAuthAddCommand({}, runtime);

    expect(mocks.resolvePluginSetupProvider).toHaveBeenCalledWith({
      provider: "openai",
      config: {},
      workspaceDir: "/tmp/openclaw/workspace",
    });
    expect(runOpenAIAuth).toHaveBeenCalledOnce();
  });
});
