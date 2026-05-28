---
summary: "Inbound image and media attachment handling for the supported channels"
read_when:
  - Understanding media attachment handling
  - Configuring image understanding or image generation
title: "Media support"
sidebarTitle: "Media support"
---

OpenClaw preserves inbound media attachments from Telegram and Discord and makes
them available to the reply pipeline. When OpenAI media understanding is
enabled, OpenClaw can also add a short `[Image]` or `[Audio]` block before the
agent replies.

## Inbound attachments

- Telegram and Discord attachments are downloaded or referenced according to
  the channel adapter's normal media handling.
- Original media remains available to tools and models that can inspect it.
- Media-understanding summaries are additive context, not a replacement for the
  original attachment.

## Image understanding

Use OpenAI for image understanding:

```json5
{
  tools: {
    media: {
      image: {
        enabled: true,
        models: [{ provider: "openai", model: "gpt-5.5" }],
      },
    },
  },
}
```

If the active reply model can inspect the image directly, OpenClaw can skip the
summary block and pass the original image through instead.

## Image generation

Generated images use the `image_generate` tool and are delivered through the
`message` tool when the background task completes. See
[Image generation](/tools/image-generation).

## Related

- [Media understanding](/nodes/media-understanding)
- [Audio and voice notes](/nodes/audio)
- [Image generation](/tools/image-generation)
