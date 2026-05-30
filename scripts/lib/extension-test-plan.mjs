import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { BUNDLED_PLUGIN_PATH_PREFIX, BUNDLED_PLUGIN_ROOT_DIR } from "./bundled-plugin-paths.mjs";
import { listAvailableExtensionIds } from "./changed-extensions.mjs";
import { isSupportedBundledPluginId, listSupportedBundledPluginIds } from "./supported-surface.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
export const DEFAULT_EXTENSION_TEST_SHARD_COUNT = 8;
const EXTENSION_TEST_CONFIG_BY_ID = {
  anthropic: "test/vitest/vitest.extensions.config.ts",
  codex: "test/vitest/vitest.extensions.config.ts",
  discord: "test/vitest/vitest.extension-discord.config.ts",
  openai: "test/vitest/vitest.extension-provider-openai.config.ts",
  telegram: "test/vitest/vitest.extension-telegram.config.ts",
};
const EXTENSION_TEST_COST_MULTIPLIERS = {
  // CI shard planning uses measured wall time rather than raw file count.
  // These ratios come from Blacksmith extension batch timings; import-heavy
  // suites vary widely, and file count alone leaves long tail shards.
  "test/vitest/vitest.extension-discord.config.ts": 0.62,
  "test/vitest/vitest.extension-provider-openai.config.ts": 1.35,
  "test/vitest/vitest.extension-telegram.config.ts": 0.72,
  // This shared config is comparatively cheap per file, so raw file count
  // overstates its real wall-clock cost during CI shard planning.
  "test/vitest/vitest.extensions.config.ts": 1.1,
};
const supportedExtensionTargetHelp = listSupportedBundledPluginIds().join(", ");

function normalizeRelative(inputPath) {
  return inputPath.split(path.sep).join("/");
}

function isPathInsideRepo(relativePath) {
  return relativePath !== ".." && !relativePath.startsWith("../") && !path.isAbsolute(relativePath);
}

function isSkippedTrackedTestFile(relativePath) {
  return relativePath
    .split("/")
    .some((segment) => segment === "dist" || segment === "node_modules");
}

function listTrackedTestFiles(rootPath) {
  const relativeRoot = normalizeRelative(path.relative(repoRoot, rootPath));
  if (!isPathInsideRepo(relativeRoot)) {
    return null;
  }

  const result = spawnSync("git", ["ls-files", "--", relativeRoot], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status !== 0) {
    return null;
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim().replaceAll("\\", "/"))
    .filter(
      (line) =>
        line.length > 0 &&
        !isSkippedTrackedTestFile(line) &&
        (line.endsWith(".test.ts") || line.endsWith(".test.tsx")),
    );
}

function countTestFiles(rootPath) {
  const trackedFiles = listTrackedTestFiles(rootPath);
  if (trackedFiles) {
    return trackedFiles.length;
  }

  let total = 0;
  const stack = [rootPath];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !fs.existsSync(current)) {
      continue;
    }
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist") {
          continue;
        }
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && (fullPath.endsWith(".test.ts") || fullPath.endsWith(".test.tsx"))) {
        total += 1;
      }
    }
  }

  return total;
}

function estimatePlanCost(config, testFileCount) {
  const multiplier = EXTENSION_TEST_COST_MULTIPLIERS[config] ?? 1;
  return Math.max(1, Math.ceil(testFileCount * multiplier));
}

function assertSupportedExtensionTarget(extensionId, targetLabel) {
  if (isSupportedBundledPluginId(extensionId)) {
    return;
  }
  throw new Error(
    `Unsupported extension target "${targetLabel}". Supported bundled plugins: ${supportedExtensionTargetHelp}.`,
  );
}

function resolveExtensionDirectory(targetArg, cwd = process.cwd()) {
  if (targetArg) {
    const asGiven = path.resolve(cwd, targetArg);
    if (fs.existsSync(path.join(asGiven, "package.json"))) {
      return asGiven;
    }

    const byName = path.join(repoRoot, BUNDLED_PLUGIN_ROOT_DIR, targetArg);
    if (fs.existsSync(path.join(byName, "package.json"))) {
      return byName;
    }

    throw new Error(
      `Unknown extension target "${targetArg}". Use a supported plugin name like "telegram" or a path inside the bundled plugin workspace tree.`,
    );
  }

  let current = cwd;
  while (true) {
    if (
      normalizeRelative(path.relative(repoRoot, current)).startsWith(BUNDLED_PLUGIN_PATH_PREFIX) &&
      fs.existsSync(path.join(current, "package.json"))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error(
    "No extension target provided, and current working directory is not inside the bundled plugin workspace tree.",
  );
}

export function resolveExtensionTestPlan(params = {}) {
  const cwd = params.cwd ?? process.cwd();
  const targetArg = params.targetArg;
  const extensionDir = resolveExtensionDirectory(targetArg, cwd);
  const extensionId = path.basename(extensionDir);
  assertSupportedExtensionTarget(extensionId, targetArg ?? extensionId);
  const relativeExtensionDir = normalizeRelative(path.relative(repoRoot, extensionDir));

  const roots = [relativeExtensionDir];
  const config = EXTENSION_TEST_CONFIG_BY_ID[extensionId];
  const testFileCount = roots.reduce(
    (sum, root) => sum + countTestFiles(path.join(repoRoot, root)),
    0,
  );
  const estimatedCost = estimatePlanCost(config, testFileCount);

  return {
    config,
    estimatedCost,
    extensionDir: relativeExtensionDir,
    extensionId,
    hasTests: testFileCount > 0,
    roots,
    testFileCount,
  };
}

function mergeTestPlans(plans) {
  const groupsByConfig = new Map();

  for (const plan of plans) {
    const current = groupsByConfig.get(plan.config) ?? {
      config: plan.config,
      extensionIds: [],
      roots: [],
      estimatedCost: 0,
      testFileCount: 0,
    };

    current.extensionIds.push(plan.extensionId);
    current.roots.push(...plan.roots);
    current.estimatedCost += plan.estimatedCost;
    current.testFileCount += plan.testFileCount;
    groupsByConfig.set(plan.config, current);
  }

  const planGroups = [...groupsByConfig.values()]
    .map((group) =>
      Object.assign({}, group, {
        extensionIds: group.extensionIds.toSorted((left, right) => left.localeCompare(right)),
        roots: [...new Set(group.roots)],
      }),
    )
    .toSorted((left, right) => left.config.localeCompare(right.config));

  return {
    extensionCount: plans.length,
    extensionIds: plans
      .map((plan) => plan.extensionId)
      .toSorted((left, right) => left.localeCompare(right)),
    estimatedCost: plans.reduce((sum, plan) => sum + plan.estimatedCost, 0),
    hasTests: plans.length > 0,
    planGroups,
    testFileCount: plans.reduce((sum, plan) => sum + plan.testFileCount, 0),
  };
}

export function resolveExtensionBatchPlan(params = {}) {
  const cwd = params.cwd ?? process.cwd();
  const extensionIds = params.extensionIds ?? listAvailableExtensionIds();
  const plans = extensionIds
    .map((extensionId) => resolveExtensionTestPlan({ cwd, targetArg: extensionId }))
    .filter((plan) => plan.hasTests);

  return mergeTestPlans(plans);
}

function pickLeastLoadedShard(shards) {
  return shards.reduce((bestIndex, shard, index) => {
    if (bestIndex === -1) {
      return index;
    }
    const best = shards[bestIndex];
    if (shard.estimatedCost !== best.estimatedCost) {
      return shard.estimatedCost < best.estimatedCost ? index : bestIndex;
    }
    if (shard.testFileCount !== best.testFileCount) {
      return shard.testFileCount < best.testFileCount ? index : bestIndex;
    }
    if (shard.plans.length !== best.plans.length) {
      return shard.plans.length < best.plans.length ? index : bestIndex;
    }
    return index < bestIndex ? index : bestIndex;
  }, -1);
}

export function createExtensionTestShards(params = {}) {
  const cwd = params.cwd ?? process.cwd();
  const extensionIds = params.extensionIds ?? listAvailableExtensionIds();
  const shardCount = Math.max(1, Number.parseInt(String(params.shardCount ?? ""), 10) || 1);
  const plans = extensionIds
    .map((extensionId) => resolveExtensionTestPlan({ cwd, targetArg: extensionId }))
    .filter((plan) => plan.hasTests)
    .toSorted((left, right) => {
      if (left.estimatedCost !== right.estimatedCost) {
        return right.estimatedCost - left.estimatedCost;
      }
      if (left.testFileCount !== right.testFileCount) {
        return right.testFileCount - left.testFileCount;
      }
      return left.extensionId.localeCompare(right.extensionId);
    });

  const effectiveShardCount = Math.min(shardCount, Math.max(1, plans.length));
  const shards = Array.from({ length: effectiveShardCount }, () => ({
    estimatedCost: 0,
    plans: [],
    testFileCount: 0,
  }));

  for (const plan of plans) {
    const targetIndex = pickLeastLoadedShard(shards);
    shards[targetIndex].plans.push(plan);
    shards[targetIndex].estimatedCost += plan.estimatedCost;
    shards[targetIndex].testFileCount += plan.testFileCount;
  }

  return shards
    .map((shard, index) =>
      Object.assign(
        {},
        { index, checkName: `checks-node-extensions-shard-${index + 1}` },
        mergeTestPlans(shard.plans),
      ),
    )
    .filter((shard) => shard.hasTests);
}
