---
summary: "Generated inventory of OpenClaw plugins shipped in core, published externally, or kept source-only"
read_when:
  - You are deciding whether a plugin ships in the core npm package or installs separately
  - You are updating bundled plugin package metadata or release automation
  - You need the canonical internal vs external plugin list
title: "Plugin inventory"
---

# Plugin inventory

This page is generated from the supported default plugin surface,
`extensions/*/package.json`, `openclaw.plugin.json`, and the root npm package
`files` exclusions. Regenerate it with:

```bash
pnpm plugins:inventory:gen
```

## Definitions

- **Core npm package:** built into the `openclaw` npm package and available without a separate plugin install.
- **Official external package:** OpenClaw-maintained plugin omitted from the core npm package, kept in this official inventory, and installed on demand through ClawHub and/or npm.
- **Source checkout only:** repo-local plugin omitted from published npm artifacts and not advertised as an installable package.

Source checkouts are different from npm installs: after `pnpm install`, the
supported default plugins load from `extensions/<id>` so local edits and
package-local workspace dependencies are available.

## Install a plugin

Use the **Distribution** column to decide whether install is needed. Plugins that
say `included in OpenClaw` are already present in the core package. Official
external packages need one install, then a Gateway restart.

For example, Discord is an official external package:

```bash
openclaw plugins install @openclaw/discord
openclaw gateway restart
openclaw plugins inspect discord --runtime --json
```

During the launch cutover, ordinary bare package specs still install from npm.
Use `clawhub:@openclaw/discord` or `npm:@openclaw/discord` when you need an
explicit source. After install, follow the plugin's setup doc, such as
[Discord](/channels/discord), to add credentials and channel config. See
[Manage plugins](/plugins/manage-plugins) for update, uninstall, and publishing
commands.

## Core npm package

| Plugin                                    | Description                                                                    | Distribution                                             | Surface                                                                                                                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [anthropic](/plugins/reference/anthropic) | Adds Anthropic model provider support to OpenClaw.                             | `@openclaw/anthropic-provider`<br />included in OpenClaw | providers: anthropic; contracts: mediaUnderstandingProviders                                                                                                                                                                   |
| [openai](/plugins/reference/openai)       | Adds OpenAI, OpenAI Codex model provider support to OpenClaw.                  | `@openclaw/openai-provider`<br />included in OpenClaw    | providers: openai, openai-codex; contracts: imageGenerationProviders, mediaUnderstandingProviders, memoryEmbeddingProviders, realtimeTranscriptionProviders, realtimeVoiceProviders, speechProviders, videoGenerationProviders |
| [slack](/plugins/reference/slack)         | Adds the Slack channel surface for sending and receiving OpenClaw messages.    | `@openclaw/slack`<br />included in OpenClaw              | channels: slack                                                                                                                                                                                                                |
| [telegram](/plugins/reference/telegram)   | Adds the Telegram channel surface for sending and receiving OpenClaw messages. | `@openclaw/telegram`<br />included in OpenClaw           | channels: telegram                                                                                                                                                                                                             |

## Official external packages

| Plugin                                | Description                                                                   | Distribution                          | Surface                                                                      |
| ------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------- |
| [codex](/plugins/reference/codex)     | Codex app-server harness and Codex-managed GPT model catalog.                 | `@openclaw/codex`<br />npm; ClawHub   | providers: codex; contracts: mediaUnderstandingProviders, migrationProviders |
| [discord](/plugins/reference/discord) | Adds the Discord channel surface for sending and receiving OpenClaw messages. | `@openclaw/discord`<br />npm; ClawHub | channels: discord; contracts: meetingNotesSourceProviders                    |

## Source checkout only

| Plugin | Description | Distribution | Surface |
| ------ | ----------- | ------------ | ------- |
