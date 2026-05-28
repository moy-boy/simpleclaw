#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildCmdExeCommandLine } from "../../../windows-cmd-helpers.mjs";

const args = process.argv.slice(2);
const command = args.shift();

function option(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  const value = args[index + 1];
  if (!value) {
    throw new Error(`missing value for ${name}`);
  }
  return value;
}

function tail(value, max = 2400) {
  const text = String(value || "");
  return text.length <= max ? text : text.slice(-max);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

const configSectionDir = new URL("./config-recipe/", import.meta.url);

function readConfigSection(fileName) {
  const fileUrl = new URL(fileName, configSectionDir);
  return JSON.stringify(JSON.parse(fs.readFileSync(fileUrl, "utf8")));
}

function parseReleaseVersion(version) {
  const match = /^([0-9]{4})\.([0-9]+)\.([0-9]+)/u.exec(String(version ?? ""));
  if (!match) {
    return null;
  }
  return match.slice(1).map((part) => Number.parseInt(part, 10));
}

function isReleaseBefore(version, minimum) {
  const parsed = parseReleaseVersion(version);
  const minimumParsed = parseReleaseVersion(minimum);
  if (!parsed || !minimumParsed) {
    return false;
  }
  for (let index = 0; index < parsed.length; index += 1) {
    if (parsed[index] !== minimumParsed[index]) {
      return parsed[index] < minimumParsed[index];
    }
  }
  return false;
}

function configSetJsonFile(id, intent, configPath, fileName) {
  return {
    id,
    intent,
    argv: ["config", "set", configPath, readConfigSection(fileName), "--strict-json"],
  };
}

const representativeConfigSteps = [
  configSetJsonFile("models-openai", "models", "models.providers.openai", "models-openai.json"),
  configSetJsonFile("agents", "agents", "agents", "agents.json"),
  configSetJsonFile("skills", "skills", "skills", "skills.json"),
  configSetJsonFile("plugins", "plugins", "plugins", "plugins.json"),
  configSetJsonFile(
    "channels-discord",
    "discord-channel",
    "channels.discord",
    "channels-discord.json",
  ),
  configSetJsonFile(
    "channels-telegram",
    "telegram-channel",
    "channels.telegram",
    "channels-telegram.json",
  ),
];

const scenarioConfigSteps = new Map([
  [
    "tilde-log-path",
    [
      {
        id: "logging-file",
        intent: "logging",
        argv: ["config", "set", "logging.file", "~/openclaw-upgrade-survivor/gateway.jsonl"],
      },
    ],
  ],
]);

const recipe = [
  {
    id: "update-channel",
    intent: "update",
    argv: ["config", "set", "update.channel", "stable"],
  },
  configSetJsonFile("gateway", "gateway", "gateway", "gateway.json"),
  ...representativeConfigSteps,
  {
    id: "validate",
    intent: "validate",
    argv: ["config", "validate"],
  },
];

function selectedScenario() {
  return process.env.OPENCLAW_UPGRADE_SURVIVOR_SCENARIO || "base";
}

function adaptStepForBaseline(step, baselineVersion, summary) {
  if (!isReleaseBefore(baselineVersion, "2026.4.0")) {
    return step;
  }
  if (step.id === "agents") {
    const agents = JSON.parse(step.argv[3]);
    delete agents.defaults?.skills;
    for (const agent of agents.list ?? []) {
      delete agent.thinkingDefault;
      delete agent.fastModeDefault;
      delete agent.skills;
    }
    summary.skippedIntents.push("agent-modern-preferences");
    return {
      ...step,
      argv: [...step.argv.slice(0, 3), JSON.stringify(agents), ...step.argv.slice(4)],
    };
  }
  if (step.intent === "plugins") {
    const plugins = JSON.parse(step.argv[3]);
    plugins.allow = (plugins.allow ?? []).filter((id) => id !== "memory");
    delete plugins.entries?.memory;
    if (!summary.skippedIntents.includes("memory-plugin-allow")) {
      summary.skippedIntents.push("memory-plugin-allow");
    }
    return {
      ...step,
      argv: [...step.argv.slice(0, 3), JSON.stringify(plugins), ...step.argv.slice(4)],
    };
  }
  return step;
}

export function resolveUpgradeSurvivorOpenClawCommand(argv, params = {}) {
  const platform = params.platform ?? process.platform;
  if (platform === "win32") {
    const comSpec = params.comSpec ?? process.env.ComSpec ?? "cmd.exe";
    return {
      command: comSpec,
      args: ["/d", "/s", "/c", buildCmdExeCommandLine("openclaw.cmd", argv)],
      commandLabel: ["openclaw", ...argv].join(" "),
      shell: false,
      windowsVerbatimArguments: true,
    };
  }
  return {
    command: "openclaw",
    args: argv,
    commandLabel: ["openclaw", ...argv].join(" "),
    shell: false,
  };
}

function runOpenClaw(step) {
  const invocation = resolveUpgradeSurvivorOpenClawCommand(step.argv);
  const result = spawnSync(invocation.command, invocation.args, {
    encoding: "utf8",
    env: process.env,
    shell: invocation.shell,
    windowsVerbatimArguments: invocation.windowsVerbatimArguments,
  });
  return {
    id: step.id,
    intent: step.intent,
    command: invocation.commandLabel,
    status: result.status,
    signal: result.signal,
    ok: result.status === 0,
    stdout: tail(result.stdout),
    stderr: tail(result.stderr),
  };
}

function applyRecipe() {
  const summaryPath = option("--summary");
  const baselineVersion = option("--baseline-version", null);
  const scenario = selectedScenario();
  const scenarioSteps = scenarioConfigSteps.get(scenario) ?? [];
  const summary = {
    source: "baseline-cli-command-recipe",
    recipe: "upgrade-survivor-v1",
    baselineVersion,
    scenario,
    acceptedIntents: [
      "update",
      "gateway",
      "models",
      "agents",
      "skills",
      "plugins",
      "discord-channel",
      "telegram-channel",
      ...scenarioSteps.map((step) => step.intent),
    ],
    skippedIntents: [],
    steps: [],
  };

  for (const step of [...recipe.slice(0, -1), ...scenarioSteps, recipe.at(-1)]) {
    const adaptedStep = adaptStepForBaseline(step, baselineVersion, summary);
    if (!adaptedStep) {
      continue;
    }
    const outcome = runOpenClaw(adaptedStep);
    summary.steps.push(outcome);
    writeJson(summaryPath, summary);
    if (!outcome.ok) {
      throw new Error(`baseline config recipe failed at ${step.id}`);
    }
  }
}

function main() {
  if (command === "apply") {
    applyRecipe();
  } else {
    throw new Error(`unknown upgrade-survivor config-recipe command: ${command ?? "<missing>"}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
