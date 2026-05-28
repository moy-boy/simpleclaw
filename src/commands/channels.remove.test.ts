import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChannelPluginCatalogEntry } from "../channels/plugins/catalog.js";
import type { ChannelPlugin } from "../channels/plugins/types.plugin.js";
import { resetPluginRuntimeStateForTest, setActivePluginRegistry } from "../plugins/runtime.js";
import { createChannelTestPluginBase, createTestRegistry } from "../test-utils/channel-plugins.js";
import { configMocks } from "./channels.mock-harness.js";
import { baseConfigSnapshot, createTestRuntime } from "./test-runtime-config-helpers.js";

let channelsRemoveCommand: typeof import("./channels.js").channelsRemoveCommand;

const catalogMocks = vi.hoisted(() => ({
  listChannelPluginCatalogEntries: vi.fn((): ChannelPluginCatalogEntry[] => []),
}));

const registryRefreshMocks = vi.hoisted(() => ({
  refreshPluginRegistryAfterConfigMutation: vi.fn(async () => undefined),
}));

const gatewayMocks = vi.hoisted(() => ({
  callGateway: vi.fn(async () => ({ stopped: true })),
}));

vi.mock("../channels/plugins/catalog.js", async () => {
  const actual = await vi.importActual<typeof import("../channels/plugins/catalog.js")>(
    "../channels/plugins/catalog.js",
  );
  return {
    ...actual,
    listChannelPluginCatalogEntries: catalogMocks.listChannelPluginCatalogEntries,
  };
});

vi.mock("../channels/plugins/bundled.js", async () => {
  const actual = await vi.importActual<typeof import("../channels/plugins/bundled.js")>(
    "../channels/plugins/bundled.js",
  );
  return {
    ...actual,
    getBundledChannelPlugin: vi.fn(() => undefined),
  };
});

vi.mock("./channel-setup/plugin-install.js", async () => {
  const actual = await vi.importActual<typeof import("./channel-setup/plugin-install.js")>(
    "./channel-setup/plugin-install.js",
  );
  const { createMockChannelSetupPluginInstallModule } =
    await import("./channels.plugin-install.test-helpers.js");
  return createMockChannelSetupPluginInstallModule(actual);
});

vi.mock("../cli/plugins-registry-refresh.js", () => registryRefreshMocks);

vi.mock("../gateway/call.js", () => ({
  callGateway: gatewayMocks.callGateway,
}));

const runtime = createTestRuntime();

function firstWrittenChannelsConfig() {
  return configMocks.writeConfigFile.mock.calls[0]?.[0] as
    | { channels?: Record<string, unknown> }
    | undefined;
}

function createDeletePlugin(channel: "telegram" | "discord", gateway = false): ChannelPlugin {
  return {
    ...createChannelTestPluginBase({
      id: channel,
      label: channel === "telegram" ? "Telegram" : "Discord",
    }),
    config: {
      listAccountIds: () => ["default"],
      resolveAccount: () => ({}),
      deleteAccount: ({ cfg }) => ({
        ...cfg,
        channels: {
          ...cfg.channels,
          [channel]: undefined,
        },
      }),
    },
    ...(gateway
      ? {
          gateway: {
            startAccount: vi.fn(),
          },
        }
      : {}),
  } as ChannelPlugin;
}

describe("channelsRemoveCommand", () => {
  beforeAll(async () => {
    ({ channelsRemoveCommand } = await import("./channels.js"));
  });

  beforeEach(() => {
    resetPluginRuntimeStateForTest();
    configMocks.readConfigFileSnapshot.mockClear();
    configMocks.writeConfigFile.mockClear();
    configMocks.replaceConfigFile
      .mockReset()
      .mockImplementation(async (params: { nextConfig: unknown }) => {
        await configMocks.writeConfigFile(params.nextConfig);
      });
    runtime.log.mockClear();
    runtime.error.mockClear();
    runtime.exit.mockClear();
    catalogMocks.listChannelPluginCatalogEntries.mockClear();
    catalogMocks.listChannelPluginCatalogEntries.mockReturnValue([]);
    registryRefreshMocks.refreshPluginRegistryAfterConfigMutation.mockClear();
    gatewayMocks.callGateway.mockClear();
    gatewayMocks.callGateway.mockResolvedValue({ stopped: true });
    setActivePluginRegistry(createTestRegistry());
  });

  it("rejects unsupported channel removal before mutation", async () => {
    configMocks.readConfigFileSnapshot.mockResolvedValue({
      ...baseConfigSnapshot,
      config: {
        channels: {
          "external-chat": {
            enabled: true,
            token: "token-1",
          },
        },
      },
    });

    await channelsRemoveCommand(
      {
        channel: "external-chat",
        account: "default",
        delete: true,
      },
      runtime,
      { hasFlags: true },
    );

    expect(configMocks.writeConfigFile).not.toHaveBeenCalled();
    expect(gatewayMocks.callGateway).not.toHaveBeenCalled();
    expect(runtime.error).toHaveBeenCalledWith(
      'Unsupported channel "external-chat". This setup supports Telegram and Discord only.',
    );
    expect(runtime.exit).toHaveBeenCalledWith(1);
  });

  it("removes a supported channel account when its plugin is loaded", async () => {
    configMocks.readConfigFileSnapshot.mockResolvedValue({
      ...baseConfigSnapshot,
      config: {
        channels: {
          telegram: {
            enabled: true,
            token: "token-1",
          },
        },
      },
    });
    setActivePluginRegistry(
      createTestRegistry([
        {
          pluginId: "telegram",
          plugin: createDeletePlugin("telegram"),
          source: "test",
        },
      ]),
    );

    await channelsRemoveCommand(
      {
        channel: "telegram",
        account: "default",
        delete: true,
      },
      runtime,
      { hasFlags: true },
    );

    expect(registryRefreshMocks.refreshPluginRegistryAfterConfigMutation).not.toHaveBeenCalled();
    const writtenConfig = firstWrittenChannelsConfig();
    expect(writtenConfig?.channels?.telegram).toBeUndefined();
    expect(runtime.error).not.toHaveBeenCalled();
    expect(runtime.exit).not.toHaveBeenCalled();
  });

  it("canonicalizes supported catalog aliases before enforcing the allowlist", async () => {
    configMocks.readConfigFileSnapshot.mockResolvedValue({
      ...baseConfigSnapshot,
      config: {
        channels: {
          telegram: {
            enabled: true,
            token: "token-1",
          },
        },
      },
    });
    catalogMocks.listChannelPluginCatalogEntries.mockReturnValue([
      {
        id: "telegram",
        pluginId: "telegram",
        meta: {
          id: "telegram",
          label: "Telegram",
          selectionLabel: "Telegram",
          docsPath: "/channels/telegram",
          blurb: "Telegram channel.",
          aliases: ["tg"],
        },
        install: {
          npmSpec: "@openclaw/telegram",
        },
      },
    ]);
    setActivePluginRegistry(
      createTestRegistry([
        {
          pluginId: "telegram",
          plugin: createDeletePlugin("telegram"),
          source: "test",
        },
      ]),
    );

    await channelsRemoveCommand(
      {
        channel: "tg",
        account: "default",
        delete: true,
      },
      runtime,
      { hasFlags: true },
    );

    const writtenConfig = firstWrittenChannelsConfig();
    expect(writtenConfig?.channels?.telegram).toBeUndefined();
    expect(runtime.error).not.toHaveBeenCalled();
    expect(runtime.exit).not.toHaveBeenCalled();
  });

  it("stops an active gateway channel runtime before deleting a runtime-backed account", async () => {
    configMocks.readConfigFileSnapshot.mockResolvedValue({
      ...baseConfigSnapshot,
      config: {
        channels: {
          discord: {
            enabled: true,
            token: "token-1",
          },
        },
      },
    });
    setActivePluginRegistry(
      createTestRegistry([
        {
          pluginId: "discord",
          plugin: createDeletePlugin("discord", true),
          source: "test",
        },
      ]),
    );

    await channelsRemoveCommand(
      {
        channel: "discord",
        account: "default",
        delete: true,
      },
      runtime,
      { hasFlags: true },
    );

    expect(gatewayMocks.callGateway).toHaveBeenCalledWith({
      config: {
        channels: {
          discord: {
            enabled: true,
            token: "token-1",
          },
        },
      },
      method: "channels.stop",
      params: {
        channel: "discord",
        accountId: "default",
      },
      mode: "backend",
      clientName: "gateway-client",
      deviceIdentity: null,
    });
    const writtenConfig = firstWrittenChannelsConfig();
    expect(writtenConfig?.channels?.discord).toBeUndefined();
  });
});
