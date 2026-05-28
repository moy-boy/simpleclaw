import { loadPatternListFromEnv } from "./vitest.pattern-file.ts";
import { createScopedVitestConfig } from "./vitest.scoped-config.ts";
import { supportedSharedExtensionTestRoots } from "./vitest.supported-extension-projects.mjs";

export function loadIncludePatternsFromEnv(
  env: Record<string, string | undefined> = process.env,
): string[] | null {
  return loadPatternListFromEnv("OPENCLAW_VITEST_INCLUDE_FILE", env);
}

export function createExtensionsVitestConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const defaultInclude = supportedSharedExtensionTestRoots.map((root) => `${root}/**/*.test.ts`);
  return createScopedVitestConfig(loadIncludePatternsFromEnv(env) ?? defaultInclude, {
    dir: "extensions",
    env,
    name: "extensions",
    passWithNoTests: true,
    setupFiles: ["test/setup.extensions.ts"],
  });
}

export default createExtensionsVitestConfig();
