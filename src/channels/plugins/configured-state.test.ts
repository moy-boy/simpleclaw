import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import {
  hasBundledChannelConfiguredState,
  listBundledChannelIdsWithConfiguredState,
} from "./configured-state.js";

const nodeRequire = createRequire(import.meta.url);

describe("bundled channel configured-state metadata", () => {
  it("lists the shipped metadata-first configured-state channels", () => {
    expect(listBundledChannelIdsWithConfiguredState()).toEqual(["discord", "telegram"]);
  });

  it("resolves Discord and Telegram env probes without full plugin loads", () => {
    expect(
      hasBundledChannelConfiguredState({
        channelId: "discord",
        cfg: {},
        env: { DISCORD_BOT_TOKEN: "token" },
      }),
    ).toBe(true);
    expect(
      hasBundledChannelConfiguredState({
        channelId: "telegram",
        cfg: {},
        env: { TELEGRAM_BOT_TOKEN: "token" },
      }),
    ).toBe(true);
  });

  it("uses declarative env metadata without a TypeScript source require hook", () => {
    const previousTsHook = nodeRequire.extensions[".ts"];
    delete nodeRequire.extensions[".ts"];
    try {
      expect(
        hasBundledChannelConfiguredState({
          channelId: "discord",
          cfg: {},
          env: { DISCORD_BOT_TOKEN: "token" },
        }),
      ).toBe(true);
    } finally {
      if (previousTsHook) {
        nodeRequire.extensions[".ts"] = previousTsHook;
      }
    }
  });
});
