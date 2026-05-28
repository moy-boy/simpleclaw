---
summary: "OpenAI-backed image, video, speech, and media-understanding capabilities"
read_when:
  - Looking for an overview of supported media capabilities
  - Deciding which OpenAI media capability to configure
  - Understanding how async image and video generation works
title: "Media overview"
sidebarTitle: "Media overview"
---

The supported bundled media surface uses OpenAI for image generation, video
generation, text-to-speech, speech-to-text, realtime voice, and media
understanding. The agent only sees a media tool when the matching OpenAI
provider capability is configured and available.

## Capabilities

<CardGroup cols={2}>
  <Card title="Image generation" href="/tools/image-generation" icon="image">
    Create and edit images from text prompts or reference images via
    `image_generate`.
  </Card>
  <Card title="Video generation" href="/tools/video-generation" icon="video">
    Generate videos from text, image, or video references via `video_generate`.
  </Card>
  <Card title="Text-to-speech" href="/tools/tts" icon="microphone">
    Convert outbound replies to spoken audio through OpenAI TTS.
  </Card>
  <Card title="Media understanding" href="/nodes/media-understanding" icon="eye">
    Summarize inbound images and audio with OpenAI or OpenAI Codex media
    understanding routes.
  </Card>
  <Card title="Speech-to-text" href="/nodes/audio" icon="ear-listen">
    Transcribe inbound voice messages with OpenAI transcription.
  </Card>
  <Card title="Talk mode" href="/nodes/talk" icon="audio-lines">
    Use OpenAI realtime voice for browser, telephony, or push-to-talk sessions.
  </Card>
</CardGroup>

## Provider capability matrix

| Provider | Image | Video | TTS | STT | Realtime voice | Media understanding |
| -------- | :---: | :---: | :-: | :-: | :------------: | :-----------------: |
| OpenAI   |   ✓   |   ✓   |  ✓  |  ✓  |       ✓        |          ✓          |

## Async vs synchronous

| Capability     | Mode         | Why                                                                                                  |
| -------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| Image          | Asynchronous | Generation can outlive a chat turn; generated attachments use the shared completion path.            |
| Video          | Asynchronous | Provider processing can take 30 seconds to several minutes and can run up to the configured timeout. |
| Text-to-speech | Synchronous  | Provider responses return in seconds and attach to the reply audio.                                  |
| Speech-to-text | Synchronous  | Voice-message transcription runs before the agent decides whether and how to reply.                  |

For async generation, OpenClaw submits the request, returns a task id, and
wakes the agent when the provider finishes. The completion agent then sends the
generated media through the `message` tool. If the requester session is
inactive and some generated media was not delivered through the message tool,
OpenClaw sends an idempotent direct fallback with only the missing media.

## Configure OpenAI media

Use the normal OpenAI auth setup first:

```bash
openclaw models auth login --provider openai --method api-key
```

You can also set `OPENAI_API_KEY` in the Gateway environment. Image generation
may use OpenAI Codex OAuth when an `openai-codex` profile is available; direct
OpenAI API key config remains the clearest production path.

## Related

- [Image generation](/tools/image-generation)
- [Video generation](/tools/video-generation)
- [Text-to-speech](/tools/tts)
- [Media understanding](/nodes/media-understanding)
- [Audio nodes](/nodes/audio)
- [Talk mode](/nodes/talk)
