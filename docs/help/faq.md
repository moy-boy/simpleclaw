---
summary: "FAQ for the simplified OpenAI subscription OpenClaw setup"
read_when:
  - You have a common setup, auth, channel, or model question
title: "FAQ"
---

## What is OpenClaw in this setup?

OpenClaw runs a local Gateway that connects Telegram or Discord messages to an
OpenAI subscription-backed coding agent. The Gateway owns routing, sessions,
workspace context, tools, and delivery back to chat.

## Which model providers are supported?

OpenAI subscription-backed model access only. Configure agent models as
`openai/<model>` refs and authenticate through OpenAI/Codex subscription auth.

```bash
openclaw onboard --auth-choice openai-codex
openclaw models set openai/gpt-5.5
```

## Which message providers are supported?

Telegram and Discord.

```bash
openclaw channels add telegram
openclaw channels add discord
```

## Why does auth mention `openai-codex`?

`openai-codex` is the auth profile provider for ChatGPT/Codex subscription
credentials. Agent model refs still use `openai/<model>`.

## How do I check whether auth works?

```bash
openclaw models status --probe
```

For automation:

```bash
openclaw models status --check
```

## How do I debug channel setup?

```bash
openclaw channels status
openclaw channels list
openclaw doctor
```

Then read the channel-specific page:

- [Telegram](/channels/telegram)
- [Discord](/channels/discord)

## Can I use unsupported providers anyway?

Not in this simplified setup. Runtime validation rejects unsupported model
providers and unsupported message channels so build, docs, onboarding, and
operator workflows stay focused on Telegram, Discord, and OpenAI subscription
auth.

## Related

- [First-run FAQ](/help/faq-first-run)
- [Models FAQ](/help/faq-models)
- [Getting started](/start/getting-started)
- [Provider directory](/providers)
