---
summary: "Generated index of OpenClaw plugin reference pages"
read_when:
  - You need a reference page for a specific OpenClaw plugin
  - You are auditing plugin docs coverage
title: "Plugin reference"
---

# Plugin reference

This page is generated from the supported default plugin surface. Regenerate it
with:

```bash
pnpm plugins:inventory:gen
```

| Plugin                                  | Description                                                                    | Distribution                                          | Surface                                                                                                                                                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [codex](/plugins/reference/codex)       | Codex app-server harness and Codex-managed GPT model catalog.                  | `@openclaw/codex`<br />npm; ClawHub                   | providers: codex; contracts: mediaUnderstandingProviders, migrationProviders                                                                                                                                                   |
| [discord](/plugins/reference/discord)   | Adds the Discord channel surface for sending and receiving OpenClaw messages.  | `@openclaw/discord`<br />npm; ClawHub                 | channels: discord; contracts: meetingNotesSourceProviders                                                                                                                                                                      |
| [openai](/plugins/reference/openai)     | Adds OpenAI, OpenAI Codex model provider support to OpenClaw.                  | `@openclaw/openai-provider`<br />included in OpenClaw | providers: openai, openai-codex; contracts: imageGenerationProviders, mediaUnderstandingProviders, memoryEmbeddingProviders, realtimeTranscriptionProviders, realtimeVoiceProviders, speechProviders, videoGenerationProviders |
| [telegram](/plugins/reference/telegram) | Adds the Telegram channel surface for sending and receiving OpenClaw messages. | `@openclaw/telegram`<br />included in OpenClaw        | channels: telegram                                                                                                                                                                                                             |
