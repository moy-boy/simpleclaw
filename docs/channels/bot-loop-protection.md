---
summary: "Bot-to-bot loop protection defaults and Discord overrides"
read_when:
  - Configuring bot-authored Discord messages
  - Tuning bot-to-bot loop protection
title: "Bot loop protection"
sidebarTitle: "Bot loop protection"
---

# Bot loop protection

OpenClaw can accept messages written by other bots on channels that support `allowBots`. On the current supported channel set, this is a Discord-focused guard.

When that path is enabled, pair loop protection prevents two bot identities from replying to each other indefinitely.

The guard is enforced by the core channel-turn kernel. Discord maps inbound events into generic facts: account or scope, conversation id, sender bot id, and receiver bot id. Core then tracks the participant pair in both directions, applies a sliding-window budget, and suppresses the pair during a cooldown after the budget is exceeded.

## Defaults

Pair loop protection is active when a channel lets bot-authored messages reach dispatch. Built-in defaults are:

- `maxEventsPerWindow: 20` - a bot pair can exchange 20 events within the window
- `windowSeconds: 60` - sliding window length
- `cooldownSeconds: 60` - suppression time after the pair exceeds the budget

The guard does not affect normal human-authored messages, single-bot deployments, self-message filtering, or one-shot bot replies that stay under the budget.

## Configure shared defaults

Set `channels.defaults.botLoopProtection` once to define the shared baseline. Channel and account overrides can still tune individual Discord accounts.

```json5
{
  channels: {
    defaults: {
      botLoopProtection: {
        maxEventsPerWindow: 20,
        windowSeconds: 60,
        cooldownSeconds: 60,
      },
    },
  },
}
```

Set `enabled: false` only when your channel policy intentionally allows bot-to-bot conversations without automatic suppression.

## Override Discord

Discord can layer channel and account config over the shared default. Precedence is:

- `channels.discord.accounts.<account>.botLoopProtection`
- `channels.discord.botLoopProtection`
- `channels.defaults.botLoopProtection`
- built-in defaults

```json5
{
  channels: {
    defaults: {
      botLoopProtection: {
        maxEventsPerWindow: 20,
      },
    },
    discord: {
      botLoopProtection: {
        maxEventsPerWindow: 8,
      },
      accounts: {
        community: {
          allowBots: "mentions",
          botLoopProtection: {
            maxEventsPerWindow: 5,
            cooldownSeconds: 90,
          },
        },
      },
    },
  },
}
```

## Channel support

- Discord: native `author.bot` facts, keyed by Discord account, channel, and bot pair.

Telegram does not expose a reliable bot-pair identity for this guard in the same way. It keeps using its normal self-message and access-policy filters.

See [SDK runtime](/plugins/sdk-runtime#reusable-runtime-utilities) for plugin implementation details.
