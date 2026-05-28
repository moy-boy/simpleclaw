import { runExtensionOxlint } from "./lib/run-extension-oxlint.mjs";
import { listSupportedBundledPluginRoots } from "./lib/supported-surface.mjs";

runExtensionOxlint({
  roots: listSupportedBundledPluginRoots(),
  toolName: "oxlint-bundled-extensions",
  lockName: "oxlint-bundled-extensions",
  tempDirPrefix: "openclaw-bundled-extension-oxlint-",
  emptyMessage: "No bundled extension files found.",
});
