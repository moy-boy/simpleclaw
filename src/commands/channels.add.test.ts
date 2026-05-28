import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getBundledChannelSetupPlugin } from "../channels/plugins/bundled.js";
import type { ChannelPlugin } from "../channels/plugins/types.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import { resetPluginRuntimeStateForTest, setActivePluginRegistry } from "../plugins/runtime.js";
import { DEFAULT_ACCOUNT_ID } from "../routing/session-key.js";
import { createChannelTestPluginBase, createTestRegistry } from "../test-utils/channel-plugins.js";
import {
  ensureChannelSetupPluginInstalled,
  loadChannelSetupPluginRegistrySnapshotForChannel,
} from "./channel-setup/plugin-install.js";
import { configMocks, lifecycleMocks } from "./channels.mock-harness.js";
import { baseConfigSnapshot, createTestRuntime } from "./test-runtime-config-helpers.js";

let channelsAddCommand: typeof import("./channels/add.js").channelsAddCommand;

const catalogMocks = vi.hoisted(() => ({
  getChannelPluginCatalogEntry: vi.fn(),
  listChannelPluginCatalogEntries: vi.fn(() => []),
}));

const discoveryMocks = vi.hoisted(() => ({
  isCatalogChannelInstalled: vi.fn(() => false),
}));

const pluginInstallMocks = vi.hoisted(() => ({
  ensureChannelSetupPluginInstalled: vi.fn(),
  loadChannelSetupPluginRegistrySnapshotForChannel: vi.fn(),
}));

const registryRefreshMocks = vi.hoisted(() => ({
  refreshPluginRegistryAfterConfigMutation: vi.fn(async () => undefined),
}));

const pluginInstallRecordCommitMocks = vi.hoisted(() => ({
  commitConfigWithPendingPluginInstalls: vi.fn(),
}));

const channelWizardMocks = vi.hoisted(() => {
  const prompter = {
    intro: vi.fn(async () => undefined),
    outro: vi.fn(async () => undefined),
    confirm: vi.fn(async () => false),
    note: vi.fn(async () => undefined),
    select: vi.fn(),
    text: vi.fn(),
  };
  return {
    prompter,
    setupChannels: vi.fn(async (...args: unknown[]) => args[0] as OpenClawConfig),
  };
});

const bundledMocks = vi.hoisted(() => ({
  getBundledChannelPlugin: vi.fn(() => undefined),
  getBundledChannelSetupPlugin: vi.fn(() => undefined),
}));

vi.mock("../channels/plugins/catalog.js", () => ({
  getChannelPluginCatalogEntry: catalogMocks.getChannelPluginCatalogEntry,
  listChannelPluginCatalogEntries: catalogMocks.listChannelPluginCatalogEntries,
}));

vi.mock("./channel-setup/discovery.js", () => ({
  isCatalogChannelInstalled: discoveryMocks.isCatalogChannelInstalled,
}));

vi.mock("../channels/plugins/bundled.js", async () => {
  const actual = await vi.importActual<typeof import("../channels/plugins/bundled.js")>(
    "../channels/plugins/bundled.js",
  );
  return {
    ...actual,
    getBundledChannelPlugin: bundledMocks.getBundledChannelPlugin,
    getBundledChannelSetupPlugin: bundledMocks.getBundledChannelSetupPlugin,
  };
});

vi.mock("./channel-setup/plugin-install.js", () => pluginInstallMocks);

vi.mock("../cli/plugins-registry-refresh.js", () => registryRefreshMocks);

vi.mock("../cli/plugins-install-record-commit.js", () => pluginInstallRecordCommitMocks);

vi.mock("../wizard/clack-prompter.js", () => ({
  createClackPrompter: () => channelWizardMocks.prompter,
}));

vi.mock("./onboard-channels.js", async () => {
  const actual =
    await vi.importActual<typeof import("./onboard-channels.js")>("./onboard-channels.js");
  return {
    ...actual,
    setupChannels: (...args: Parameters<typeof actual.setupChannels>) =>
      channelWizardMocks.setupChannels(...args),
  };
});

const runtime = createTestRuntime();

type MockCallSource = {
  mock: {
    calls: ArrayLike<ReadonlyArray<unknown>>;
  };
};

function listConfiguredAccountIds(
  channelConfig: { accounts?: Record<string, unknown>; token?: string } | undefined,
): string[] {
  const accountIds = Object.keys(channelConfig?.accounts ?? {});
  if (accountIds.length > 0) {
    return accountIds;
  }
  if (channelConfig?.token) {
    return [DEFAULT_ACCOUNT_ID];
  }
  return [];
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error(`expected ${label}`);
  }
  return value as Record<string, unknown>;
}

function mockArg(source: MockCallSource, callIndex: number, argIndex: number, label: string) {
  const call = source.mock.calls[callIndex];
  if (!call) {
    throw new Error(`Expected mock call: ${label}`);
  }
  if (argIndex >= call.length) {
    throw new Error(`Expected mock call argument ${argIndex}: ${label}`);
  }
  return call[argIndex];
}

function writtenConfig(index = 0) {
  return requireRecord(
    mockArg(configMocks.writeConfigFile, index, 0, `written config ${index}`),
    `written config ${index}`,
  );
}

function writtenChannel(channel: string, index = 0) {
  return requireRecord(
    requireRecord(writtenConfig(index).channels, `written channels ${index}`)[channel],
    `written channel ${channel}`,
  );
}

function setupOptions() {
  return requireRecord(
    mockArg(channelWizardMocks.setupChannels, 0, 3, "setup options"),
    "setup options",
  );
}

function setupChannelArg(index: number) {
  return mockArg(channelWizardMocks.setupChannels, 0, index, `setup channel arg ${index}`);
}

function createLifecycleTelegramAddTestPlugin(): ChannelPlugin {
  const resolveLifecycleTelegramAccount = (
    cfg: Parameters<NonNullable<ChannelPlugin["config"]["resolveAccount"]>>[0],
    accountId: string,
  ) => {
    const telegram = cfg.channels?.telegram as
      | {
          token?: string;
          enabled?: boolean;
          accounts?: Record<string, { token?: string; enabled?: boolean }>;
        }
      | undefined;
    const resolvedAccountId = accountId || DEFAULT_ACCOUNT_ID;
    const scoped = telegram?.accounts?.[resolvedAccountId];
    return {
      token: scoped?.token ?? telegram?.token ?? "",
      enabled:
        typeof scoped?.enabled === "boolean"
          ? scoped.enabled
          : typeof telegram?.enabled === "boolean"
            ? telegram.enabled
            : true,
    };
  };

  return {
    ...createChannelTestPluginBase({
      id: "telegram",
      label: "Telegram",
      docsPath: "/channels/telegram",
    }),
    config: {
      listAccountIds: (cfg) =>
        listConfiguredAccountIds(
          cfg.channels?.telegram as
            | { accounts?: Record<string, unknown>; token?: string }
            | undefined,
        ),
      resolveAccount: resolveLifecycleTelegramAccount,
    },
    setup: {
      resolveAccountId: ({ accountId }) => accountId || DEFAULT_ACCOUNT_ID,
      applyAccountConfig: ({ cfg, accountId, input }) => {
        const telegram = (cfg.channels?.telegram as
          | {
              enabled?: boolean;
              token?: string;
              accounts?: Record<string, { token?: string }>;
            }
          | undefined) ?? { enabled: true };
        const resolvedAccountId = accountId || DEFAULT_ACCOUNT_ID;
        if (resolvedAccountId === DEFAULT_ACCOUNT_ID) {
          return {
            ...cfg,
            channels: {
              ...cfg.channels,
              telegram: {
                ...telegram,
                enabled: true,
                ...(input.token ? { token: input.token } : {}),
              },
            },
          };
        }
        return {
          ...cfg,
          channels: {
            ...cfg.channels,
            telegram: {
              ...telegram,
              enabled: true,
              accounts: {
                ...telegram.accounts,
                [resolvedAccountId]: {
                  ...telegram.accounts?.[resolvedAccountId],
                  ...(input.token ? { token: input.token } : {}),
                },
              },
            },
          },
        };
      },
    },
    lifecycle: {
      onAccountConfigChanged: async ({ prevCfg, nextCfg, accountId }) => {
        const prev = resolveLifecycleTelegramAccount(prevCfg, accountId) as { token?: string };
        const next = resolveLifecycleTelegramAccount(nextCfg, accountId) as { token?: string };
        if ((prev.token ?? "").trim() !== (next.token ?? "").trim()) {
          await lifecycleMocks.onAccountConfigChanged({ accountId });
        }
      },
    },
  } as ChannelPlugin;
}

function setMinimalChannelsAddRegistryForTests(): void {
  setActivePluginRegistry(
    createTestRegistry([
      {
        pluginId: "telegram",
        plugin: createLifecycleTelegramAddTestPlugin(),
        source: "test",
      },
    ]),
  );
}

type DiscordAfterAccountConfigWritten = NonNullable<
  NonNullable<ChannelPlugin["setup"]>["afterAccountConfigWritten"]
>;
type ApplyAccountConfigParams = Parameters<
  NonNullable<NonNullable<ChannelPlugin["setup"]>["applyAccountConfig"]>
>[0];

function createDiscordPlugin(
  afterAccountConfigWritten: DiscordAfterAccountConfigWritten,
): ChannelPlugin {
  return {
    ...createChannelTestPluginBase({
      id: "discord",
      label: "Discord",
    }),
    setup: {
      applyAccountConfig: ({ cfg, accountId, input }) => ({
        ...cfg,
        channels: {
          ...cfg.channels,
          discord: {
            enabled: true,
            accounts: {
              [accountId]: {
                account: input.token,
              },
            },
          },
        },
      }),
      afterAccountConfigWritten,
    },
  } as ChannelPlugin;
}

async function runDiscordAddCommand(afterAccountConfigWritten: DiscordAfterAccountConfigWritten) {
  const plugin = createDiscordPlugin(afterAccountConfigWritten);
  setActivePluginRegistry(createTestRegistry([{ pluginId: "discord", plugin, source: "test" }]));
  configMocks.readConfigFileSnapshot.mockResolvedValue({ ...baseConfigSnapshot });
  await channelsAddCommand({ channel: "discord", account: "ops", token: "ops-token" }, runtime, {
    hasFlags: true,
  });
}

describe("channelsAddCommand", () => {
  beforeAll(async () => {
    ({ channelsAddCommand } = await import("./channels/add.js"));
  });

  beforeEach(async () => {
    resetPluginRuntimeStateForTest();
    configMocks.readConfigFileSnapshot.mockClear();
    configMocks.writeConfigFile.mockClear();
    configMocks.replaceConfigFile
      .mockReset()
      .mockImplementation(async (params: { nextConfig: unknown }) => {
        await configMocks.writeConfigFile(params.nextConfig);
      });
    pluginInstallRecordCommitMocks.commitConfigWithPendingPluginInstalls.mockReset();
    pluginInstallRecordCommitMocks.commitConfigWithPendingPluginInstalls.mockImplementation(
      async (params: { nextConfig: unknown }) => {
        await configMocks.writeConfigFile(params.nextConfig);
        return {
          config: params.nextConfig,
          installRecords: {},
          movedInstallRecords: false,
        };
      },
    );
    lifecycleMocks.onAccountConfigChanged.mockClear();
    runtime.log.mockClear();
    runtime.error.mockClear();
    runtime.exit.mockClear();
    catalogMocks.getChannelPluginCatalogEntry.mockClear();
    catalogMocks.getChannelPluginCatalogEntry.mockReturnValue(undefined);
    catalogMocks.listChannelPluginCatalogEntries.mockClear();
    catalogMocks.listChannelPluginCatalogEntries.mockReturnValue([]);
    discoveryMocks.isCatalogChannelInstalled.mockClear();
    discoveryMocks.isCatalogChannelInstalled.mockReturnValue(false);
    bundledMocks.getBundledChannelPlugin.mockReset();
    bundledMocks.getBundledChannelPlugin.mockReturnValue(undefined);
    bundledMocks.getBundledChannelSetupPlugin.mockReset();
    bundledMocks.getBundledChannelSetupPlugin.mockReturnValue(undefined);
    vi.mocked(ensureChannelSetupPluginInstalled).mockReset();
    vi.mocked(ensureChannelSetupPluginInstalled).mockImplementation(async ({ cfg }) => ({
      cfg,
      installed: true,
      status: "installed",
    }));
    vi.mocked(loadChannelSetupPluginRegistrySnapshotForChannel).mockReset();
    vi.mocked(loadChannelSetupPluginRegistrySnapshotForChannel).mockReturnValue(
      createTestRegistry(),
    );
    registryRefreshMocks.refreshPluginRegistryAfterConfigMutation.mockClear();
    channelWizardMocks.prompter.intro.mockClear();
    channelWizardMocks.prompter.outro.mockClear();
    channelWizardMocks.prompter.confirm.mockClear();
    channelWizardMocks.prompter.note.mockClear();
    channelWizardMocks.prompter.select.mockClear();
    channelWizardMocks.prompter.text.mockClear();
    channelWizardMocks.setupChannels.mockClear();
    channelWizardMocks.setupChannels.mockImplementation(
      async (...args: unknown[]) => args[0] as OpenClawConfig,
    );
    setMinimalChannelsAddRegistryForTests();
  });

  it("keeps guided channel setup lazy until the user selects a channel", async () => {
    const config: OpenClawConfig = { channels: {} };
    configMocks.readConfigFileSnapshot.mockResolvedValue({
      ...baseConfigSnapshot,
      sourceConfig: config,
      config,
    });

    await channelsAddCommand({}, runtime, { hasFlags: false });

    expect(channelWizardMocks.prompter.intro).toHaveBeenCalledWith("Channel setup");
    expect(setupChannelArg(0)).toBe(config);
    expect(setupChannelArg(1)).toBe(runtime);
    expect(setupChannelArg(2)).toBe(channelWizardMocks.prompter);
    expect(setupOptions().deferStatusUntilSelection).toBe(true);
    expect(setupOptions().skipStatusNote).toBe(true);
    expect(setupOptions().promptAccountIds).toBe(true);
    expect(setupOptions().channelIds).toEqual(["telegram", "discord"]);
    expect(configMocks.writeConfigFile).not.toHaveBeenCalled();
    expect(channelWizardMocks.prompter.outro).toHaveBeenCalledWith("No channel changes made.");
  });

  it("exits quietly when guided channel setup is cancelled", async () => {
    const { WizardCancelledError } = await import("../wizard/prompts.js");
    configMocks.readConfigFileSnapshot.mockResolvedValue({
      ...baseConfigSnapshot,
      sourceConfig: { channels: {} },
      config: { channels: {} },
    });
    channelWizardMocks.setupChannels.mockRejectedValue(new WizardCancelledError());

    await channelsAddCommand({}, runtime, { hasFlags: false });

    expect(runtime.exit).toHaveBeenCalledWith(1);
    expect(runtime.error).not.toHaveBeenCalled();
    expect(configMocks.writeConfigFile).not.toHaveBeenCalled();
  });

  it("rejects direct unsupported channel setup when the simplified allowlist is active", async () => {
    const config: OpenClawConfig = {
      channels: {},
      plugins: {
        allow: ["telegram", "discord", "openai", "codex"],
        bundledDiscovery: "allowlist",
      },
    };
    configMocks.readConfigFileSnapshot.mockResolvedValue({
      ...baseConfigSnapshot,
      sourceConfig: config,
      config,
    });

    await channelsAddCommand(
      {
        channel: "whatsapp",
        account: "work",
      },
      runtime,
      { hasFlags: true },
    );

    expect(runtime.error).toHaveBeenCalledWith(
      'Unsupported channel "whatsapp". This setup supports Telegram and Discord only.',
    );
    expect(runtime.exit).toHaveBeenCalledWith(1);
    expect(configMocks.writeConfigFile).not.toHaveBeenCalled();
    expect(ensureChannelSetupPluginInstalled).not.toHaveBeenCalled();
  });

  it("runs channel lifecycle hooks only when account config changes", async () => {
    configMocks.readConfigFileSnapshot.mockResolvedValue({
      ...baseConfigSnapshot,
      config: {
        channels: {
          telegram: { token: "old-token", enabled: true },
        },
      },
    });

    await channelsAddCommand(
      { channel: "telegram", account: "default", token: "new-token" },
      runtime,
      { hasFlags: true },
    );

    expect(lifecycleMocks.onAccountConfigChanged).toHaveBeenCalledTimes(1);
    expect(lifecycleMocks.onAccountConfigChanged).toHaveBeenCalledWith({ accountId: "default" });

    lifecycleMocks.onAccountConfigChanged.mockClear();
    configMocks.readConfigFileSnapshot.mockResolvedValue({
      ...baseConfigSnapshot,
      config: {
        channels: {
          telegram: { token: "same-token", enabled: true },
        },
      },
    });

    await channelsAddCommand(
      { channel: "telegram", account: "default", token: "same-token" },
      runtime,
      { hasFlags: true },
    );

    expect(lifecycleMocks.onAccountConfigChanged).not.toHaveBeenCalled();
  });

  it("uses setup-entry snapshots when an already loaded channel plugin has no setup adapter", async () => {
    configMocks.readConfigFileSnapshot.mockResolvedValue({ ...baseConfigSnapshot });
    setActivePluginRegistry(
      createTestRegistry([
        {
          pluginId: "telegram",
          plugin: createChannelTestPluginBase({ id: "telegram", label: "Telegram" }),
          source: "test",
        },
      ]),
    );
    vi.mocked(loadChannelSetupPluginRegistrySnapshotForChannel).mockReturnValue(
      createTestRegistry([
        {
          pluginId: "telegram",
          plugin: {
            ...createChannelTestPluginBase({ id: "telegram", label: "Telegram" }),
            setup: {
              applyAccountConfig: ({ cfg, input }: ApplyAccountConfigParams) => ({
                ...cfg,
                channels: {
                  ...cfg.channels,
                  telegram: {
                    enabled: true,
                    botToken: input.token,
                  },
                },
              }),
            },
          },
          source: "test",
        },
      ]),
    );

    await channelsAddCommand(
      {
        channel: "telegram",
        token: "123456:token",
      },
      runtime,
      { hasFlags: true },
    );

    expect(loadChannelSetupPluginRegistrySnapshotForChannel).toHaveBeenCalledTimes(1);
    expect(writtenChannel("telegram").enabled).toBe(true);
    expect(writtenChannel("telegram").botToken).toBe("123456:token");
    expect(runtime.error).not.toHaveBeenCalled();
    expect(runtime.exit).not.toHaveBeenCalled();
  });

  it("uses the bundled setup fallback when snapshots only see a runtime plugin", async () => {
    configMocks.readConfigFileSnapshot.mockResolvedValue({ ...baseConfigSnapshot });
    setActivePluginRegistry(
      createTestRegistry([
        {
          pluginId: "telegram",
          plugin: createChannelTestPluginBase({ id: "telegram", label: "Telegram" }),
          source: "test",
        },
      ]),
    );
    vi.mocked(getBundledChannelSetupPlugin).mockReturnValue({
      ...createChannelTestPluginBase({ id: "telegram", label: "Telegram" }),
      setup: {
        applyAccountConfig: ({ cfg, input }: ApplyAccountConfigParams) => ({
          ...cfg,
          channels: {
            ...cfg.channels,
            telegram: {
              enabled: true,
              botToken: input.token,
            },
          },
        }),
      },
    });

    await channelsAddCommand(
      {
        channel: "telegram",
        token: "123456:token",
      },
      runtime,
      { hasFlags: true },
    );

    expect(getBundledChannelSetupPlugin).toHaveBeenCalledWith("telegram");
    expect(writtenChannel("telegram").enabled).toBe(true);
    expect(writtenChannel("telegram").botToken).toBe("123456:token");
    expect(runtime.error).not.toHaveBeenCalled();
    expect(runtime.exit).not.toHaveBeenCalled();
  });

  it("runs post-setup hooks after writing config and keeps saved config on hook failure", async () => {
    const afterAccountConfigWritten = vi.fn().mockResolvedValue(undefined);
    await runDiscordAddCommand(afterAccountConfigWritten);

    expect(configMocks.writeConfigFile).toHaveBeenCalledTimes(1);
    expect(afterAccountConfigWritten).toHaveBeenCalledTimes(1);
    expect(configMocks.writeConfigFile.mock.invocationCallOrder[0]).toBeLessThan(
      afterAccountConfigWritten.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    const hookCall = requireRecord(
      mockArg(afterAccountConfigWritten, 0, 0, "hook call"),
      "hook call",
    );
    expect(hookCall.previousCfg).toBe(baseConfigSnapshot.config);
    expect(requireRecord(hookCall.cfg, "hook config").channels).toEqual({
      discord: {
        enabled: true,
        accounts: {
          ops: {
            account: "ops-token",
          },
        },
      },
    });
    expect(hookCall.accountId).toBe("ops");
    expect(requireRecord(hookCall.input, "hook input").token).toBe("ops-token");
    expect(hookCall.runtime).toBe(runtime);

    configMocks.writeConfigFile.mockClear();
    runtime.error.mockClear();
    runtime.exit.mockClear();
    const failingHook = vi.fn().mockRejectedValue(new Error("hook failed"));
    await runDiscordAddCommand(failingHook);

    expect(configMocks.writeConfigFile).toHaveBeenCalledTimes(1);
    expect(runtime.exit).not.toHaveBeenCalled();
    expect(runtime.error).toHaveBeenCalledWith(
      'Channel discord post-setup warning for "ops": hook failed',
    );
  });
});
