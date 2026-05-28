import type { IncomingMessage } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";

const loadConfigMock = vi.fn();
const loadGatewayModelCatalogMock = vi.fn();

vi.mock("../config/config.js", () => ({
  getRuntimeConfig: () => loadConfigMock(),
}));

vi.mock("../config/io.js", () => ({
  getRuntimeConfig: () => loadConfigMock(),
}));

vi.mock("./server-model-catalog.js", () => ({
  loadGatewayModelCatalog: () => loadGatewayModelCatalogMock(),
}));

import { resolveOpenAiCompatModelOverride } from "./http-utils.js";

function createReq(headers: Record<string, string> = {}): IncomingMessage {
  return { headers } as IncomingMessage;
}

describe("resolveOpenAiCompatModelOverride", () => {
  beforeEach(() => {
    loadConfigMock.mockReset().mockReturnValue({
      agents: {
        defaults: {
          model: { primary: "openai/gpt-5.4" },
          models: {
            "openai/gpt-5.4": {},
          },
        },
      },
    } as unknown as OpenClawConfig);
    loadGatewayModelCatalogMock
      .mockReset()
      .mockResolvedValue([{ id: "gpt-5.4", name: "GPT 5.4", provider: "openai" }]);
  });

  it("rejects CLI model overrides outside the configured allowlist", async () => {
    await expect(
      resolveOpenAiCompatModelOverride({
        req: createReq({ "x-openclaw-model": "claude-cli/opus" }),
        agentId: "main",
        model: "openclaw",
      }),
    ).resolves.toEqual({
      errorMessage:
        'Unsupported model "claude-cli/opus".\nThis setup supports OpenAI subscription-backed model refs only, such as openai/gpt-5.4.',
    });
  });

  it("rejects unsupported providers even when old config allowlists them", async () => {
    loadConfigMock.mockReturnValue({
      agents: {
        defaults: {
          model: { primary: "openai/gpt-5.4" },
          models: {
            "anthropic/claude-sonnet-4-6": {},
          },
        },
      },
      models: {
        providers: {
          anthropic: {
            models: [{ id: "claude-sonnet-4-6" }],
          },
        },
      },
    } as unknown as OpenClawConfig);

    await expect(
      resolveOpenAiCompatModelOverride({
        req: createReq({ "x-openclaw-model": "anthropic/claude-sonnet-4-6" }),
        agentId: "main",
        model: "openclaw",
      }),
    ).resolves.toMatchObject({
      errorMessage: expect.stringContaining('Unsupported model "anthropic/claude-sonnet-4-6".'),
    });
  });
});
