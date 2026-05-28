---
summary: "Reaction behavior for the supported Discord and Telegram channels"
read_when:
  - Working on reactions in Discord or Telegram
  - Understanding message react action semantics
title: "Reactions"
---

The agent can add and remove emoji reactions on messages using the `message`
tool with the `react` action. In the supported bundled channel surface,
reaction behavior is documented for Discord and Telegram.

## How it works

```json
{
  "action": "react",
  "messageId": "msg-123",
  "emoji": "thumbsup"
}
```

- `emoji` is required when adding a reaction.
- Set `emoji` to an empty string (`""`) to remove the bot's reaction or
  reactions when the channel supports that operation.
- Set `remove: true` to remove a specific emoji when the channel supports
  targeted removal.
- On channels that support status reactions, `trackToolCalls: true` lets the
  runtime use that reacted message for subsequent tool-progress reactions
  during the same turn.

## Channel behavior

<AccordionGroup>
  <Accordion title="Discord">
    - Empty `emoji` removes all of the bot's reactions on the message.
    - `remove: true` removes just the specified emoji.

  </Accordion>

  <Accordion title="Telegram">
    - Empty `emoji` removes the bot's reactions.
    - `remove: true` also removes reactions but still requires a non-empty
      `emoji` for tool validation.
  </Accordion>
</AccordionGroup>

## Reaction level

Per-channel `reactionLevel` config controls how broadly the agent uses
reactions. Values are typically `off`, `ack`, `minimal`, or `extensive`.

- Discord: `channels.discord.reactionLevel`
- Telegram: `channels.telegram.reactionLevel`

Set `reactionLevel` on each enabled channel to tune how actively the agent
reacts to messages.

## Related

- [Agent Send](/tools/agent-send)
- [Discord channel](/channels/discord)
- [Telegram channel](/channels/telegram)
