import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProgramContext } from "./context.js";

const resolveCliChannelOptionsMock = vi.hoisted(() => vi.fn(() => ["telegram", "whatsapp"]));
const listSupportedChannelIdsMock = vi.hoisted(() => vi.fn(() => ["telegram", "discord"]));

vi.mock("../../version.js", () => ({
  VERSION: "9.9.9-test",
}));

vi.mock("../channel-options.js", () => ({
  resolveCliChannelOptions: resolveCliChannelOptionsMock,
}));

vi.mock("../../commands/supported-surface.js", () => ({
  listSupportedChannelIds: listSupportedChannelIdsMock,
}));

describe("createProgramContext", () => {
  beforeEach(() => {
    listSupportedChannelIdsMock.mockClear().mockReturnValue(["telegram", "discord"]);
  });

  it("builds program context from version and resolved channel options", () => {
    resolveCliChannelOptionsMock.mockClear().mockReturnValue(["telegram", "whatsapp", "discord"]);
    const ctx = createProgramContext();
    expect(ctx).toEqual({
      programVersion: "9.9.9-test",
      channelOptions: ["telegram", "discord"],
      messageChannelOptions: "telegram|discord",
      agentChannelOptions: "last|telegram|discord",
    });
    expect(resolveCliChannelOptionsMock).toHaveBeenCalledOnce();
    expect(listSupportedChannelIdsMock).toHaveBeenCalledOnce();
  });

  it("falls back to the supported channels when startup metadata is absent", () => {
    resolveCliChannelOptionsMock.mockClear().mockReturnValue([]);
    const ctx = createProgramContext();
    expect(ctx).toEqual({
      programVersion: "9.9.9-test",
      channelOptions: ["telegram", "discord"],
      messageChannelOptions: "telegram|discord",
      agentChannelOptions: "last|telegram|discord",
    });
    expect(resolveCliChannelOptionsMock).toHaveBeenCalledOnce();
  });

  it("does not resolve channel options before access", () => {
    resolveCliChannelOptionsMock.mockClear();
    createProgramContext();
    expect(resolveCliChannelOptionsMock).not.toHaveBeenCalled();
  });

  it("reuses one channel option resolution across all getters", () => {
    resolveCliChannelOptionsMock.mockClear().mockReturnValue(["telegram"]);
    const ctx = createProgramContext();
    expect(ctx.channelOptions).toEqual(["telegram"]);
    expect(ctx.messageChannelOptions).toBe("telegram");
    expect(ctx.agentChannelOptions).toBe("last|telegram");
    expect(resolveCliChannelOptionsMock).toHaveBeenCalledOnce();
  });

  it("reads program version without resolving channel options", () => {
    resolveCliChannelOptionsMock.mockClear();
    const ctx = createProgramContext();
    expect(ctx.programVersion).toBe("9.9.9-test");
    expect(resolveCliChannelOptionsMock).not.toHaveBeenCalled();
  });
});
