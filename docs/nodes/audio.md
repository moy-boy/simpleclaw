---
summary: "How inbound audio and voice notes are transcribed with OpenAI"
read_when:
  - Changing audio transcription or media handling
  - Configuring OpenAI speech-to-text
title: "Audio and voice notes"
---

OpenClaw can transcribe inbound audio before the reply pipeline runs. In the
supported bundled setup, the provider path is OpenAI speech-to-text, with
optional local CLI fallback only when an operator configures it explicitly.

## What works

- OpenClaw locates the first audio attachment, downloads it if needed, and
  enforces `tools.media.audio.maxBytes`.
- The first eligible configured model entry runs.
- On success, `Body` becomes an `[Audio]` block and `{{Transcript}}` is set.
- Slash-command parsing uses the transcript when the original message has no
  text body.
- In `--verbose`, OpenClaw logs when transcription runs and when it replaces
  the body.

## Default OpenAI config

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        maxBytes: 20971520,
        models: [{ provider: "openai", model: "gpt-4o-mini-transcribe" }],
      },
    },
  },
}
```

Use `gpt-4o-transcribe` when you prefer higher accuracy over the mini model.
Provider auth follows the standard OpenAI order: auth profiles, environment
variables, then `models.providers.openai.apiKey`.

## Scope gating

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        scope: {
          default: "allow",
          rules: [{ action: "deny", match: { chatType: "group" } }],
        },
        models: [{ provider: "openai", model: "gpt-4o-mini-transcribe" }],
      },
    },
  },
}
```

Scope rules use first-match wins. `chatType` is normalized to `direct`,
`group`, or `room`.

## Echo transcript to chat

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        echoTranscript: true,
        echoFormat: '"{transcript}"',
        models: [{ provider: "openai", model: "gpt-4o-mini-transcribe" }],
      },
    },
  },
}
```

`echoTranscript` is off by default. Enable it when users should see a transcript
confirmation before the agent processes the message.

## Mention detection in groups

When `requireMention: true` is set for a Telegram group or topic, OpenClaw can
transcribe an audio-only message before checking for mentions. If the transcript
contains a bot mention or trigger, the message proceeds through the normal reply
pipeline.

Disable that preflight per Telegram group or topic:

- `channels.telegram.groups.<chatId>.disableAudioPreflight: true`
- `channels.telegram.groups.<chatId>.topics.<threadId>.disableAudioPreflight: true`

## Limits

- Default size cap is 20 MB.
- Tiny audio files below 1024 bytes are skipped.
- Default `maxChars` is unset, so full transcripts are kept unless you set a
  limit.
- Preflight transcription only processes the first audio attachment for mention
  detection.

## Related

- [Media understanding](/nodes/media-understanding)
- [Media support](/nodes/images)
- [Talk mode](/nodes/talk)
