import path from "node:path";
import { bundledPluginFile, bundledPluginRoot } from "openclaw/plugin-sdk/test-fixtures";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  detectChangedExtensionIds,
  listAvailableExtensionIds,
  listChangedExtensionIds,
} from "../../scripts/lib/changed-extensions.mjs";
import {
  DEFAULT_EXTENSION_TEST_SHARD_COUNT,
  createExtensionTestShards,
  resolveExtensionBatchPlan,
  resolveExtensionTestPlan,
} from "../../scripts/lib/extension-test-plan.mjs";
import { listSupportedBundledPluginIds } from "../../scripts/lib/supported-surface.mjs";
import {
  parseExtensionIds,
  resolveExtensionBatchParallelism,
  runExtensionBatchPlan,
} from "../../scripts/test-extension-batch.mjs";
import { expectNoNodeFsScans } from "../../src/test-utils/fs-scan-assertions.js";

type RunGroupParams = {
  args: string[];
  config: string;
  env: Record<string, string | undefined>;
  targets: string[];
};

function requireFirstMockArg<T>(mock: { mock: { calls: Array<[T, ...unknown[]]> } }): T {
  const [call] = mock.mock.calls;
  if (!call) {
    throw new Error("expected first mock call argument");
  }
  const [arg] = call;
  if (arg === undefined) {
    throw new Error("expected first mock call argument");
  }
  return arg;
}

function expectPositiveIntegerMetric(value: number) {
  expect(Number.isInteger(value)).toBe(true);
  expect(value).toBeGreaterThan(0);
}

describe("scripts/test-extension.mjs", () => {
  let balancedExtensionShards: ReturnType<typeof createExtensionTestShards>;
  let balancedExpectedExtensionIds: string[];

  beforeAll(() => {
    balancedExtensionShards = createExtensionTestShards({
      cwd: process.cwd(),
      shardCount: DEFAULT_EXTENSION_TEST_SHARD_COUNT,
    });
    balancedExpectedExtensionIds = listAvailableExtensionIds().filter(
      (extensionId) =>
        resolveExtensionTestPlan({ cwd: process.cwd(), targetArg: extensionId }).hasTests,
    );
  });

  it("lists only supported extension ids", () => {
    expect(listAvailableExtensionIds()).toEqual(listSupportedBundledPluginIds());
  });

  it("resolves supported extensions onto their vitest configs", () => {
    const expectations = [
      ["codex", "test/vitest/vitest.extensions.config.ts"],
      ["discord", "test/vitest/vitest.extension-discord.config.ts"],
      ["openai", "test/vitest/vitest.extension-provider-openai.config.ts"],
      ["telegram", "test/vitest/vitest.extension-telegram.config.ts"],
    ] as const;

    for (const [extensionId, config] of expectations) {
      const plan = resolveExtensionTestPlan({ targetArg: extensionId, cwd: process.cwd() });

      expect(plan.extensionId).toBe(extensionId);
      expect(plan.extensionDir).toBe(bundledPluginRoot(extensionId));
      expect(plan.config).toBe(config);
      expect(plan.roots).toEqual([bundledPluginRoot(extensionId)]);
      expect(plan.hasTests).toBe(true);
    }
  });

  it("rejects removed extension targets", () => {
    expect(() => resolveExtensionTestPlan({ targetArg: "slack", cwd: process.cwd() })).toThrow(
      /Unknown extension target "slack"/u,
    );
    expect(() =>
      resolveExtensionTestPlan({
        cwd: path.join(process.cwd(), "extensions", "slack"),
      }),
    ).toThrow(/current working directory is not inside the bundled plugin workspace tree/u);
  });

  it("infers a supported extension from the current working directory", () => {
    const cwd = path.join(process.cwd(), "extensions", "telegram");
    const plan = resolveExtensionTestPlan({ cwd });

    expect(plan.extensionId).toBe("telegram");
    expect(plan.extensionDir).toBe(bundledPluginRoot("telegram"));
  });

  it("maps changed paths back to supported extension ids", () => {
    const extensionIds = detectChangedExtensionIds([
      bundledPluginFile("discord", "src/channel.ts"),
      "src/telegram/message.test.ts",
      bundledPluginFile("openai", "package.json"),
      bundledPluginFile("slack", "src/channel.ts"),
      "src/not-a-plugin/file.ts",
    ]);

    expect(extensionIds).toEqual(["discord", "openai", "telegram"]);
  });

  it("lists available extension ids from git without reading extension directories", () => {
    const payload = expectNoNodeFsScans<{
      changed: string[];
      ids: string[];
    }>(`
      const { detectChangedExtensionIds, listAvailableExtensionIds } =
        await import("./scripts/lib/changed-extensions.mjs");
      const ids = listAvailableExtensionIds();
      return {
        changed: detectChangedExtensionIds([
          "extensions/discord/src/channel.ts",
          "src/telegram/message.test.ts",
          "extensions/slack/src/channel.ts",
          "extensions/not-real/package.json",
        ]),
        ids,
      };
    `);
    expect(payload.changed).toEqual(["discord", "telegram"]);
    expect(payload.ids).toEqual(listSupportedBundledPluginIds());
  });

  it("can fail safe to all supported extensions when the base revision is unavailable", () => {
    const extensionIds = listChangedExtensionIds({
      base: "refs/heads/openclaw-test-missing-base",
      unavailableBaseBehavior: "all",
    });

    expect(extensionIds).toEqual(listAvailableExtensionIds());
  });

  it("batches supported extensions into config-specific vitest invocations", () => {
    const batch = resolveExtensionBatchPlan({
      cwd: process.cwd(),
      extensionIds: listSupportedBundledPluginIds(),
    });

    expect(batch.extensionIds).toEqual(["anthropic", "codex", "discord", "openai", "telegram"]);
    const stablePlanGroups = batch.planGroups.map(({ estimatedCost, testFileCount, ...group }) => {
      expectPositiveIntegerMetric(estimatedCost);
      expectPositiveIntegerMetric(testFileCount);
      return group;
    });

    expect(stablePlanGroups).toEqual([
      {
        config: "test/vitest/vitest.extension-discord.config.ts",
        extensionIds: ["discord"],
        roots: [bundledPluginRoot("discord")],
      },
      {
        config: "test/vitest/vitest.extension-provider-openai.config.ts",
        extensionIds: ["openai"],
        roots: [bundledPluginRoot("openai")],
      },
      {
        config: "test/vitest/vitest.extension-telegram.config.ts",
        extensionIds: ["telegram"],
        roots: [bundledPluginRoot("telegram")],
      },
      {
        config: "test/vitest/vitest.extensions.config.ts",
        extensionIds: ["anthropic", "codex"],
        roots: [bundledPluginRoot("anthropic"), bundledPluginRoot("codex")],
      },
    ]);
  });

  it("counts tracked supported extension tests without walking extension directories", () => {
    const payload = expectNoNodeFsScans<{
      batchTests: number;
      shards: number;
      shardTests: number;
    }>(
      `
        const { createExtensionTestShards, resolveExtensionBatchPlan } =
          await import("./scripts/lib/extension-test-plan.mjs");
        const extensionIds = ["anthropic", "codex", "discord", "openai", "telegram"];
        const batch = resolveExtensionBatchPlan({ cwd: process.cwd(), extensionIds });
        const shards = createExtensionTestShards({ cwd: process.cwd(), extensionIds, shardCount: 2 });
        return {
          batchTests: batch.testFileCount,
          shards: shards.length,
          shardTests: shards.reduce((total, shard) => total + shard.testFileCount, 0),
        };
      `,
      { counters: ["readdirSync"] },
    );
    expect(payload.batchTests).toBeGreaterThan(0);
    expect(payload.shards).toBe(2);
    expect(payload.shardTests).toBe(payload.batchTests);
  });

  it("balances extension test shards by estimated CI cost", () => {
    const shards = balancedExtensionShards;

    expect(shards).toHaveLength(
      Math.min(DEFAULT_EXTENSION_TEST_SHARD_COUNT, balancedExpectedExtensionIds.length),
    );
    expect(shards.map((shard) => shard.checkName)).toEqual(
      shards.map((shard, index) => `checks-node-extensions-shard-${index + 1}`),
    );

    const assigned = shards.flatMap((shard) => shard.extensionIds);
    const uniqueAssigned = [...new Set(assigned)];

    expect(uniqueAssigned.toSorted((left, right) => left.localeCompare(right))).toEqual(
      balancedExpectedExtensionIds.toSorted((left, right) => left.localeCompare(right)),
    );
    expect(assigned).toHaveLength(balancedExpectedExtensionIds.length);

    for (const shard of shards) {
      expect(shard.extensionIds.length).toBeGreaterThan(0);
    }
  });

  it("runs extension batch config groups concurrently when requested", async () => {
    const started: string[] = [];
    const resolvers: Array<() => void> = [];
    const runGroup = vi.fn((params: RunGroupParams) => {
      started.push(params.config);
      return new Promise<number>((resolve) => {
        resolvers.push(() => resolve(0));
      });
    });
    const runPromise = runExtensionBatchPlan(
      {
        extensionCount: 3,
        extensionIds: ["one", "two", "three"],
        estimatedCost: 60,
        hasTests: true,
        planGroups: [
          {
            config: "light",
            estimatedCost: 10,
            extensionIds: ["one"],
            roots: ["extensions/one"],
            testFileCount: 1,
          },
          {
            config: "heavy",
            estimatedCost: 30,
            extensionIds: ["two"],
            roots: ["extensions/two"],
            testFileCount: 3,
          },
          {
            config: "middle",
            estimatedCost: 20,
            extensionIds: ["three"],
            roots: ["extensions/three"],
            testFileCount: 2,
          },
        ],
        testFileCount: 6,
      },
      {
        env: { OPENCLAW_EXTENSION_BATCH_PARALLEL: "2" },
        runGroup,
        vitestArgs: ["--reporter=dot"],
      },
    );

    await Promise.resolve();
    expect(started).toEqual(["heavy", "middle"]);
    resolvers.shift()?.();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(started).toEqual(["heavy", "middle", "light"]);
    while (resolvers.length > 0) {
      resolvers.shift()?.();
    }
    await expect(runPromise).resolves.toBe(0);
    expect(runGroup).toHaveBeenCalledTimes(3);
    const firstRunGroupParams = requireFirstMockArg<RunGroupParams>(runGroup);
    expect(firstRunGroupParams).toEqual({
      args: ["--reporter=dot"],
      config: "heavy",
      env: {
        OPENCLAW_EXTENSION_BATCH_PARALLEL: "2",
        OPENCLAW_VITEST_FS_MODULE_CACHE_PATH: path.join(
          process.cwd(),
          "node_modules",
          ".experimental-vitest-cache",
          "extension-batch",
          "0-heavy",
        ),
      },
      targets: ["extensions/two"],
    });
  });

  it("keeps extension batch parallelism bounded by group count", () => {
    expect(resolveExtensionBatchParallelism(3, { OPENCLAW_EXTENSION_BATCH_PARALLEL: "2" })).toBe(2);
    expect(resolveExtensionBatchParallelism(1, { OPENCLAW_EXTENSION_BATCH_PARALLEL: "4" })).toBe(1);
    expect(resolveExtensionBatchParallelism(3, { OPENCLAW_EXTENSION_BATCH_PARALLEL: "nope" })).toBe(
      1,
    );
  });

  it("preserves positional Vitest args after the extension batch separator", () => {
    expect(
      parseExtensionIds([
        "telegram",
        "--coverage",
        "--",
        "extensions/telegram/src/index.test.ts",
        "--run",
      ]),
    ).toEqual({
      extensionIds: ["telegram"],
      passthroughArgs: ["--coverage", "extensions/telegram/src/index.test.ts", "--run"],
    });
  });
});
