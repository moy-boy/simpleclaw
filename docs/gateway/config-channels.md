---
summary: "Channel configuration: access control, pairing, and per-channel keys for Discord and Telegram"
read_when:
  - Configuring Discord or Telegram channel auth, access control, or multi-account routing
  - Troubleshooting per-channel config keys
  - Auditing DM policy, group policy, or mention gating
title: "Configuration - channels"
---

Per-channel configuration keys live under `channels.*`. This setup supports
Discord and Telegram as message providers.

For agents, tools, gateway runtime, and other top-level keys, see
[Configuration reference](/gateway/configuration-reference).

## Channels

Each configured channel starts automatically unless its config sets
`enabled: false`.

| Channel  | Config key          | Setup guide                    |
| -------- | ------------------- | ------------------------------ |
| Discord  | `channels.discord`  | [Discord](/channels/discord)   |
| Telegram | `channels.telegram` | [Telegram](/channels/telegram) |

### DM and group access

Discord and Telegram both support DM policies and group policies:

| DM policy           | Behavior                                                        |
| ------------------- | --------------------------------------------------------------- |
| `pairing` (default) | Unknown senders get a one-time pairing code; owner must approve |
| `allowlist`         | Only senders in `allowFrom` (or paired allow store)             |
| `open`              | Allow all inbound DMs (requires `allowFrom: ["*"]`)             |
| `disabled`          | Ignore all inbound DMs                                          |

| Group policy          | Behavior                                               |
| --------------------- | ------------------------------------------------------ |
| `allowlist` (default) | Only groups matching the configured allowlist          |
| `open`                | Bypass group allowlists (mention-gating still applies) |
| `disabled`            | Block all group/channel messages                       |

<Note>
`channels.defaults.groupPolicy` sets the default when a channel's
`groupPolicy` is unset. Pairing codes expire after 1 hour. Pending DM pairing
requests are capped at **3 per channel**.
</Note>

### Channel model overrides

Use `channels.modelByChannel` to pin specific channel IDs to a model. Values
accept `provider/model` or configured model aliases. The mapping applies when a
session does not already have a model override, such as one set via `/model`.

```json5
{
  channels: {
    modelByChannel: {
      discord: {
        "123456789012345678": "openai/gpt-5.5",
      },
      telegram: {
        "-1001234567890": "openai/gpt-5.4-mini",
        "-1001234567890:topic:99": "openai/gpt-5.4",
      },
    },
  },
}
```

### Channel defaults and heartbeat

Use `channels.defaults` for shared group-policy and heartbeat behavior:

```json5
{
  channels: {
    defaults: {
      groupPolicy: "allowlist", // open | allowlist | disabled
      contextVisibility: "all", // all | allowlist | allowlist_quote
      heartbeat: {
        showOk: false,
        showAlerts: true,
        useIndicator: true,
      },
    },
  },
}
```

- `channels.defaults.groupPolicy`: fallback group policy when a channel-level `groupPolicy` is unset.
- `channels.defaults.contextVisibility`: default supplemental context visibility mode. Values: `all`, `allowlist`, `allowlist_quote`.
- `channels.defaults.heartbeat.showOk`: include healthy channel statuses in heartbeat output.
- `channels.defaults.heartbeat.showAlerts`: include degraded/error statuses in heartbeat output.
- `channels.defaults.heartbeat.useIndicator`: render compact indicator-style heartbeat output.

### Telegram

```json5
{
  channels: {
    telegram: {
      enabled: true,
      botToken: "your-bot-token",
      dmPolicy: "pairing",
      allowFrom: ["tg:123456789"],
      groups: {
        "*": { requireMention: true },
        "-1001234567890": {
          allowFrom: ["@admin"],
          systemPrompt: "Keep answers brief.",
          topics: {
            "99": {
              requireMention: false,
              skills: ["search"],
              systemPrompt: "Stay on topic.",
            },
          },
        },
      },
      customCommands: [
        { command: "backup", description: "Git backup" },
        { command: "generate", description: "Create an image" },
      ],
      historyLimit: 50,
      replyToMode: "first", // off | first | all | batched
      linkPreview: true,
      streaming: "partial", // off | partial | block | progress
      actions: { reactions: true, sendMessage: true },
      reactionNotifications: "own", // off | own | all
      mediaMaxMb: 100,
    },
  },
}
```

- Bot token: `channels.telegram.botToken` or `channels.telegram.tokenFile`, with `TELEGRAM_BOT_TOKEN` as fallback for the default account.
- `apiRoot` is the Telegram Bot API root only. Use `https://api.telegram.org` or your self-hosted/proxy root, not `https://api.telegram.org/bot<TOKEN>`.
- Optional `channels.telegram.defaultAccount` overrides default account selection when it matches a configured account id.
- In multi-account setups, set an explicit default with `channels.telegram.defaultAccount` or `channels.telegram.accounts.default`.
- `configWrites: false` blocks Telegram-initiated config writes.
- Telegram stream previews use `sendMessage` + `editMessageText`.
- Retry policy: see [Retry policy](/concepts/retry).

### Discord

```json5
{
  channels: {
    discord: {
      enabled: true,
      token: "your-bot-token",
      mediaMaxMb: 100,
      allowBots: false,
      actions: {
        reactions: true,
        stickers: true,
        polls: true,
        permissions: true,
        messages: true,
        threads: true,
        pins: true,
        search: true,
        memberInfo: true,
        roleInfo: true,
        roles: false,
        channelInfo: true,
        voiceStatus: true,
        events: true,
        moderation: false,
      },
      replyToMode: "off", // off | first | all | batched
      dmPolicy: "pairing",
      allowFrom: ["1234567890", "123456789012345678"],
      dm: { enabled: true, groupEnabled: false, groupChannels: ["openclaw-dm"] },
      guilds: {
        "123456789012345678": {
          slug: "friends-of-openclaw",
          requireMention: false,
          ignoreOtherMentions: true,
          reactionNotifications: "own",
          users: ["987654321098765432"],
          channels: {
            general: { allow: true },
            help: {
              allow: true,
              requireMention: true,
              users: ["987654321098765432"],
              skills: ["docs"],
              systemPrompt: "Short answers only.",
            },
          },
        },
      },
      historyLimit: 20,
      textChunkLimit: 2000,
      suppressEmbeds: true,
      chunkMode: "length", // length | newline
      streaming: {
        mode: "progress", // off | partial | block | progress
        progress: {
          label: "auto",
          maxLines: 8,
          maxLineChars: 120,
          toolProgress: true,
        },
      },
      threadBindings: {
        enabled: true,
        idleHours: 24,
        maxAgeHours: 0,
        spawnSessions: true,
        defaultSpawnContext: "fork",
      },
      execApprovals: {
        enabled: "auto", // true | false | "auto"
        approvers: ["987654321098765432"],
        agentFilter: ["default"],
        sessionFilter: ["discord:"],
        target: "dm", // dm | channel | both
        cleanupAfterResolve: false,
      },
    },
  },
}
```

- Token: `channels.discord.token`, with `DISCORD_BOT_TOKEN` as fallback for the default account.
- Optional `channels.discord.defaultAccount` overrides default account selection when it matches a configured account id.
- Use `user:<id>` for DMs or `channel:<id>` for guild channels; bare numeric IDs are rejected.
- Bot-authored messages are ignored by default. `allowBots: true` enables them; `allowBots: "mentions"` only accepts bot messages that mention the bot.
- `channels.discord.streaming` is the canonical stream mode key. Discord defaults to `streaming.mode: "progress"` so tool/work progress appears in one edited preview message.
- `channels.discord.execApprovals` enables Discord-native exec approval delivery and approver authorization.
- Discord voice channel conversations are off by default. Set `channels.discord.voice.enabled=true` to opt in.

### Multi-account

Run multiple accounts per channel, each with its own `accountId`:

```json5
{
  channels: {
    telegram: {
      accounts: {
        default: {
          name: "Primary bot",
          botToken: "123456:ABC...",
        },
        alerts: {
          name: "Alerts bot",
          botToken: "987654:XYZ...",
        },
      },
    },
  },
}
```

- `default` is used when `accountId` is omitted.
- Env tokens only apply to the default account.
- Base channel settings apply to all accounts unless overridden per account.
- Use `bindings[].match.accountId` to route each account to a different agent.
- Existing channel-only bindings keep matching the default account; account-scoped bindings remain optional.

### Group chat mention gating

Group messages default to **require mention** through native mentions or safe regex
patterns. This applies to Telegram groups and Discord guild channels.

Visible replies are controlled separately. Normal group/channel requests default
to automatic final delivery. Some harnesses, including Codex, default
direct/source chats to message-tool delivery so visible output only posts after
the agent calls `message(action=send)`.

```json5
{
  messages: {
    visibleReplies: "automatic",
    groupChat: {
      historyLimit: 50,
      unmentionedInbound: "room_event",
      visibleReplies: "message_tool",
    },
  },
  agents: {
    list: [{ id: "main", groupChat: { mentionPatterns: ["@openclaw", "openclaw"] } }],
  },
}
```

- Metadata mentions are native platform @-mentions.
- Text patterns come from `agents.list[].groupChat.mentionPatterns`.
- `messages.groupChat.historyLimit` sets the global default. Channels can override with `channels.<channel>.historyLimit` or per-account settings.
- `messages.groupChat.unmentionedInbound: "room_event"` submits unmentioned always-on room chatter as quiet context on supported channels. Mentioned messages, commands, and direct messages remain user requests. See [Ambient room events](/channels/ambient-room-events).

### DM history limits

```json5
{
  channels: {
    telegram: {
      dmHistoryLimit: 30,
      dms: {
        "123456789": { historyLimit: 50 },
      },
    },
  },
}
```

Resolution: per-DM override -> channel default -> no limit. Supported channels:
`telegram`, `discord`.

### Commands

```json5
{
  commands: {
    native: "auto",
    nativeSkills: "auto",
    text: true,
    bash: false,
    config: false,
    mcp: false,
    plugins: false,
    debug: false,
    restart: true,
    ownerAllowFrom: ["discord:123456789012345678"],
    allowFrom: {
      "*": ["user1"],
      discord: ["user:123"],
    },
    useAccessGroups: true,
  },
}
```

- Built-in and bundled command catalog: [Slash Commands](/tools/slash-commands).
- Text commands must be standalone messages with leading `/`.
- `native: "auto"` turns on native commands for Discord and Telegram.
- `nativeSkills: "auto"` turns on native skill commands for Discord and Telegram.
- Override per channel: `channels.discord.commands.native` or `channels.telegram.commands.native`.
- `channels.<channel>.configWrites` gates config mutations per channel.
- For multi-account channels, `channels.<channel>.accounts.<id>.configWrites` gates writes that target that account.
- `restart: false` disables `/restart` and gateway restart tool actions.
- `ownerAllowFrom` is the explicit owner allowlist for owner-only commands and owner-gated channel actions.
- `allowFrom` is per-channel. When set, it is the only authorization source for commands.

## Related

- [Discord](/channels/discord)
- [Telegram](/channels/telegram)
- [Configuration reference](/gateway/configuration-reference)
- [Streaming](/concepts/streaming)
