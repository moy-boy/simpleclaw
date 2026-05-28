import { describe, expect, it } from "vitest";
import { getChannelPluginCatalogEntry } from "./catalog.js";

describe("channel plugin catalog", () => {
  it("keeps supported external channel ids mapped with catalog install trust", () => {
    const options = {
      workspaceDir: "/tmp/openclaw-channel-catalog-empty-workspace",
      env: {
        OPENCLAW_DISABLE_BUNDLED_PLUGINS: "1",
        OPENCLAW_BUNDLED_PLUGINS_DIR: "/nonexistent/bundled/plugins",
      },
    };

    const discord = getChannelPluginCatalogEntry("discord", options);
    expect(discord?.id).toBe("discord");
    expect(discord?.pluginId).toBeUndefined();
    expect(discord?.trustedSourceLinkedOfficialInstall).toBe(true);
    expect(discord?.install?.npmSpec).toBe("@openclaw/discord");
  });
});
