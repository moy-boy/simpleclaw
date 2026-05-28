import fs from "node:fs";
import path from "node:path";
import { bundledPluginRoot } from "openclaw/plugin-sdk/test-fixtures";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildOfficialChannelCatalog,
  OFFICIAL_CHANNEL_CATALOG_RELATIVE_PATH,
  writeOfficialChannelCatalog,
} from "../scripts/write-official-channel-catalog.mjs";
import { describePluginInstallSource } from "../src/plugins/install-source-info.js";
import { cleanupTempDirs, makeTempRepoRoot, writeJsonFile } from "./helpers/temp-repo.js";

const tempDirs: string[] = [];

type OfficialChannelCatalogEntry = ReturnType<
  typeof buildOfficialChannelCatalog
>["entries"][number];
type OfficialChannelInstall = NonNullable<
  NonNullable<OfficialChannelCatalogEntry["openclaw"]>["install"]
>;

function makeRepoRoot(prefix: string): string {
  return makeTempRepoRoot(tempDirs, prefix);
}

function writeJson(filePath: string, value: unknown): void {
  writeJsonFile(filePath, value);
}

function requireInstall(entry: OfficialChannelCatalogEntry | undefined): OfficialChannelInstall {
  const install = entry?.openclaw?.install;
  if (!install) {
    throw new Error("expected official channel install config");
  }
  return install;
}

function requireNpmInstallSource(source: ReturnType<typeof describePluginInstallSource>) {
  if (!source.npm) {
    throw new Error("expected npm install source");
  }
  return source.npm;
}

function findCatalogEntry(
  entries: OfficialChannelCatalogEntry[],
  predicate: (entry: OfficialChannelCatalogEntry) => boolean,
): OfficialChannelCatalogEntry {
  const entry = entries.find(predicate);
  if (!entry) {
    throw new Error("expected official channel catalog entry");
  }
  return entry;
}

function summarizeCatalogEntry(entry: OfficialChannelCatalogEntry) {
  return {
    name: entry.name,
    description: entry.description,
    source: entry.source,
    plugin: entry.openclaw?.plugin,
    channel: entry.openclaw?.channel,
    install: entry.openclaw?.install,
  };
}

afterEach(() => {
  cleanupTempDirs(tempDirs);
});

describe("buildOfficialChannelCatalog", () => {
  it("includes publishable official channel plugins and skips non-publishable entries", () => {
    const repoRoot = makeRepoRoot("openclaw-official-channel-catalog-");
    writeJson(path.join(repoRoot, "extensions", "telegram", "package.json"), {
      name: "@openclaw/telegram",
      version: "2026.3.23",
      description: "OpenClaw Telegram channel plugin",
      openclaw: {
        channel: {
          id: "telegram",
          label: "Telegram",
          selectionLabel: "Telegram (Bot API)",
          detailLabel: "Telegram Bot",
          docsPath: "/channels/telegram",
          docsLabel: "telegram",
          blurb: "register a bot with @BotFather and get going.",
        },
        install: {
          npmSpec: "@openclaw/telegram",
          localPath: bundledPluginRoot("telegram"),
          defaultChoice: "npm",
        },
        release: {
          publishToNpm: true,
        },
      },
    });
    writeJson(path.join(repoRoot, "extensions", "local-only", "package.json"), {
      name: "@openclaw/local-only",
      openclaw: {
        channel: {
          id: "local-only",
          label: "Local Only",
          selectionLabel: "Local Only",
          docsPath: "/channels/local-only",
          blurb: "dev only",
        },
        install: {
          localPath: bundledPluginRoot("local-only"),
        },
        release: {
          publishToNpm: false,
        },
      },
    });

    const entries = buildOfficialChannelCatalog({ repoRoot }).entries;

    expect(
      summarizeCatalogEntry(
        findCatalogEntry(entries, (entry) => entry.name === "@openclaw/discord"),
      ),
    ).toEqual({
      name: "@openclaw/discord",
      description: "OpenClaw Discord channel plugin",
      source: "official",
      plugin: undefined,
      channel: {
        id: "discord",
        label: "Discord",
        selectionLabel: "Discord (Bot API)",
        detailLabel: "Discord Bot",
        docsLabel: "discord",
        docsPath: "/channels/discord",
        blurb: "very well supported right now.",
        systemImage: "bubble.left.and.bubble.right",
        markdownCapable: true,
        preferSessionLookupForAnnounceTarget: true,
      },
      install: {
        npmSpec: "@openclaw/discord",
        defaultChoice: "npm",
        minHostVersion: ">=2026.4.10",
        allowInvalidConfigRecovery: true,
      },
    });
    expect(
      summarizeCatalogEntry(
        findCatalogEntry(entries, (entry) => entry.name === "@openclaw/telegram"),
      ),
    ).toEqual({
      name: "@openclaw/telegram",
      description: "OpenClaw Telegram channel plugin",
      source: undefined,
      plugin: undefined,
      channel: {
        id: "telegram",
        label: "Telegram",
        selectionLabel: "Telegram (Bot API)",
        detailLabel: "Telegram Bot",
        docsLabel: "telegram",
        docsPath: "/channels/telegram",
        blurb: "register a bot with @BotFather and get going.",
      },
      install: {
        npmSpec: "@openclaw/telegram",
        defaultChoice: "npm",
      },
    });
  });

  it("omits third-party channel packages from the official external catalog", () => {
    const repoRoot = makeRepoRoot("openclaw-official-channel-catalog-policy-");
    const entries = buildOfficialChannelCatalog({ repoRoot }).entries.filter(
      (entry) => entry.source === "external" && !entry.name?.startsWith("@openclaw/"),
    );

    expect(entries).toEqual([]);
  });

  it("allows official OpenClaw channel npm specs without integrity during launch", () => {
    const repoRoot = makeRepoRoot("openclaw-official-channel-catalog-openclaw-policy-");
    const discord = buildOfficialChannelCatalog({ repoRoot }).entries.find(
      (entry) => entry.openclaw?.channel?.id === "discord",
    );

    expect({
      name: discord?.name,
      install: discord?.openclaw?.install,
    }).toEqual({
      name: "@openclaw/discord",
      install: {
        npmSpec: "@openclaw/discord",
        defaultChoice: "npm",
        minHostVersion: ">=2026.4.10",
        allowInvalidConfigRecovery: true,
      },
    });
    const installSource = describePluginInstallSource(requireInstall(discord));
    expect(requireNpmInstallSource(installSource).pinState).toBe("floating-without-integrity");
    expect(installSource.warnings).toEqual(["npm-spec-floating", "npm-spec-missing-integrity"]);
  });

  it("skips unsupported publishable channel catalog entries", () => {
    const repoRoot = makeRepoRoot("openclaw-official-channel-catalog-clawhub-");
    writeJson(path.join(repoRoot, "extensions", "storepack-chat", "package.json"), {
      name: "@openclaw/storepack-chat",
      openclaw: {
        channel: {
          id: "storepack-chat",
          label: "Storepack Chat",
          selectionLabel: "Storepack Chat",
          docsPath: "/channels/storepack-chat",
          blurb: "storepack-first channel",
        },
        install: {
          clawhubSpec: "clawhub:@openclaw/storepack-chat",
          npmSpec: "@openclaw/storepack-chat",
          defaultChoice: "clawhub",
        },
        release: {
          publishToNpm: true,
        },
      },
    });

    const entry = buildOfficialChannelCatalog({ repoRoot }).entries.find(
      (candidate) => candidate.openclaw?.channel?.id === "storepack-chat",
    );

    expect(entry).toBeUndefined();
  });

  it("writes the official catalog under dist", () => {
    const repoRoot = makeRepoRoot("openclaw-official-channel-catalog-write-");
    writeJson(path.join(repoRoot, "extensions", "telegram", "package.json"), {
      name: "@openclaw/telegram",
      description: "OpenClaw Telegram channel plugin",
      openclaw: {
        channel: {
          id: "telegram",
          label: "Telegram",
          selectionLabel: "Telegram (Bot API)",
          detailLabel: "Telegram Bot",
          docsPath: "/channels/telegram",
          docsLabel: "telegram",
          blurb: "register a bot with @BotFather and get going.",
        },
        install: {
          npmSpec: "@openclaw/telegram",
        },
        release: {
          publishToNpm: true,
        },
      },
    });

    writeOfficialChannelCatalog({ repoRoot });

    const outputPath = path.join(repoRoot, OFFICIAL_CHANNEL_CATALOG_RELATIVE_PATH);
    expect(fs.existsSync(outputPath)).toBe(true);
    const entries = JSON.parse(fs.readFileSync(outputPath, "utf8")).entries;
    expect(entries.map((entry: { name?: string }) => entry.name)).toEqual([
      "@openclaw/discord",
      "@openclaw/telegram",
    ]);
    const telegramEntry = findCatalogEntry(
      entries,
      (entry: { openclaw?: { channel?: { id?: string } } }) =>
        entry.openclaw?.channel?.id === "telegram",
    );
    expect(summarizeCatalogEntry(telegramEntry)).toEqual({
      name: "@openclaw/telegram",
      description: "OpenClaw Telegram channel plugin",
      source: undefined,
      plugin: undefined,
      channel: {
        id: "telegram",
        label: "Telegram",
        selectionLabel: "Telegram (Bot API)",
        detailLabel: "Telegram Bot",
        docsLabel: "telegram",
        docsPath: "/channels/telegram",
        blurb: "register a bot with @BotFather and get going.",
      },
      install: {
        npmSpec: "@openclaw/telegram",
      },
    });
    const telegramEntries = entries.filter(
      (entry: { openclaw?: { channel?: { id?: string } } }) =>
        entry.openclaw?.channel?.id === "telegram",
    );
    expect(telegramEntries).toHaveLength(1);
  });
});
