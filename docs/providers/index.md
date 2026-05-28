---
summary: "OpenAI subscription model provider support in OpenClaw"
read_when:
  - You want to choose a model provider
  - You need a quick overview of supported LLM backends
title: "Provider directory"
---

This simplified OpenClaw setup uses OpenAI subscription login for model access.
Authenticate with the Codex/OpenAI subscription provider, then set the default
model as `openai/model`.

Looking for chat channel docs? See [Channels](/channels).

## Quick start

1. Authenticate with the provider (usually via `openclaw onboard`).
2. Set the default model:

```json5
{
  agents: { defaults: { model: { primary: "openai/gpt-5.5" } } },
}
```

## Provider docs

- [OpenAI subscription/Codex](/providers/openai) - browser login or device pairing through `openai-codex`.

Onboarding rejects non-subscription, custom-provider, and unsupported auth choices. Use `--auth-choice openai-codex`, `--auth-choice openai-codex-device-code`, or `--auth-choice skip`.
