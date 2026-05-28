import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import type { RuntimeEnv } from "../../runtime.js";

const mocks = vi.hoisted(() => ({
  logConfigUpdated: vi.fn(),
  readConfigFileSnapshot: vi.fn(),
  repairCodexRuntimePluginInstallForModelSelection: vi.fn(),
  replaceConfigFile: vi.fn(),
}));

vi.mock("../../config/config.js", () => ({
  readConfigFileSnapshot: (...args: unknown[]) => mocks.readConfigFileSnapshot(...args),
  replaceConfigFile: (...args: unknown[]) => mocks.replaceConfigFile(...args),
}));

vi.mock("../../config/logging.js", () => ({
  logConfigUpdated: (...args: unknown[]) => mocks.logConfigUpdated(...args),
}));

vi.mock("../codex-runtime-plugin-install.js", () => ({
  repairCodexRuntimePluginInstallForModelSelection: (...args: unknown[]) =>
    mocks.repairCodexRuntimePluginInstallForModelSelection(...args),
}));

import { modelsSetCommand } from "./set.js";

function makeRuntime(): RuntimeEnv {
  return {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(),
  } as unknown as RuntimeEnv;
}

describe("modelsSetCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.replaceConfigFile.mockResolvedValue(undefined);
    mocks.repairCodexRuntimePluginInstallForModelSelection.mockResolvedValue({ warnings: [] });
  });

  it("resolves aliases from runtime config while writing only source config", async () => {
    const sourceConfig = {
      agents: {
        defaults: {
          models: {
            "openai/gpt-5.4": {},
          },
        },
      },
    } as unknown as OpenClawConfig;
    const runtimeConfig = {
      agents: {
        defaults: {
          models: {
            "openai/gpt-5.4": { alias: "fast" },
          },
        },
      },
    } as unknown as OpenClawConfig;
    mocks.readConfigFileSnapshot.mockResolvedValue({
      valid: true,
      hash: "config-hash",
      sourceConfig,
      runtimeConfig,
      config: runtimeConfig,
    });
    const runtime = makeRuntime();

    await modelsSetCommand("fast", runtime);

    expect(mocks.replaceConfigFile).toHaveBeenCalledOnce();
    const [replaceParams] = mocks.replaceConfigFile.mock.calls[0] ?? [];
    expect(replaceParams?.nextConfig.agents?.defaults?.model).toEqual({
      primary: "openai/gpt-5.4",
    });
    expect(replaceParams?.nextConfig.agents?.defaults?.models).toEqual({
      "openai/gpt-5.4": {},
    });
    expect(replaceParams?.nextConfig.agents?.defaults?.models).not.toHaveProperty("openai/fast");
    expect(mocks.repairCodexRuntimePluginInstallForModelSelection).toHaveBeenCalledWith({
      cfg: replaceParams?.nextConfig,
      model: "openai/gpt-5.4",
    });
    expect(runtime.log).toHaveBeenCalledWith("Default model: openai/gpt-5.4");
  });

  it("rejects aliases that resolve to unsupported providers", async () => {
    const sourceConfig = {
      agents: {
        defaults: {
          models: {
            "anthropic/claude-sonnet-4-6": {},
          },
        },
      },
    } as unknown as OpenClawConfig;
    const runtimeConfig = {
      agents: {
        defaults: {
          models: {
            "anthropic/claude-sonnet-4-6": { alias: "sonnet" },
          },
        },
      },
    } as unknown as OpenClawConfig;
    mocks.readConfigFileSnapshot.mockResolvedValue({
      valid: true,
      hash: "config-hash",
      sourceConfig,
      runtimeConfig,
      config: runtimeConfig,
    });

    await expect(modelsSetCommand("sonnet", makeRuntime())).rejects.toThrow(
      'Unsupported model "anthropic/claude-sonnet-4-6".',
    );

    expect(mocks.replaceConfigFile).not.toHaveBeenCalled();
    expect(mocks.repairCodexRuntimePluginInstallForModelSelection).not.toHaveBeenCalled();
  });

  it("keeps authored aliases ahead of runtime-only aliases", async () => {
    const sourceConfig = {
      agents: {
        defaults: {
          models: {
            "openai/gpt-5.5": { alias: "sonnet" },
          },
        },
      },
    } as unknown as OpenClawConfig;
    const runtimeConfig = {
      agents: {
        defaults: {
          models: {
            "openai/gpt-5.5": { alias: "sonnet" },
            "anthropic/claude-sonnet-4-6": { alias: "sonnet" },
          },
        },
      },
    } as unknown as OpenClawConfig;
    mocks.readConfigFileSnapshot.mockResolvedValue({
      valid: true,
      hash: "config-hash",
      sourceConfig,
      runtimeConfig,
      config: runtimeConfig,
    });
    const runtime = makeRuntime();

    await modelsSetCommand("sonnet", runtime);

    expect(mocks.replaceConfigFile).toHaveBeenCalledOnce();
    const [replaceParams] = mocks.replaceConfigFile.mock.calls[0] ?? [];
    expect(replaceParams?.nextConfig.agents?.defaults?.model).toEqual({
      primary: "openai/gpt-5.5",
    });
    expect(replaceParams?.nextConfig.agents?.defaults?.models).toEqual({
      "openai/gpt-5.5": { alias: "sonnet" },
    });
    expect(mocks.repairCodexRuntimePluginInstallForModelSelection).toHaveBeenCalledWith({
      cfg: replaceParams?.nextConfig,
      model: "openai/gpt-5.5",
    });
    expect(runtime.log).toHaveBeenCalledWith("Default model: openai/gpt-5.5");
  });
});
