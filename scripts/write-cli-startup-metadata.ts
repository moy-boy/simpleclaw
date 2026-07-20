import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { RootHelpRenderOptions } from "../src/cli/program/root-help.js";
import type { OpenClawConfig } from "../src/config/config.js";
import { listSupportedBundledPluginIds } from "./lib/supported-surface.mjs";

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }
  return out;
}

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const rootDir = path.resolve(scriptDir, "..");
const distDir = path.join(rootDir, "dist");
const outputPath = path.join(distDir, "cli-startup-metadata.json");
const extensionsDir = path.join(rootDir, "extensions");
const ROOT_HELP_RENDER_TIMEOUT_MS = 120_000;
const COMMAND_HELP_RENDER_TIMEOUT_MS = 120_000;
const PRECOMPUTED_SUBCOMMAND_HELP_COMMANDS = ["doctor", "gateway", "models", "plugins"] as const;
const CORE_CHANNEL_ORDER = ["telegram", "discord", "slack"] as const;
const SUPPORTED_CHANNEL_IDS = new Set<string>(CORE_CHANNEL_ORDER);
const SUPPORTED_BUNDLED_PLUGIN_IDS = new Set<string>(listSupportedBundledPluginIds());
const SUPPORTED_CHANNEL_ORDER = new Map<string, number>(
  CORE_CHANNEL_ORDER.map((channelId, index) => [channelId, index]),
);

function shouldPrecomputeExtendedCliHelpMetadata(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OPENCLAW_BUILD_FULL_CLI_HELP_METADATA === "1";
}

type ExtensionChannelEntry = {
  id: string;
  order: number;
  label: string;
};

type BundledChannelCatalog = {
  ids: string[];
  signature: string;
};

type PrecomputedSubcommandHelpCommand = (typeof PRECOMPUTED_SUBCOMMAND_HELP_COMMANDS)[number];
type PrecomputedSubcommandHelpText = Record<PrecomputedSubcommandHelpCommand, string>;
type RootHelpRenderContext = Pick<RootHelpRenderOptions, "config" | "env">;

function resolveRootHelpBundleIdentity(
  distDirOverride: string = distDir,
): { bundleName: string; signature: string } | null {
  const bundleName = readdirSync(distDirOverride).find(
    (entry) =>
      entry.startsWith("root-help-") &&
      !entry.startsWith("root-help-metadata-") &&
      entry.endsWith(".js"),
  );
  if (!bundleName) {
    return null;
  }
  const bundlePath = path.join(distDirOverride, bundleName);
  const raw = readFileSync(bundlePath, "utf8");
  return {
    bundleName,
    signature: createHash("sha1").update(raw).digest("hex"),
  };
}

function updateHashFromFiles(
  hash: ReturnType<typeof createHash>,
  files: string[],
  sourceRootDir: string = rootDir,
): void {
  for (const file of files.toSorted()) {
    hash.update(`${path.relative(sourceRootDir, file)}\0`);
    hash.update(readFileSync(file));
    hash.update("\0");
  }
}

function resolveSecretsHelpSourceSignature(sourceRootDir: string = rootDir): string {
  const hash = createHash("sha1");
  updateHashFromFiles(
    hash,
    [
      path.join(sourceRootDir, "src/cli/secrets-cli.ts"),
      path.join(sourceRootDir, "src/cli/program/help.ts"),
      path.join(sourceRootDir, "src/cli/program/context.ts"),
      path.join(sourceRootDir, "src/cli/banner.ts"),
    ],
    sourceRootDir,
  );
  return hash.digest("hex");
}

function resolveNodesHelpSourceSignature(sourceRootDir: string = rootDir): string {
  const hash = createHash("sha1");
  const nodesCliDir = path.join(sourceRootDir, "src/cli/nodes-cli");
  const nodesCliFiles = readdirSync(nodesCliDir)
    .filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".test.ts"))
    .map((entry) => path.join(nodesCliDir, entry));
  updateHashFromFiles(hash, nodesCliFiles, sourceRootDir);
  updateHashFromFiles(
    hash,
    [
      path.join(sourceRootDir, "src/cli/program/help.ts"),
      path.join(sourceRootDir, "src/cli/program/context.ts"),
      path.join(sourceRootDir, "src/cli/banner.ts"),
      path.join(sourceRootDir, "src/plugins/register-plugin-cli-command-groups.ts"),
    ],
    sourceRootDir,
  );
  return hash.digest("hex");
}

function resolveSubcommandHelpSourceSignature(sourceRootDir: string = rootDir): string {
  const hash = createHash("sha1");
  updateHashFromFiles(
    hash,
    [
      path.join(sourceRootDir, "src/cli/program/help.ts"),
      path.join(sourceRootDir, "src/cli/program/context.ts"),
      path.join(sourceRootDir, "src/cli/banner.ts"),
      path.join(sourceRootDir, "src/cli/help-format.ts"),
      path.join(sourceRootDir, "src/cli/daemon-cli/register-service-commands.ts"),
      path.join(sourceRootDir, "src/cli/program/register.maintenance.ts"),
      path.join(sourceRootDir, "src/cli/gateway-cli.ts"),
      path.join(sourceRootDir, "src/cli/gateway-cli/register.ts"),
      path.join(sourceRootDir, "src/cli/gateway-cli/run-command.ts"),
      path.join(sourceRootDir, "src/cli/models-cli.ts"),
      path.join(sourceRootDir, "src/cli/plugins-cli.ts"),
      path.join(sourceRootDir, "src/terminal/links.ts"),
      path.join(sourceRootDir, "src/terminal/theme.ts"),
    ],
    sourceRootDir,
  );
  return hash.digest("hex");
}

export function readBundledChannelCatalog(
  extensionsDirOverride: string = extensionsDir,
): BundledChannelCatalog {
  const entries: ExtensionChannelEntry[] = [];
  const signature = createHash("sha1");
  for (const dirEntry of readdirSync(extensionsDirOverride, { withFileTypes: true })) {
    if (!dirEntry.isDirectory()) {
      continue;
    }
    if (!SUPPORTED_BUNDLED_PLUGIN_IDS.has(dirEntry.name)) {
      continue;
    }
    const packageJsonPath = path.join(extensionsDirOverride, dirEntry.name, "package.json");
    try {
      const raw = readFileSync(packageJsonPath, "utf8");
      signature.update(`${dirEntry.name}\0${raw}\0`);
      const parsed = JSON.parse(raw) as {
        openclaw?: {
          channel?: {
            id?: unknown;
            order?: unknown;
            label?: unknown;
          };
        };
      };
      const id = parsed.openclaw?.channel?.id;
      if (typeof id !== "string" || !id.trim()) {
        continue;
      }
      const normalizedId = id.trim();
      if (!SUPPORTED_CHANNEL_IDS.has(normalizedId)) {
        continue;
      }
      const orderRaw = parsed.openclaw?.channel?.order;
      const labelRaw = parsed.openclaw?.channel?.label;
      entries.push({
        id: normalizedId,
        order:
          typeof orderRaw === "number"
            ? orderRaw
            : (SUPPORTED_CHANNEL_ORDER.get(normalizedId) ?? 999),
        label: typeof labelRaw === "string" ? labelRaw : normalizedId,
      });
    } catch {
      // Ignore malformed or missing extension package manifests.
    }
  }
  return {
    ids: entries
      .toSorted((a, b) =>
        a.order === b.order ? a.label.localeCompare(b.label) : a.order - b.order,
      )
      .map((entry) => entry.id),
    signature: signature.digest("hex"),
  };
}

export function readBundledChannelCatalogIds(
  extensionsDirOverride: string = extensionsDir,
): string[] {
  return readBundledChannelCatalog(extensionsDirOverride).ids;
}

function createIsolatedRootHelpRenderContext(
  bundledPluginsDir: string = extensionsDir,
): RootHelpRenderContext {
  const stateDir = path.join(rootDir, ".openclaw-build-root-help");
  const workspaceDir = path.join(stateDir, "workspace");
  const homeDir = path.join(stateDir, "home");
  const env: NodeJS.ProcessEnv = {
    HOME: homeDir,
    LOGNAME: process.env.LOGNAME ?? process.env.USER ?? "openclaw-build",
    USER: process.env.USER ?? process.env.LOGNAME ?? "openclaw-build",
    PATH: process.env.PATH ?? "",
    TMPDIR: process.env.TMPDIR ?? "/tmp",
    LANG: process.env.LANG ?? "C.UTF-8",
    LC_ALL: process.env.LC_ALL ?? "C.UTF-8",
    TERM: process.env.TERM ?? "dumb",
    NO_COLOR: "1",
    OPENCLAW_BUNDLED_PLUGINS_DIR: bundledPluginsDir,
    OPENCLAW_DISABLE_BUNDLED_PLUGINS: "",
    OPENCLAW_STATE_DIR: stateDir,
  };
  const config: OpenClawConfig = {
    agents: {
      defaults: {
        workspace: workspaceDir,
      },
    },
    plugins: {
      loadPaths: [],
    },
  };
  return { config, env };
}

export async function renderBundledRootHelpText(
  _distDirOverride: string = distDir,
  renderContext: RootHelpRenderContext = createIsolatedRootHelpRenderContext(
    existsSync(path.join(_distDirOverride, "extensions"))
      ? path.join(_distDirOverride, "extensions")
      : extensionsDir,
  ),
): Promise<string> {
  const bundleIdentity = resolveRootHelpBundleIdentity(_distDirOverride);
  if (!bundleIdentity) {
    throw new Error("No root-help bundle found in dist; cannot write CLI startup metadata.");
  }
  const moduleUrl = pathToFileURL(path.join(_distDirOverride, bundleIdentity.bundleName)).href;
  const renderOptions = {
    config: renderContext.config,
    env: renderContext.env,
  } satisfies RootHelpRenderOptions;
  const inlineModule = [
    `const mod = await import(${JSON.stringify(moduleUrl)});`,
    "if (typeof mod.outputRootHelp !== 'function') {",
    `  throw new Error(${JSON.stringify(`Bundle ${bundleIdentity.bundleName} does not export outputRootHelp.`)});`,
    "}",
    `await mod.outputRootHelp(${JSON.stringify(renderOptions)});`,
    "process.exit(0);",
  ].join("\n");
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", inlineModule], {
    cwd: _distDirOverride,
    encoding: "utf8",
    env: renderContext.env,
    timeout: ROOT_HELP_RENDER_TIMEOUT_MS,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    throw new Error(
      `Failed to render bundled root help from ${bundleIdentity.bundleName}` +
        (stderr ? `: ${stderr}` : result.signal ? `: terminated by ${result.signal}` : ""),
    );
  }
  return result.stdout ?? "";
}

function renderSourceRootHelpText(
  renderContext: RootHelpRenderContext = createIsolatedRootHelpRenderContext(),
): string {
  const moduleUrl = pathToFileURL(path.join(rootDir, "src/cli/program/root-help.ts")).href;
  const renderOptions = {
    pluginSdkResolution: "src",
    config: renderContext.config,
    env: renderContext.env,
  } satisfies RootHelpRenderOptions;
  const inlineModule = [
    `const mod = await import(${JSON.stringify(moduleUrl)});`,
    "if (typeof mod.renderRootHelpText !== 'function') {",
    `  throw new Error(${JSON.stringify("Source root-help module does not export renderRootHelpText.")});`,
    "}",
    `const output = await mod.renderRootHelpText(${JSON.stringify(renderOptions)});`,
    "process.stdout.write(output);",
    "process.exit(0);",
  ].join("\n");
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "--eval", inlineModule],
    {
      cwd: rootDir,
      encoding: "utf8",
      env: renderContext.env,
      timeout: ROOT_HELP_RENDER_TIMEOUT_MS,
    },
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    throw new Error(
      "Failed to render source root help" +
        (stderr ? `: ${stderr}` : result.signal ? `: terminated by ${result.signal}` : ""),
    );
  }
  return result.stdout ?? "";
}

function renderSourceCommandHelpText(
  command: "nodes" | "secrets" | PrecomputedSubcommandHelpCommand,
  renderContext: RootHelpRenderContext = createIsolatedRootHelpRenderContext(),
): string {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "openclaw.mjs", command, "--help"],
    {
      cwd: rootDir,
      encoding: "utf8",
      env: {
        ...renderContext.env,
        OPENCLAW_DISABLE_CLI_STARTUP_HELP_FAST_PATH: "1",
      },
      timeout: COMMAND_HELP_RENDER_TIMEOUT_MS,
    },
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    throw new Error(
      `Failed to render source ${command} help` +
        (stderr ? `: ${stderr}` : result.signal ? `: terminated by ${result.signal}` : ""),
    );
  }
  return result.stdout ?? "";
}

function renderSourceSecretsHelpText(
  renderContext: RootHelpRenderContext = createIsolatedRootHelpRenderContext(),
): string {
  return renderSourceCommandHelpText("secrets", renderContext);
}

function renderSourceNodesHelpText(
  renderContext: RootHelpRenderContext = createIsolatedRootHelpRenderContext(),
): string {
  return renderSourceCommandHelpText("nodes", renderContext);
}

function renderSourceSubcommandHelpTextRecord(
  renderContext: RootHelpRenderContext = createIsolatedRootHelpRenderContext(),
): PrecomputedSubcommandHelpText {
  const entries = PRECOMPUTED_SUBCOMMAND_HELP_COMMANDS.map((commandName) => [
    commandName,
    renderSourceCommandHelpText(commandName, renderContext),
  ]);
  return Object.fromEntries(entries) as PrecomputedSubcommandHelpText;
}

export async function writeCliStartupMetadata(options?: {
  distDir?: string;
  outputPath?: string;
  extensionsDir?: string;
  sourceRootDir?: string;
  renderBundledRootHelpText?: typeof renderBundledRootHelpText;
  renderSourceRootHelpText?: typeof renderSourceRootHelpText;
  renderSourceSecretsHelpText?: typeof renderSourceSecretsHelpText;
  renderSourceNodesHelpText?: typeof renderSourceNodesHelpText;
  renderSourceSubcommandHelpTextRecord?: typeof renderSourceSubcommandHelpTextRecord;
  precomputeExtendedHelp?: boolean;
}): Promise<void> {
  const resolvedDistDir = options?.distDir ?? distDir;
  const resolvedOutputPath = options?.outputPath ?? outputPath;
  const resolvedExtensionsDir = options?.extensionsDir ?? extensionsDir;
  const resolvedSourceRootDir = options?.sourceRootDir ?? rootDir;
  const precomputeExtendedHelp =
    options?.precomputeExtendedHelp ?? shouldPrecomputeExtendedCliHelpMetadata();
  const channelCatalog = readBundledChannelCatalog(resolvedExtensionsDir);
  const bundleIdentity = resolveRootHelpBundleIdentity(resolvedDistDir);
  const secretsHelpSourceSignature = precomputeExtendedHelp
    ? resolveSecretsHelpSourceSignature(resolvedSourceRootDir)
    : null;
  const nodesHelpSourceSignature = precomputeExtendedHelp
    ? resolveNodesHelpSourceSignature(resolvedSourceRootDir)
    : null;
  const subcommandHelpSourceSignature = precomputeExtendedHelp
    ? resolveSubcommandHelpSourceSignature(resolvedSourceRootDir)
    : null;
  const bundledPluginsDir = path.join(resolvedDistDir, "extensions");
  const renderContext = createIsolatedRootHelpRenderContext(
    existsSync(bundledPluginsDir) ? bundledPluginsDir : resolvedExtensionsDir,
  );
  const channelOptions = dedupe([...CORE_CHANNEL_ORDER, ...channelCatalog.ids]);

  try {
    const existing = JSON.parse(readFileSync(resolvedOutputPath, "utf8")) as {
      rootHelpBundleSignature?: unknown;
      secretsHelpSourceSignature?: unknown;
      nodesHelpSourceSignature?: unknown;
      subcommandHelpSourceSignature?: unknown;
      channelCatalogSignature?: unknown;
      secretsHelpText?: unknown;
      nodesHelpText?: unknown;
      rootHelpText?: unknown;
      subcommandHelpText?: unknown;
    };
    const rootMetadataMatches = Boolean(
      bundleIdentity &&
      existing.rootHelpBundleSignature === bundleIdentity.signature &&
      existing.channelCatalogSignature === channelCatalog.signature &&
      typeof existing.rootHelpText === "string" &&
      existing.rootHelpText.length > 0,
    );
    const extendedMetadataMatches =
      !precomputeExtendedHelp ||
      (existing.secretsHelpSourceSignature === secretsHelpSourceSignature &&
        existing.nodesHelpSourceSignature === nodesHelpSourceSignature &&
        existing.subcommandHelpSourceSignature === subcommandHelpSourceSignature &&
        typeof existing.secretsHelpText === "string" &&
        existing.secretsHelpText.length > 0 &&
        typeof existing.nodesHelpText === "string" &&
        existing.nodesHelpText.length > 0 &&
        hasAllPrecomputedSubcommandHelpText(existing.subcommandHelpText));
    if (rootMetadataMatches && extendedMetadataMatches) {
      return;
    }
  } catch {
    // Missing or malformed existing metadata means we should regenerate it.
  }

  let rootHelpText: string;
  try {
    rootHelpText = await (options?.renderBundledRootHelpText ?? renderBundledRootHelpText)(
      resolvedDistDir,
      renderContext,
    );
  } catch {
    rootHelpText = (options?.renderSourceRootHelpText ?? renderSourceRootHelpText)(renderContext);
  }
  const extendedHelpMetadata = precomputeExtendedHelp
    ? {
        secretsHelpSourceSignature,
        nodesHelpSourceSignature,
        subcommandHelpSourceSignature,
        secretsHelpText: (options?.renderSourceSecretsHelpText ?? renderSourceSecretsHelpText)(
          renderContext,
        ),
        nodesHelpText: (options?.renderSourceNodesHelpText ?? renderSourceNodesHelpText)(
          renderContext,
        ),
        subcommandHelpText: (
          options?.renderSourceSubcommandHelpTextRecord ?? renderSourceSubcommandHelpTextRecord
        )(renderContext),
      }
    : {};

  mkdirSync(resolvedDistDir, { recursive: true });
  writeFileSync(
    resolvedOutputPath,
    `${JSON.stringify(
      {
        generatedBy: "scripts/write-cli-startup-metadata.ts",
        channelOptions,
        channelCatalogSignature: channelCatalog.signature,
        rootHelpBundleSignature: bundleIdentity?.signature ?? null,
        rootHelpText,
        ...extendedHelpMetadata,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function hasAllPrecomputedSubcommandHelpText(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Partial<Record<PrecomputedSubcommandHelpCommand, unknown>>;
  return PRECOMPUTED_SUBCOMMAND_HELP_COMMANDS.every(
    (commandName) => typeof record[commandName] === "string" && record[commandName].length > 0,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  await writeCliStartupMetadata();
  process.exit(0);
}
