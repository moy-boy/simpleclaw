---
summary: "Inbound image and audio understanding with OpenAI"
read_when:
  - Designing or refactoring media understanding
  - Tuning inbound image or audio preprocessing
title: "Media understanding"
sidebarTitle: "Media understanding"
---

OpenClaw can summarize inbound media before the reply pipeline runs. In the
supported bundled setup, media understanding uses OpenAI and OpenAI Codex media
routes. If understanding is disabled or unavailable, the reply flow continues
with the original message body and attachments.

## Goals

- Pre-digest inbound media into short text for routing and command parsing.
- Preserve original attachments for models and tools that can inspect them.
- Use OpenAI provider auth and normal model selection.
- Allow ordered fallback only when you configure it explicitly.

## High-level behavior

<Steps>
  <Step title="Collect attachments">
    Collect inbound `MediaPaths`, `MediaUrls`, and `MediaTypes`.
  </Step>
  <Step title="Select attachments">
    For each enabled capability, select attachments using the configured
    attachment policy. The default is the first matching attachment.
  </Step>
  <Step title="Run OpenAI media understanding">
    Run the first eligible OpenAI model entry for the capability.
  </Step>
  <Step title="Apply the result">
    `Body` becomes an `[Image]`, `[Audio]`, or `[Video]` block. Audio also sets
    `{{Transcript}}`.
  </Step>
</Steps>

## Config

```json5
{
  tools: {
    media: {
      image: {
        enabled: true,
        maxBytes: 10485760,
        maxChars: 500,
        models: [{ provider: "openai", model: "gpt-5.5" }],
      },
      audio: {
        enabled: true,
        maxBytes: 20971520,
        models: [{ provider: "openai", model: "gpt-4o-mini-transcribe" }],
      },
    },
  },
}
```

Provider credentials use the normal OpenAI auth order: auth profiles,
environment variables, then `models.providers.openai.apiKey`.

## Defaults and limits

| Capability | Default max chars | Default max bytes |
| ---------- | ----------------- | ----------------- |
| Image      | 500               | 10 MB             |
| Audio      | unset             | 20 MB             |

If media exceeds `maxBytes`, that model entry is skipped. If a result exceeds
`maxChars`, OpenClaw trims it before injecting the block into the reply
context.

## Attachment policy

<ParamField path="mode" type='"first" | "all"' default="first">
Whether to process the first selected attachment or all selected attachments.
</ParamField>
<ParamField path="maxAttachments" type="number" default="1">
Cap the number processed.
</ParamField>
<ParamField path="prefer" type='"first" | "last" | "path" | "url"'>
Selection preference among candidate attachments.
</ParamField>

When `mode: "all"`, outputs are labeled `[Image 1/2]`, `[Audio 2/2]`, and so
on.

## Disable media understanding

```json5
{
  tools: {
    media: {
      image: { enabled: false },
      audio: { enabled: false },
    },
  },
}
```

## Related

- [Audio and voice notes](/nodes/audio)
- [Media support](/nodes/images)
- [Media overview](/tools/media-overview)
