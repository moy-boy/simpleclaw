import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OnboardOptions } from "../../onboard-types.js";
import { inferAuthChoiceFromFlags } from "./auth-choice-inference.js";

const resolveManifestProviderOnboardAuthFlags = vi.hoisted(() =>
  vi.fn<
    () => ReadonlyArray<{
      optionKey: string;
      authChoice: string;
      cliFlag: string;
    }>
  >(() => []),
);

vi.mock("../../../plugins/provider-auth-choices.js", () => ({
  resolveManifestProviderOnboardAuthFlags,
}));

describe("inferAuthChoiceFromFlags", () => {
  beforeEach(() => {
    resolveManifestProviderOnboardAuthFlags.mockReset();
    resolveManifestProviderOnboardAuthFlags.mockReturnValue([]);
  });

  it("infers supported plugin-owned auth choices from manifest option keys", () => {
    resolveManifestProviderOnboardAuthFlags.mockReturnValue([
      {
        optionKey: "openaiCodexLogin",
        authChoice: "openai-codex",
        cliFlag: "--openai-codex-login",
      },
    ]);

    const opts: OnboardOptions = {
      openaiCodexLogin: "login-token",
    };

    expect(inferAuthChoiceFromFlags(opts)).toEqual({
      choice: "openai-codex",
      matches: [
        {
          optionKey: "openaiCodexLogin",
          authChoice: "openai-codex",
          label: "--openai-codex-login",
        },
      ],
      unsupportedMatches: [],
    });
  });

  it("reports unsupported plugin and custom provider flags separately", () => {
    resolveManifestProviderOnboardAuthFlags.mockReturnValue([
      {
        optionKey: "pluginOwnedApiKey",
        authChoice: "plugin-api-key",
        cliFlag: "--plugin-api-key",
      },
    ]);
    const opts: OnboardOptions = {
      pluginOwnedApiKey: "sk-plugin-test",
      customBaseUrl: "https://models.custom.local/v1",
      customModelId: "local-large",
      customApiKey: "custom-test-key", // pragma: allowlist secret
    };

    expect(inferAuthChoiceFromFlags(opts)).toEqual({
      choice: undefined,
      matches: [],
      unsupportedMatches: [
        {
          optionKey: "pluginOwnedApiKey",
          authChoice: "plugin-api-key",
          label: "--plugin-api-key",
        },
        {
          optionKey: "customBaseUrl",
          authChoice: "custom-api-key",
          label: "--custom-base-url/--custom-model-id/--custom-api-key",
        },
      ],
    });
  });
});
