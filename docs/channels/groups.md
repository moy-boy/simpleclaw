---
summary: "Group chat behavior for Telegram and Discord"
read_when:
  - Changing group chat behavior or mention gating
title: "Groups"
sidebarTitle: "Groups"
---

OpenClaw supports shared-room messaging through Telegram groups, Telegram forum topics, Discord guild channels, and Discord threads.

For rooms that should provide quiet context unless the agent explicitly sends a visible message, see [Ambient room events](/channels/ambient-room-events).

## Beginner intro

OpenClaw runs through your configured Telegram bot or Discord bot. If that bot is in an allowed group or channel, OpenClaw can receive messages and reply there.

Default behavior:

- Groups are restricted with `groupPolicy: "allowlist"`.
- Replies require a mention unless you explicitly disable mention gating.
- Visible replies in groups/channels post automatically unless you opt into message-tool-only output.

Translation: allowlisted senders can trigger OpenClaw by mentioning it.

<Note>
**TL;DR**

- DM access is controlled by `*.allowFrom`.
- Group access is controlled by `*.groupPolicy` plus allowlists.
- Reply triggering is controlled by mention gating.

</Note>

Quick flow:

```text
groupPolicy disabled -> drop
groupPolicy allowlist -> group allowed? no -> drop
requireMention yes -> mentioned? no -> keep for context only
mention/reply/command/DM -> user request
always-on group chatter -> user request, or room event when configured
```

## Visible replies

For normal group/channel requests, OpenClaw defaults to `messages.groupChat.visibleReplies: "automatic"`. Final assistant text posts visibly unless you opt the room into message-tool-only output.

Use `messages.groupChat.visibleReplies: "message_tool"` when a shared room should let the agent decide when to speak by calling `message(action=send)`. This works best for group rooms backed by latest-generation, tool-reliable models such as GPT 5.5. If the model misses that tool and returns substantive final text, OpenClaw keeps that final text private instead of posting it to the room.

If the message tool is unavailable under the active tool policy, OpenClaw falls back to automatic visible replies instead of silently suppressing the response. `openclaw doctor` warns about this mismatch.

For direct chats and any other source event, use `messages.visibleReplies: "message_tool"` to apply the same tool-only visible-reply behavior globally. `messages.groupChat.visibleReplies` remains the more specific override for group/channel rooms.

Native slash commands in Discord and Telegram bypass `visibleReplies: "message_tool"` and always reply visibly so the channel-native command UI gets the response it expects.

## Ambient room events

To submit unmentioned always-on group chatter as quiet room context instead of user requests, use [Ambient room events](/channels/ambient-room-events):

```json5
{
  messages: {
    groupChat: {
      unmentionedInbound: "room_event",
      visibleReplies: "message_tool",
    },
  },
}
```

Mentioned messages, commands, abort requests, and DMs stay user requests.

## Context visibility and allowlists

Two different controls are involved in group safety:

- **Trigger authorization**: who can trigger the agent through `groupPolicy`, `groups`, `groupAllowFrom`, Discord guild/channel rules, and sender allowlists.
- **Context visibility**: what supplemental context is injected into the model, such as reply text, quotes, thread history, and forwarded metadata.

By default, OpenClaw prioritizes normal chat behavior and keeps context mostly as received. This means allowlists primarily decide who can trigger actions, not a universal redaction boundary for every quoted or historical snippet.

If you want:

| Goal                                         | What to set                                              |
| -------------------------------------------- | -------------------------------------------------------- |
| Allow all groups but only reply on mentions  | `groups: { "*": { requireMention: true } }`              |
| Disable all group replies                    | `groupPolicy: "disabled"`                                |
| Only specific groups                         | `groups: { "<group-id>": { ... } }`                      |
| Only you can trigger in groups               | `groupPolicy: "allowlist"`, `groupAllowFrom: ["123..."]` |
| Reuse one trusted sender set across channels | `groupAllowFrom: ["accessGroup:operators"]`              |

For reusable sender allowlists, see [Access groups](/channels/access-groups).

## Session keys

- Telegram groups use `agent:<agentId>:telegram:group:<chatId>` session keys.
- Telegram forum topics add `:topic:<topicId>` to the group key so each topic has its own session.
- Discord guild channels use `agent:<agentId>:discord:channel:<channelId>`.
- Discord threads append `:thread:<threadId>` to the Discord channel key.
- Direct chats use the main session, or per-sender sessions if configured.
- Heartbeats are skipped for group sessions.

## Pattern: personal DMs + public groups

This works well if your personal traffic is DMs and your public traffic is groups.

In single-agent mode, DMs typically land in the main session key (`agent:main:main`), while groups always use non-main session keys such as `agent:main:telegram:group:<id>` or `agent:main:discord:channel:<id>`. If you enable sandboxing with `mode: "non-main"`, those group sessions run in the configured sandbox backend while your main DM session stays on-host. Docker is the default backend if you do not choose one.

This gives you one agent workspace and memory with two execution postures:

- DMs: full tools on the host.
- Groups: sandbox plus restricted tools.

<Note>
If you need truly separate workspaces or personas, use a second agent with bindings. See [Multi-agent routing](/concepts/multi-agent).
</Note>

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        scope: "session",
        workspaceAccess: "none",
      },
    },
  },
  tools: {
    sandbox: {
      tools: {
        allow: ["group:messaging", "group:sessions"],
        deny: ["group:runtime", "group:fs", "group:ui", "nodes", "cron", "gateway"],
      },
    },
  },
}
```

## Group policy

Control how group/room messages are handled per channel:

```json5
{
  channels: {
    telegram: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["123456789"],
      groups: {
        "-1001234567890": { requireMention: true },
      },
    },
    discord: {
      groupPolicy: "allowlist",
      guilds: {
        "<DISCORD_GUILD_ID>": {
          channels: {
            "<DISCORD_CHANNEL_ID>": {
              allow: true,
              users: ["discord:123456789012345678"],
            },
          },
        },
      },
    },
  },
}
```

| Policy        | Behavior                                                     |
| ------------- | ------------------------------------------------------------ |
| `"open"`      | Groups bypass allowlists; mention-gating still applies.      |
| `"disabled"`  | Block all group messages entirely.                           |
| `"allowlist"` | Only allow groups/rooms that match the configured allowlist. |

Per-channel notes:

- `groupPolicy` is separate from mention gating.
- DM pairing approvals apply to DM access only; group sender authorization stays explicit.
- Telegram allowlists can match user IDs (`"123456789"`, `"telegram:123456789"`, `"tg:123456789"`) or usernames (`"@alice"` or `"alice"`); prefixes are case-insensitive.
- Discord allowlists use `channels.discord.guilds.<id>.channels`.
- Default is `groupPolicy: "allowlist"`; if your group allowlist is empty, group messages are blocked.
- Runtime safety: when a channel block is missing, group policy falls back to fail-closed behavior instead of inheriting broad defaults.

## Mention gating

Group messages require a mention unless overridden per group. Defaults live under `*.groups."*"`.

Replying to a bot message counts as an implicit mention when the channel exposes reply metadata.

```json5
{
  channels: {
    telegram: {
      groups: {
        "*": { requireMention: true },
        "-1001234567890": { requireMention: false },
      },
    },
    discord: {
      guilds: {
        "<DISCORD_GUILD_ID>": {
          requireMention: true,
          channels: {
            "<DISCORD_CHANNEL_ID>": { allow: true, requireMention: false },
          },
        },
      },
    },
  },
  agents: {
    list: [
      {
        id: "main",
        groupChat: {
          mentionPatterns: ["@openclaw", "openclaw"],
          historyLimit: 50,
        },
      },
    ],
  },
}
```

Mention gating notes:

- `mentionPatterns` are case-insensitive safe regex patterns; invalid patterns and unsafe nested-repetition forms are ignored.
- Native mentions pass when the channel provides them; patterns are a fallback.
- Use `agents.list[].groupChat.mentionPatterns` when multiple agents share a group.
- Allowlisting a group or sender does not disable mention gating; set that room's `requireMention` to `false` when all messages should trigger.
- Group history context is wrapped uniformly across supported channels. Use `messages.groupChat.historyLimit` for the global default and `channels.<channel>.historyLimit` or account-level history limits for overrides. Set `0` to disable.

## Group/channel tool restrictions

Some channel configs support restricting which tools are available inside a specific group, room, channel, or thread.

- `tools`: allow/deny tools for the whole room.
- `toolsBySender`: per-sender overrides within the room. Use explicit key prefixes: `channel:<channelId>:<senderId>`, `id:<senderId>`, `username:<handle>`, `name:<displayName>`, and `"*"` wildcard.

Resolution order, most specific wins:

1. Group/channel `toolsBySender` match.
2. Group/channel `tools`.
3. Default `"*"` `toolsBySender` match.
4. Default `"*"` `tools`.

Example:

```json5
{
  channels: {
    telegram: {
      groups: {
        "*": { tools: { deny: ["exec"] } },
        "-1001234567890": {
          tools: { deny: ["exec", "read", "write"] },
          toolsBySender: {
            "id:123456789": { alsoAllow: ["exec"] },
          },
        },
      },
    },
  },
}
```

Group/channel tool restrictions are applied in addition to global/agent tool policy. Deny still wins.

## Context fields

Group inbound payloads set:

- `ChatType=group`
- `GroupSubject` when known
- `GroupMembers` when known
- `WasMentioned` with the mention gating result
- Telegram forum topics also include `MessageThreadId` and `IsForum`

The agent system prompt includes a group intro on the first turn of a new group session. It reminds the model to respond like a human, avoid Markdown tables, minimize empty lines and follow normal chat spacing, and avoid typing literal `\n` sequences. Channel-sourced group names and participant labels are rendered as fenced untrusted metadata, not inline system instructions.

## Related

- [Group messages](/channels/group-messages)
- [Channel routing](/channels/channel-routing)
- [Pairing](/channels/pairing)
