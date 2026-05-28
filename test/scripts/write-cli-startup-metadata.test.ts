import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { writeCliStartupMetadata } from "../../scripts/write-cli-startup-metadata.ts";
import { createScriptTestHarness } from "./test-helpers.js";

function writeFixtureFile(rootDir: string, relativePath: string, contents: string): void {
  const filePath = path.join(rootDir, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents, "utf8");
}

function writeStartupMetadataSourceSignatureFixture(rootDir: string): void {
  const fixtures = new Map<string, string>([
    ["src/cli/banner.ts", "export const banner = 'openclaw';\n"],
    [
      "src/cli/daemon-cli/register-service-commands.ts",
      "export const gatewayServiceCommands = 'gateway';\n",
    ],
    ["src/cli/gateway-cli.ts", "export const gatewayHelp = 'gateway';\n"],
    ["src/cli/gateway-cli/register.ts", "export const gatewayRegister = 'gateway';\n"],
    ["src/cli/gateway-cli/run-command.ts", "export const gatewayRun = 'gateway';\n"],
    ["src/cli/help-format.ts", "export const helpFormat = 'help';\n"],
    ["src/cli/models-cli.ts", "export const modelsHelp = 'models';\n"],
    ["src/cli/nodes-cli/register.ts", "export const nodesHelp = 'nodes';\n"],
    ["src/cli/program/register.maintenance.ts", "export const maintenanceHelp = 'maintenance';\n"],
    ["src/cli/program/context.ts", "export const context = 'context';\n"],
    ["src/cli/program/help.ts", "export const help = 'help';\n"],
    ["src/cli/plugins-cli.ts", "export const pluginsHelp = 'plugins';\n"],
    [
      "src/plugins/register-plugin-cli-command-groups.ts",
      "export const pluginCommandGroups = 'plugins';\n",
    ],
    ["src/cli/secrets-cli.ts", "export const secretsHelp = 'secrets';\n"],
    ["src/terminal/links.ts", "export const links = 'links';\n"],
    ["src/terminal/theme.ts", "export const theme = 'theme';\n"],
  ]);
  for (const [relativePath, contents] of fixtures) {
    writeFixtureFile(rootDir, relativePath, contents);
  }
}

describe("write-cli-startup-metadata", () => {
  const { createTempDir } = createScriptTestHarness();

  it("writes runtime-focused startup metadata when dist falls back to source rendering", async () => {
    const tempRoot = createTempDir("openclaw-startup-metadata-");
    const distDir = path.join(tempRoot, "dist");
    const extensionsDir = path.join(tempRoot, "extensions");
    const outputPath = path.join(distDir, "cli-startup-metadata.json");

    mkdirSync(distDir, { recursive: true });
    mkdirSync(path.join(extensionsDir, "matrix"), { recursive: true });
    writeFileSync(
      path.join(extensionsDir, "matrix", "package.json"),
      JSON.stringify({
        openclaw: {
          channel: {
            id: "matrix",
            order: 120,
            label: "Matrix",
          },
        },
      }),
      "utf8",
    );

    await writeCliStartupMetadata({
      distDir,
      outputPath,
      extensionsDir,
      renderBundledRootHelpText: async () => {
        throw new Error("dist root help unavailable");
      },
      renderSourceRootHelpText: () => "Usage: openclaw\n",
      renderSourceSecretsHelpText: () => {
        throw new Error("secrets help should not be precomputed by default");
      },
      renderSourceNodesHelpText: () => {
        throw new Error("nodes help should not be precomputed by default");
      },
      renderSourceSubcommandHelpTextRecord: () => {
        throw new Error("subcommand help should not be precomputed by default");
      },
    });

    const written = JSON.parse(readFileSync(outputPath, "utf8")) as {
      channelOptions: string[];
      nodesHelpText?: string;
      rootHelpText: string;
      secretsHelpText?: string;
      subcommandHelpText?: {
        doctor: string;
        gateway: string;
        models: string;
        plugins: string;
      };
    };
    expect(written.channelOptions).toEqual(["telegram", "discord"]);
    expect(written.secretsHelpText).toBeUndefined();
    expect(written.nodesHelpText).toBeUndefined();
    expect(written.subcommandHelpText).toBeUndefined();
    expect(written.rootHelpText).toContain("Usage:");
    expect(written.rootHelpText).toContain("openclaw");
  });

  it("regenerates nodes help when nodes CLI help sources change", async () => {
    const tempRoot = createTempDir("openclaw-startup-metadata-signature-");
    const distDir = path.join(tempRoot, "dist");
    const extensionsDir = path.join(tempRoot, "extensions");
    const outputPath = path.join(distDir, "cli-startup-metadata.json");
    let nodesRenderCount = 0;

    writeStartupMetadataSourceSignatureFixture(tempRoot);
    mkdirSync(extensionsDir, { recursive: true });
    writeFixtureFile(distDir, "root-help-fixture.js", "export function outputRootHelp() {}\n");

    const writeMetadata = async (): Promise<void> => {
      await writeCliStartupMetadata({
        distDir,
        outputPath,
        extensionsDir,
        sourceRootDir: tempRoot,
        precomputeExtendedHelp: true,
        renderBundledRootHelpText: async () => "Usage: openclaw\n",
        renderSourceSecretsHelpText: () => "Usage: openclaw secrets\n",
        renderSourceNodesHelpText: () => {
          nodesRenderCount += 1;
          return `Usage: openclaw nodes ${nodesRenderCount}\n`;
        },
        renderSourceSubcommandHelpTextRecord: () => ({
          doctor: "Usage: openclaw doctor\n",
          gateway: "Usage: openclaw gateway\n",
          models: "Usage: openclaw models\n",
          plugins: "Usage: openclaw plugins\n",
        }),
      });
    };

    await writeMetadata();
    await writeMetadata();
    expect(nodesRenderCount).toBe(1);

    writeFixtureFile(
      tempRoot,
      "src/cli/nodes-cli/register.ts",
      "export const nodesHelp = 'nodes changed help';\n",
    );

    await writeMetadata();

    const written = JSON.parse(readFileSync(outputPath, "utf8")) as {
      nodesHelpText: string;
    };
    expect(nodesRenderCount).toBe(2);
    expect(written.nodesHelpText).toContain("openclaw nodes 2");
  });
});
