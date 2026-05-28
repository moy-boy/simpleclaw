---
summary: "Multi-agent routing with isolated agents, Discord accounts, Telegram accounts, and bindings"
title: "Multi-agent routing"
sidebarTitle: "Multi-agent routing"
read_when: "You want multiple isolated agents (workspaces + auth) in one gateway process."
status: active
---

Run multiple _isolated_ agents in one Gateway process. Each agent has its own
workspace, state directory (`agentDir`), auth profiles, model selection, and
session history. Bindings route Discord or Telegram traffic to the right agent.

## What is one agent?

An **agent** is a fully scoped workspace with its own:

- **Workspace**: files, `AGENTS.md`, local notes, and persona rules.
- **State directory**: `agentDir` for auth profiles, model registry, and config.
- **Session store**: chat history and routing state under the agent directory.

Auth profiles are per-agent:

```text
~/.openclaw/agents/<agentId>/agent/auth-profiles.json
```

<Warning>
Never reuse `agentDir` across agents. Shared directories cause auth and session
collisions. If an agent needs an independent OpenAI subscription profile, sign
in from that agent.
</Warning>

Skills are loaded from each agent workspace plus shared roots such as
`~/.openclaw/skills`, then filtered by the effective agent skill allowlist when
configured. Use `agents.defaults.skills` for a shared baseline and
`agents.list[].skills` for per-agent replacement. See
[Skills: per-agent vs shared](/tools/skills#per-agent-vs-shared-skills).

## Minimal example

```json5
{
  agents: {
    defaults: {
      model: "openai/gpt-5.5",
      workspace: "~/.openclaw/workspaces/default",
    },
    list: [
      {
        id: "ops",
        workspace: "~/.openclaw/workspaces/ops",
        model: "openai/gpt-5.5",
      },
      {
        id: "support",
        workspace: "~/.openclaw/workspaces/support",
        model: "openai/gpt-5.4",
      },
    ],
  },
  bindings: [
    {
      channel: "discord",
      match: { peer: { kind: "channel", id: "123456789012345678" } },
      agent: "ops",
    },
    {
      channel: "telegram",
      match: { peer: { kind: "group", id: "-1001234567890" } },
      agent: "support",
    },
  ],
}
```

## Channel accounts

Discord and Telegram can each define multiple accounts. Each account gets an
`accountId`, and bindings can route by channel, account, peer, or a combination.

```json5
{
  channels: {
    telegram: {
      defaultAccount: "primary",
      accounts: {
        primary: { botToken: "123456:ABC..." },
        alerts: { botToken: "987654:XYZ..." },
      },
    },
    discord: {
      defaultAccount: "main",
      accounts: {
        main: { token: "DISCORD_BOT_TOKEN" },
        community: { token: "DISCORD_COMMUNITY_BOT_TOKEN" },
      },
    },
  },
  bindings: [
    {
      channel: "telegram",
      match: { accountId: "alerts" },
      agent: "ops",
    },
    {
      channel: "discord",
      match: { accountId: "community" },
      agent: "support",
    },
  ],
}
```

Rules:

- `accountId` identifies one configured channel account.
- `defaultAccount` is used when an inbound/outbound path does not specify an account.
- Existing channel-only bindings keep matching the default account.
- Account-scoped bindings are useful when one Gateway hosts separate bots for different teams.

## Peer matching

Use peer matching to route specific DMs, groups, guild channels, or Telegram
topics.

```json5
{
  bindings: [
    {
      channel: "discord",
      match: {
        accountId: "community",
        peer: { kind: "channel", id: "234567890123456789" },
      },
      agent: "support",
    },
    {
      channel: "telegram",
      match: {
        accountId: "primary",
        peer: { kind: "group", id: "-1001234567890:topic:99" },
      },
      agent: "ops",
    },
  ],
}
```

Supported peer examples:

- Discord DM: `peer: { kind: "direct", id: "user:<id>" }`
- Discord guild channel: `peer: { kind: "channel", id: "channel:<id>" }`
- Telegram chat: `peer: { kind: "group", id: "-1001234567890" }`
- Telegram topic: `peer: { kind: "group", id: "-1001234567890:topic:99" }`

## Session isolation

Routing decides which agent owns the inbound turn. Session history is then stored
under that agent. This keeps unrelated teams and personas from sharing chat
state.

For multi-user DMs, prefer:

```json5
{
  session: {
    dmScope: "per-channel-peer",
  },
}
```

That setting keeps direct messages from different senders in separate sessions.

## Model selection

This simplified setup uses OpenAI subscription-backed models. Put shared model
defaults under `agents.defaults`, then override per agent when needed.

```json5
{
  agents: {
    defaults: {
      model: "openai/gpt-5.5",
      modelFallbacks: ["openai/gpt-5.4"],
    },
    list: [
      {
        id: "fast-support",
        model: "openai/gpt-5.4-mini",
      },
    ],
  },
}
```

## Operational checklist

1. Configure Discord and/or Telegram under `channels.*`.
2. Add each agent under `agents.list`.
3. Add `bindings[]` for account-level or peer-level routing.
4. Run `openclaw models auth login --provider openai` for each agent that needs its own OpenAI subscription auth profile.
5. Run `openclaw channels status` and send a test message through each routed account.

## Related

- [Configuration - channels](/gateway/config-channels)
- [Discord](/channels/discord)
- [Telegram](/channels/telegram)
- [Models CLI](/cli/models)
