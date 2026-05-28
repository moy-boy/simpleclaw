import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWizardPrompter } from "../../test/helpers/wizard-prompter.js";
import { createNonExitingRuntime } from "../runtime.js";
import type { WizardPrompter } from "./prompts.js";

const ensureOnboardingPluginInstalled = vi.hoisted(() =>
  vi.fn(async ({ cfg }: { cfg: Record<string, unknown> }) => ({
    cfg,
    installed: true,
    status: "installed",
  })),
);
vi.mock("../commands/onboarding-plugin-install.js", () => ({
  ensureOnboardingPluginInstalled,
}));

import {
  testing,
  resolveOfficialPluginOnboardingInstallEntries,
  setupOfficialPluginInstalls,
} from "./setup.official-plugins.js";

describe("resolveOfficialPluginOnboardingInstallEntries", () => {
  it("does not list optional generic official plugins in the simplified catalog", () => {
    const entries = resolveOfficialPluginOnboardingInstallEntries({ config: {} });

    expect(entries).toEqual([]);
  });

  it("hides already configured official plugins", () => {
    const entries = resolveOfficialPluginOnboardingInstallEntries({
      config: {
        plugins: {
          entries: {
            acpx: { enabled: true },
          },
          installs: {
            "diagnostics-otel": {
              source: "npm",
              spec: "@openclaw/diagnostics-otel",
              installPath: "/tmp/diagnostics-otel",
            },
          },
        },
      },
    });
    const pluginIds = entries.map((entry) => entry.pluginId);

    expect(pluginIds).not.toContain("diagnostics-otel");
    expect(pluginIds).toEqual([]);
  });

  it("honors restrictive plugin allowlists during onboarding", () => {
    const entries = resolveOfficialPluginOnboardingInstallEntries({
      config: {
        plugins: {
          allow: ["telegram", "discord", "openai", "codex"],
        },
      },
    });

    expect(entries).toEqual([]);
  });
});

describe("formatInstallHint", () => {
  it("describes dual-source npm-default installs as npm first", () => {
    expect(
      testing.formatInstallHint({
        clawhubSpec: "clawhub:@openclaw/diagnostics-otel",
        npmSpec: "@openclaw/diagnostics-otel",
        defaultChoice: "npm",
      }),
    ).toBe("npm, with ClawHub fallback");
  });

  it("keeps dual-source clawhub-default installs ClawHub first", () => {
    expect(
      testing.formatInstallHint({
        clawhubSpec: "clawhub:@openclaw/diagnostics-otel",
        npmSpec: "@openclaw/diagnostics-otel",
        defaultChoice: "clawhub",
      }),
    ).toBe("ClawHub, with npm fallback");
  });
});

describe("setupOfficialPluginInstalls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureOnboardingPluginInstalled.mockImplementation(async ({ cfg }) => ({
      cfg,
      installed: true,
      status: "installed",
    }));
  });

  it("skips the optional plugin prompt when the simplified catalog has no generic plugins", async () => {
    const multiselect = vi.fn(async () => ["diagnostics-otel"]);
    const prompter = createWizardPrompter({
      multiselect: multiselect as WizardPrompter["multiselect"],
    });
    const runtime = createNonExitingRuntime();

    const next = await setupOfficialPluginInstalls({
      config: {},
      prompter,
      runtime,
      workspaceDir: "/tmp/workspace",
    });

    expect(next).toEqual({});
    expect(multiselect).not.toHaveBeenCalled();
    expect(ensureOnboardingPluginInstalled).not.toHaveBeenCalled();
  });

  it("does not install when the user skips optional plugins", async () => {
    const prompter = createWizardPrompter({
      multiselect: vi.fn(async () => ["__skip__"]) as WizardPrompter["multiselect"],
    });

    await setupOfficialPluginInstalls({
      config: {},
      prompter,
      runtime: createNonExitingRuntime(),
    });

    expect(ensureOnboardingPluginInstalled).not.toHaveBeenCalled();
  });
});
