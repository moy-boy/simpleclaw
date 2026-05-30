import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectRootPackageExcludedExtensionDirs,
  listBundledPluginBuildEntries,
  listBundledPluginPackArtifacts,
} from "../../scripts/lib/bundled-plugin-build-entries.mjs";
import { SUPPORTED_BUNDLED_PLUGIN_IDS } from "../../scripts/lib/supported-surface.mjs";
import { expectNoNodeFsScans } from "../../src/test-utils/fs-scan-assertions.js";

const privateQaEnv = { ...process.env, OPENCLAW_BUILD_PRIVATE_QA: "1" };

function expectNoPrefixMatches(values: string[], prefix: string) {
  expect(values.filter((value) => value.startsWith(prefix))).toEqual([]);
}

function expectSomePrefixMatch(values: string[], prefix: string) {
  expect(values.filter((value) => value.startsWith(prefix))).not.toEqual([]);
}

describe("bundled plugin build entries", () => {
  const bundledChannelEntrySources = ["index.ts", "channel-entry.ts", "setup-entry.ts"];
  const forEachBundledChannelEntry = (
    visit: (params: { entryPath: string; entry: string; pluginId: string }) => void,
  ) => {
    for (const dirent of fs.readdirSync("extensions", { withFileTypes: true })) {
      if (!dirent.isDirectory()) {
        continue;
      }

      for (const sourceEntry of bundledChannelEntrySources) {
        const entryPath = path.join("extensions", dirent.name, sourceEntry);
        if (!fs.existsSync(entryPath)) {
          continue;
        }
        visit({
          entryPath,
          entry: fs.readFileSync(entryPath, "utf8"),
          pluginId: dirent.name,
        });
      }
    }
  };

  it("keeps the default bundled build graph to the simplified supported surface", () => {
    const entries = listBundledPluginBuildEntries();
    const keys = Object.keys(entries);

    expectSomePrefixMatch(keys, "extensions/telegram/");
    expectSomePrefixMatch(keys, "extensions/discord/");
    expectSomePrefixMatch(keys, "extensions/openai/");
    expectSomePrefixMatch(keys, "extensions/codex/");
    expectSomePrefixMatch(keys, "extensions/anthropic/");
    expectNoPrefixMatches(keys, "extensions/google/");
    expectNoPrefixMatches(keys, "extensions/slack/");
    expectNoPrefixMatches(keys, "extensions/image-generation-core/");
  });

  it("keeps the Telegram ingress worker out of bundled plugin public-surface entries", () => {
    const entries = listBundledPluginBuildEntries();

    expect(entries["extensions/telegram/telegram-ingress-worker.runtime"]).toBeUndefined();
  });

  it("discovers repo plugin build entries without directory scans", () => {
    const payload = expectNoNodeFsScans<{
      artifacts: number;
      entries: number;
    }>(
      `
        const build = await import("./scripts/lib/bundled-plugin-build-entries.mjs");
        const entries = build.listBundledPluginBuildEntries();
        const artifacts = build.listBundledPluginPackArtifacts();
        return {
          artifacts: artifacts.length,
          entries: Object.keys(entries).length,
        };
      `,
      { counters: ["readdirSync"] },
    );

    expect(payload.entries).toBeGreaterThan(0);
    expect(payload.artifacts).toBeGreaterThan(0);
  });

  it("keeps private QA bundles out of required npm pack artifacts", () => {
    const artifacts = listBundledPluginPackArtifacts({ env: privateQaEnv });

    expectNoPrefixMatches(artifacts, "dist/extensions/qa-channel/");
    expectNoPrefixMatches(artifacts, "dist/extensions/qa-lab/");
    expectNoPrefixMatches(artifacts, "dist/extensions/qa-matrix/");
  });

  it("keeps unsupported plugins out of the simplified build graph", () => {
    const entries = listBundledPluginBuildEntries();
    const artifacts = listBundledPluginPackArtifacts();

    for (const pluginId of [
      "acpx",
      "google",
      "image-generation-core",
      "matrix",
      "slack",
      "whatsapp",
    ]) {
      expectNoPrefixMatches(Object.keys(entries), `extensions/${pluginId}/`);
      expectNoPrefixMatches(artifacts, `dist/extensions/${pluginId}/`);
    }
  });

  it("keeps bundled channel secret contracts on packed top-level sidecars", () => {
    const artifacts = listBundledPluginPackArtifacts();
    const excludedPackageDirs = collectRootPackageExcludedExtensionDirs();
    const offenders: string[] = [];
    const secretBackedPluginIds = new Set<string>();

    forEachBundledChannelEntry(({ entryPath, entry, pluginId }) => {
      if (!entry.includes('exportName: "channelSecrets"')) {
        return;
      }
      secretBackedPluginIds.add(pluginId);
      if (entry.includes("./src/secret-contract.js")) {
        offenders.push(entryPath);
      }
      expect(entry).toContain('specifier: "./secret-contract-api.js"');
    });

    expect(offenders).toStrictEqual([]);

    for (const pluginId of [...secretBackedPluginIds].toSorted()) {
      if (!SUPPORTED_BUNDLED_PLUGIN_IDS.has(pluginId)) {
        continue;
      }
      if (excludedPackageDirs.has(pluginId)) {
        continue;
      }
      const secretApiPath = path.join("extensions", pluginId, "secret-contract-api.ts");
      expect(fs.readFileSync(secretApiPath, "utf8")).toContain("channelSecrets");
      expect(artifacts).toContain(`dist/extensions/${pluginId}/secret-contract-api.js`);
    }
  });

  it("keeps bundled channel entry metadata on packed top-level sidecars", () => {
    const offenders: string[] = [];

    forEachBundledChannelEntry(({ entryPath, entry }) => {
      if (
        !entry.includes("defineBundledChannelEntry") &&
        !entry.includes("defineBundledChannelSetupEntry")
      ) {
        return;
      }
      if (/specifier:\s*["']\.\/src\//u.test(entry)) {
        offenders.push(entryPath);
      }
    });

    expect(offenders).toStrictEqual([]);
  });
});
