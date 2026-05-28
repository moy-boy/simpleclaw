---
summary: "First-run FAQ for the simplified OpenAI subscription setup"
read_when:
  - You are setting up OpenClaw for the first time
  - You are deciding which auth and channel path to use
title: "First-run FAQ"
---

## What do I need first?

You need:

- Node 22.19 or newer.
- An OpenAI/ChatGPT subscription account that can use Codex auth.
- A Telegram bot token or Discord bot token, depending on the channel you want.

## Which model auth should I choose?

Choose OpenAI subscription auth:

```bash
openclaw onboard --auth-choice openai-codex
```

For remote or headless hosts:

```bash
openclaw onboard --auth-choice openai-codex-device-code
```

## Which channels are supported?

Telegram and Discord.

Useful docs:

- [Telegram](/channels/telegram)
- [Discord](/channels/discord)
- [Channels overview](/channels)

## Do I need API keys from other providers?

No. This simplified setup supports OpenAI subscription-backed model access only.
Non-OpenAI hosted providers, local model servers, aggregators, and custom model
provider ids are rejected by the supported runtime surface.

## How do I verify the setup?

```bash
openclaw models status
openclaw channels status
openclaw doctor
```

For a live OpenAI auth probe:

```bash
openclaw models status --probe
```

## What model should I set?

Start with:

```bash
openclaw models set openai/gpt-5.5
```

For a cheaper fallback:

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "openai/gpt-5.5",
        fallbacks: ["openai/gpt-5.4-mini"],
      },
    },
  },
}
```

## Where should I run OpenClaw?

Run the Gateway on the machine that owns the workspace and auth profiles. Keep
that machine online when you want Telegram or Discord messages to reach the
agent.

## Related

- [Getting started](/start/getting-started)
- [OpenAI provider](/providers/openai)
- [Models CLI](/cli/models)
- [Authentication](/gateway/authentication)
