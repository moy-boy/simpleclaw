import { describe, expect, it } from "vitest";
import {
  type OfficialExternalPluginCatalogEntry,
  getOfficialExternalPluginCatalogEntry,
  listOfficialExternalPluginCatalogEntries,
  resolveOfficialExternalPluginId,
  resolveOfficialExternalPluginInstall,
} from "./official-external-plugin-catalog.js";

function expectCatalogEntry(id: string): OfficialExternalPluginCatalogEntry {
  const entry = getOfficialExternalPluginCatalogEntry(id);
  if (entry === undefined) {
    throw new Error(`Expected external plugin catalog entry for ${id}`);
  }
  return entry;
}

describe("official external plugin catalog", () => {
  it("keeps the official channel catalog limited to Discord", () => {
    const discord = expectCatalogEntry("discord");
    const ids = new Set<string>();
    for (const entry of listOfficialExternalPluginCatalogEntries()) {
      const pluginId = resolveOfficialExternalPluginId(entry);
      if (pluginId) {
        ids.add(pluginId);
      }
    }

    expect(resolveOfficialExternalPluginId(discord)).toBe("discord");
    expect(resolveOfficialExternalPluginInstall(discord)).toMatchObject({
      npmSpec: "@openclaw/discord",
      allowInvalidConfigRecovery: true,
    });
    expect(ids).toEqual(new Set(["discord", "codex"]));
  });

  it("keeps the official external provider catalog limited to Codex", () => {
    const codex = expectCatalogEntry("codex");
    expect(resolveOfficialExternalPluginId(codex)).toBe("codex");
    expect(resolveOfficialExternalPluginInstall(codex)).toMatchObject({
      npmSpec: "@openclaw/codex",
      defaultChoice: "npm",
    });
    expect(getOfficialExternalPluginCatalogEntry("amazon-bedrock")).toBeUndefined();
    expect(getOfficialExternalPluginCatalogEntry("anthropic-vertex")).toBeUndefined();
  });
});
