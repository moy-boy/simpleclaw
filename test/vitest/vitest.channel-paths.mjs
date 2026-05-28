import path from "node:path";
import { splitChannelExtensionTestRoots } from "./vitest.extension-channel-split-paths.mjs";

const normalizeRepoPath = (value) => value.split(path.sep).join("/");

export const channelTestRoots = ["src/channels", ...splitChannelExtensionTestRoots];
export const channelTestPrefixes = channelTestRoots.map((root) => `${root}/`);
export const coreChannelTestInclude = ["src/channels/**/*.test.ts"];

export function isChannelSurfaceTestFile(filePath) {
  const normalizedFile = normalizeRepoPath(filePath);
  return channelTestPrefixes.some((prefix) => normalizedFile.startsWith(prefix));
}
