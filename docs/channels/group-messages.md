---
summary: "Group message handling for Telegram and Discord"
read_when:
  - Configuring Telegram groups or Discord guild channels
  - Changing mention gating for shared rooms
  - Tuning group session keys or pending-message context
title: "Group messages"
sidebarTitle: "Group messages"
---

Group messages let OpenClaw participate in Telegram groups, Telegram forum topics, Discord guild channels, and Discord threads while keeping those shared rooms separate from personal DM sessions.

For the broader group model, see [Groups](/channels/groups).

## Behavior

- Group policy controls whether group/channel messages are accepted: `open`, `disabled`, or `allowlist`.
- Mention gating controls whether an allowed room triggers on every message or only when the bot is mentioned.
- Per-room sessions keep group context separate from personal DMs.
- Pending group messages that did not trigger a run can be kept as context for the next triggering message.
- Sender labels are passed to the agent so replies can address the right person.

## Telegram example

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
  },
  agents: {
    list: [
      {
        id: "main",
        groupChat: {
          historyLimit: 50,
          mentionPatterns: ["@openclaw", "openclaw"],
        },
      },
    ],
  },
}
```

Telegram group IDs are usually negative numbers such as `-1001234567890`. Telegram forum topics add the topic id to the session key so different topics do not share context.

If the bot should see unmentioned group traffic, disable BotFather privacy mode or use a Telegram setup that delivers full group messages to the bot.

## Discord example

```json5
{
  channels: {
    discord: {
      groupPolicy: "allowlist",
      guilds: {
        "<DISCORD_GUILD_ID>": {
          requireMention: true,
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

Discord threads inherit routing from their parent channel unless a more specific binding or channel rule applies.

## How to use

1. Add the Telegram bot to the group or the Discord bot to the server/channel.
2. Configure group policy and allowlists.
3. Set `requireMention: true` when the bot should answer only when mentioned.
4. Send a mention in the room and confirm the reply stays in that room.
5. Use `/verbose on`, `/trace on`, `/think high`, `/new`, `/reset`, or `/compact` as standalone messages when you want the directive scoped to that room session.

Personal DM sessions remain independent from group sessions.

## Session keys

- Telegram groups: `agent:<agentId>:telegram:group:<chatId>`
- Telegram topics: `agent:<agentId>:telegram:group:<chatId>:topic:<topicId>`
- Discord channels: `agent:<agentId>:discord:channel:<channelId>`
- Discord threads: `agent:<agentId>:discord:channel:<channelId>:thread:<threadId>`

Session store entries appear in the agent session store after a room triggers a run. A missing entry usually means the room has not triggered yet.

## Testing

- Send a mention in a Telegram group and confirm a reply in that group.
- Send a mention in a Discord guild channel or thread and confirm the reply stays in the same surface.
- Send an unmentioned message where `requireMention: true`; it should not trigger a visible response.
- Check `openclaw logs --follow` for accepted or gated inbound group messages.

## Related

- [Groups](/channels/groups)
- [Channel routing](/channels/channel-routing)
- [Pairing](/channels/pairing)
