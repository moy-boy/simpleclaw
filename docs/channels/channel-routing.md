---
summary: "Routing rules for Telegram, Discord, and shared context"
read_when:
  - Changing channel routing or inbox behavior
title: "Channel routing"
---

# Channels & routing

OpenClaw routes replies back to the channel where a message came from. The model does not choose a channel; routing is deterministic and controlled by the host configuration.

## Key terms

- **Channel**: `telegram` or `discord`. `webchat` is the internal WebChat UI channel and is not a configurable outbound channel.
- **AccountId**: per-channel account instance.
- **Default account**: `channels.<channel>.defaultAccount` chooses which account is used when an outbound path does not specify `accountId`.
- **AgentId**: an isolated workspace plus session store.
- **SessionKey**: the bucket key used to store context and control concurrency.

In multi-account setups, set an explicit default account when two or more accounts are configured. Without it, fallback routing may pick the first normalized account ID.

## Outbound target prefixes

Explicit outbound targets may include a provider prefix, such as `telegram:123` or `tg:123`. Core treats that prefix as a channel-selection hint only when the selected channel is `last` or otherwise unresolved, and only when the loaded plugin advertises that prefix.

If the caller already selected an explicit channel, the provider prefix must match that channel. Cross-channel combinations fail before plugin-specific target normalization.

Target-kind prefixes stay inside the selected channel's grammar. Examples:

- Telegram: `telegram:<chatId>` or `tg:<chatId>`
- Discord: `channel:<id>` for channels and `user:<id>` for DMs

## Session key shapes

Direct messages collapse to the agent's **main** session by default:

- `agent:<agentId>:<mainKey>` (default: `agent:main:main`)

Even when direct-message conversation history is shared with main, sandbox and tool policy use a derived per-account direct-chat runtime key for external DMs so channel-originated messages are not treated like local main-session runs.

Groups and channels remain isolated per channel:

- Telegram groups: `agent:<agentId>:telegram:group:<chatId>`
- Telegram forum topics: `agent:<agentId>:telegram:group:<chatId>:topic:<topicId>`
- Discord guild channels: `agent:<agentId>:discord:channel:<channelId>`
- Discord threads: `agent:<agentId>:discord:channel:<channelId>:thread:<threadId>`

Examples:

- `agent:main:telegram:group:-1001234567890:topic:42`
- `agent:main:discord:channel:123456:thread:987654`

## Main DM route pinning

When `session.dmScope` is `main`, direct messages may share one main session. To prevent the session's `lastRoute` from being overwritten by non-owner DMs, OpenClaw infers a pinned owner from `allowFrom` when all of these are true:

- `allowFrom` has exactly one non-wildcard entry.
- The entry can be normalized to a concrete sender ID for that channel.
- The inbound DM sender does not match that pinned owner.

In that mismatch case, OpenClaw still records inbound session metadata, but it skips updating the main session `lastRoute`.

## Guarded inbound recording

Channel plugins can mark an inbound session record as `createIfMissing: false` when a guarded path must not create a new OpenClaw session. In that mode, OpenClaw may update metadata and `lastRoute` for an existing session, but it does not create a route-only session entry just because a message was observed.

## Routing rules

Routing picks one agent for each inbound message:

1. Exact peer match through `bindings` with `peer.kind` and `peer.id`.
2. Parent peer match for thread inheritance.
3. Guild + roles match for Discord via `guildId` and `roles`.
4. Guild match for Discord via `guildId`.
5. Account match through `accountId` on the channel.
6. Channel match for any account on that channel, using `accountId: "*"`.
7. Default agent from `agents.list[].default`, else the first list entry, fallback to `main`.

When a binding includes multiple match fields, all provided fields must match for that binding to apply.

The matched agent determines which workspace and session store are used.

## Config overview

Use `agents.list` for named agents and `bindings` to map Telegram or Discord traffic to those agents.

```json5
{
  agents: {
    list: [{ id: "support", name: "Support", workspace: "~/.openclaw/workspace-support" }],
  },
  bindings: [
    { match: { channel: "discord", guildId: "123456789012345678" }, agentId: "support" },
    { match: { channel: "telegram", peer: { kind: "group", id: "-100123" } }, agentId: "support" },
  ],
}
```

## Session storage

Session stores live under the state directory, default `~/.openclaw`:

- `~/.openclaw/agents/<agentId>/sessions/sessions.json`
- JSONL transcripts live alongside the store

You can override the store path via `session.store` and `{agentId}` templating.

Gateway and ACP session discovery also scans disk-backed agent stores under the default `agents/` root and under templated `session.store` roots. Discovered stores must stay inside that resolved agent root and use a regular `sessions.json` file. Symlinks and out-of-root paths are ignored.

## WebChat behavior

WebChat attaches to the selected agent and defaults to the agent's main session. Because of this, WebChat lets you see cross-channel context for that agent in one place.

## Reply context

Inbound replies include:

- `ReplyToId`, `ReplyToBody`, and `ReplyToSender` when available.
- Quoted context appended to `Body` as a `[Replying to ...]` block.

This is consistent across supported channels.

## Related

- [Groups](/channels/groups)
- [Pairing](/channels/pairing)
