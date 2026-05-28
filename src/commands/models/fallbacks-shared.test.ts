import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import type { RuntimeEnv } from "../../runtime.js";
import { addFallbackCommand, removeFallbackCommand } from "./fallbacks-shared.js";

const mocks = vi.hoisted(() => ({
  logConfigUpdated: vi.fn(),
  readConfigFileSnapshot: vi.fn(),
  replaceConfigFile: vi.fn(),
}));

vi.mock("../../config/config.js", () => ({
  readConfigFileSnapshot: (...args: unknown[]) => mocks.readConfigFileSnapshot(...args),
  replaceConfigFile: (...args: unknown[]) => mocks.replaceConfigFile(...args),
}));

vi.mock("../../config/logging.js", () => ({
  logConfigUpdated: (...args: unknown[]) => mocks.logConfigUpdated(...args),
}));

function makeRuntime(): RuntimeEnv {
  return {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(),
  } as unknown as RuntimeEnv;
}

function setConfig(config: OpenClawConfig): void {
  mocks.readConfigFileSnapshot.mockResolvedValue({
    valid: true,
    hash: "config-hash",
    sourceConfig: config,
    runtimeConfig: config,
    config,
  });
}

describe("fallback model commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.replaceConfigFile.mockResolvedValue(undefined);
  });

  it("rejects fallback aliases that resolve to unsupported providers", async () => {
    setConfig({
      agents: {
        defaults: {
          models: {
            "anthropic/claude-sonnet-4-6": { alias: "sonnet" },
          },
        },
      },
    } as unknown as OpenClawConfig);

    await expect(
      addFallbackCommand(
        { label: "Model fallbacks", key: "model", logPrefix: "Model fallbacks" },
        "sonnet",
        makeRuntime(),
      ),
    ).rejects.toThrow('Unsupported model "anthropic/claude-sonnet-4-6".');

    expect(mocks.replaceConfigFile).not.toHaveBeenCalled();
    expect(mocks.logConfigUpdated).not.toHaveBeenCalled();
  });

  it("rejects removing fallback aliases that resolve to unsupported providers", async () => {
    setConfig({
      agents: {
        defaults: {
          model: {
            primary: "openai/gpt-5.5",
            fallbacks: ["anthropic/claude-sonnet-4-6"],
          },
          models: {
            "anthropic/claude-sonnet-4-6": { alias: "sonnet" },
          },
        },
      },
    } as unknown as OpenClawConfig);

    await expect(
      removeFallbackCommand(
        {
          label: "Model fallbacks",
          key: "model",
          notFoundLabel: "Fallback",
          logPrefix: "Model fallbacks",
        },
        "sonnet",
        makeRuntime(),
      ),
    ).rejects.toThrow('Unsupported model "anthropic/claude-sonnet-4-6".');

    expect(mocks.replaceConfigFile).not.toHaveBeenCalled();
    expect(mocks.logConfigUpdated).not.toHaveBeenCalled();
  });
});
