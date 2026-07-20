import { describe, expect, it } from "vitest";
import {
  isSupportedChannelId,
  isSupportedPluginId,
  formatUnsupportedChannelMessage,
} from "./supported-surface.js";

describe("supported surface — slack", () => {
  it("treats slack as a supported channel and plugin", () => {
    expect(isSupportedChannelId("slack")).toBe(true);
    expect(isSupportedPluginId("slack")).toBe(true);
  });
  it("names Slack in the unsupported-channel message", () => {
    expect(formatUnsupportedChannelMessage("matrix")).toContain("Slack");
  });
});
