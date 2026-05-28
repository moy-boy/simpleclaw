import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runRegisteredCli } from "../test-utils/command-runner.js";
import { registerModelsCli } from "./models-cli.js";

const mocks = vi.hoisted(() => ({
  modelsStatusCommand: vi.fn().mockResolvedValue(undefined),
  modelsSetCommand: vi.fn().mockResolvedValue(undefined),
  modelsSetImageCommand: vi.fn().mockResolvedValue(undefined),
  noopAsync: vi.fn(async () => undefined),
  modelsAuthAddCommand: vi.fn().mockResolvedValue(undefined),
  modelsAuthListCommand: vi.fn().mockResolvedValue(undefined),
  modelsAuthLoginCommand: vi.fn().mockResolvedValue(undefined),
}));

const {
  modelsAuthAddCommand,
  modelsAuthListCommand,
  modelsAuthLoginCommand,
  modelsSetCommand,
  modelsSetImageCommand,
  modelsStatusCommand,
} = mocks;

vi.mock("../commands/models/list.list-command.js", () => ({
  modelsListCommand: mocks.noopAsync,
}));
vi.mock("../commands/models/list.status-command.js", () => ({
  modelsStatusCommand: mocks.modelsStatusCommand,
}));
vi.mock("../commands/models/auth.js", () => ({
  modelsAuthAddCommand: mocks.modelsAuthAddCommand,
  modelsAuthLoginCommand: mocks.modelsAuthLoginCommand,
}));
vi.mock("../commands/models/auth-list.js", () => ({
  modelsAuthListCommand: mocks.modelsAuthListCommand,
}));
vi.mock("../commands/models/auth-order.js", () => ({
  modelsAuthOrderClearCommand: mocks.noopAsync,
  modelsAuthOrderGetCommand: mocks.noopAsync,
  modelsAuthOrderSetCommand: mocks.noopAsync,
}));
vi.mock("../commands/models/aliases.js", () => ({
  modelsAliasesAddCommand: mocks.noopAsync,
  modelsAliasesListCommand: mocks.noopAsync,
  modelsAliasesRemoveCommand: mocks.noopAsync,
}));
vi.mock("../commands/models/fallbacks.js", () => ({
  modelsFallbacksAddCommand: mocks.noopAsync,
  modelsFallbacksClearCommand: mocks.noopAsync,
  modelsFallbacksListCommand: mocks.noopAsync,
  modelsFallbacksRemoveCommand: mocks.noopAsync,
}));
vi.mock("../commands/models/image-fallbacks.js", () => ({
  modelsImageFallbacksAddCommand: mocks.noopAsync,
  modelsImageFallbacksClearCommand: mocks.noopAsync,
  modelsImageFallbacksListCommand: mocks.noopAsync,
  modelsImageFallbacksRemoveCommand: mocks.noopAsync,
}));
vi.mock("../commands/models/set.js", () => ({
  modelsSetCommand: mocks.modelsSetCommand,
}));
vi.mock("../commands/models/set-image.js", () => ({
  modelsSetImageCommand: mocks.modelsSetImageCommand,
}));

describe("models cli", () => {
  beforeEach(() => {
    modelsAuthAddCommand.mockClear();
    modelsAuthListCommand.mockClear();
    modelsAuthLoginCommand.mockClear();
    modelsSetCommand.mockClear();
    modelsSetImageCommand.mockClear();
    modelsStatusCommand.mockClear();
  });

  function createProgram() {
    const program = new Command();
    registerModelsCli(program);
    return program;
  }

  async function runModelsCommand(args: string[]) {
    await runRegisteredCli({
      register: registerModelsCli as (program: Command) => void,
      argv: args,
    });
  }

  function requireCommand(parent: Command, name: string): Command {
    const command = parent.commands.find((cmd) => cmd.name() === name);
    if (!command) {
      throw new Error(`expected ${name} command`);
    }
    return command;
  }

  function expectCommandOptions(
    command: ReturnType<typeof vi.fn>,
    expected: Record<string, unknown>,
  ) {
    expect(command).toHaveBeenCalledTimes(1);
    const [options, context] = command.mock.calls[0] ?? [];
    const optionRecord = options as Record<string, unknown> | undefined;
    for (const [key, value] of Object.entries(expected)) {
      expect(optionRecord?.[key]).toEqual(value);
    }
    if (!context || typeof context !== "object") {
      throw new Error("expected command context");
    }
  }

  it("does not expose removed compatibility model auth commands", () => {
    const program = createProgram();
    const models = requireCommand(program, "models");
    const auth = requireCommand(models, "auth");

    for (const commandName of [
      "login-github-copilot",
      "paste-api-key",
      "paste-token",
      "setup-token",
    ]) {
      expect(auth.commands.some((command) => command.name() === commandName)).toBe(false);
    }
    expect(models.commands.some((command) => command.name() === "scan")).toBe(false);
  });

  it.each([
    { label: "status flag", args: ["models", "status", "--agent", "poe"] },
    { label: "parent flag", args: ["models", "--agent", "poe", "status"] },
  ])("passes --agent to models status ($label)", async ({ args }) => {
    await runModelsCommand(args);
    expectCommandOptions(modelsStatusCommand, { agent: "poe" });
  });

  it.each([
    {
      label: "add",
      args: ["models", "auth", "--agent", "poe", "add"],
      command: modelsAuthAddCommand,
      expected: { agent: "poe" },
    },
    {
      label: "list",
      args: ["models", "auth", "--agent", "poe", "list", "--provider", "openai-codex"],
      command: modelsAuthListCommand,
      expected: { agent: "poe", provider: "openai-codex" },
    },
    {
      label: "login",
      args: ["models", "auth", "--agent", "poe", "login", "--provider", "openai-codex"],
      command: modelsAuthLoginCommand,
      expected: { agent: "poe", provider: "openai-codex" },
    },
  ])("passes parent --agent to models auth $label", async ({ args, command, expected }) => {
    await runModelsCommand(args);

    expectCommandOptions(command, expected);
  });

  it("passes --method through models auth login", async () => {
    await runModelsCommand([
      "models",
      "auth",
      "login",
      "--provider",
      "openai",
      "--method",
      "api-key",
    ]);

    expectCommandOptions(modelsAuthLoginCommand, {
      provider: "openai",
      method: "api-key",
    });
  });

  it("maps --device-code to the provider device-code auth method", async () => {
    await runModelsCommand([
      "models",
      "auth",
      "login",
      "--provider",
      "openai-codex",
      "--device-code",
    ]);

    expectCommandOptions(modelsAuthLoginCommand, {
      provider: "openai-codex",
      method: "device-code",
    });
  });

  it("passes list-specific --agent and --json to models auth list", async () => {
    await runModelsCommand(["models", "auth", "list", "--agent", "poe", "--json"]);

    expectCommandOptions(modelsAuthListCommand, { agent: "poe", json: true });
  });

  it.each([
    {
      label: "set",
      args: ["models", "--agent", "poe", "set", "anthropic/claude-sonnet-4-6"],
      command: modelsSetCommand,
    },
    {
      label: "set-image",
      args: ["models", "--agent", "poe", "set-image", "openai/gpt-image-1"],
      command: modelsSetImageCommand,
    },
  ])("rejects parent --agent for models $label", async ({ args, command }) => {
    await expect(runModelsCommand(args)).rejects.toThrow("does not support --agent");

    expect(command).not.toHaveBeenCalled();
  });

  it("shows help for models auth without error exit", async () => {
    const program = new Command();
    program.exitOverride();
    program.configureOutput({
      writeOut: () => {},
      writeErr: () => {},
    });
    registerModelsCli(program);

    try {
      await program.parseAsync(["models", "auth"], { from: "user" });
      expect.fail("expected help to exit");
    } catch (err) {
      const error = err as { exitCode?: number };
      expect(error.exitCode).toBe(0);
    }
  });
});
